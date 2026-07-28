import { db } from "./db";

export interface QueueConfig {
  timezone: string;
  activeDays: string[]; // ["mon", ...]
  slotTimes: string[]; // ["09:00", ...]
  maxPerSlot: number;
}

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export async function getQueueConfig(profileId: string): Promise<QueueConfig> {
  const row = await db.queueSetting.findUnique({ where: { profileId } });
  return {
    timezone: row?.timezone ?? "America/New_York",
    activeDays: row ? JSON.parse(row.activeDays) : ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    slotTimes: row ? JSON.parse(row.slotTimes) : ["09:00", "12:00", "17:00"],
    maxPerSlot: row?.maxPerSlot ?? 1,
  };
}

// Returns the wall-clock parts of `date` in `timezone`.
function zonedParts(date: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    weekday: "short", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    y: +parts.year, m: +parts.month, d: +parts.day,
    hh: +parts.hour % 24, mm: +parts.minute,
    weekday: parts.weekday.toLowerCase().slice(0, 3),
  };
}

// Converts a wall-clock time in `timezone` to a UTC Date (iterative offset fix).
function zonedTimeToUtc(y: number, m: number, d: number, hh: number, mm: number, timezone: string): Date {
  let guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(guess, timezone);
    const diff = (p.hh * 60 + p.mm) - (hh * 60 + mm) + (p.d - d) * 1440;
    if (diff === 0) break;
    guess = new Date(guess.getTime() - diff * 60000);
  }
  return guess;
}

// Next N queue slots (as UTC dates) starting from `from`.
export function computeSlots(config: QueueConfig, from: Date, count: number): Date[] {
  const slots: Date[] = [];
  const cursor = new Date(from);
  for (let day = 0; day < 60 && slots.length < count; day++) {
    const probe = new Date(from.getTime() + day * 86400000);
    const p = zonedParts(probe, config.timezone);
    if (!config.activeDays.includes(p.weekday)) continue;
    for (const t of [...config.slotTimes].sort()) {
      const [hh, mm] = t.split(":").map(Number);
      const slot = zonedTimeToUtc(p.y, p.m, p.d, hh, mm, config.timezone);
      if (slot > cursor && slots.length < count) slots.push(slot);
    }
  }
  return slots;
}

export interface QueueSlot {
  time: string; // ISO
  used: number; // posts already queued into this slot
  capacity: number; // maxPerSlot
  available: boolean; // used < capacity
  posts: { id: string; title: string }[];
}

// The next `count` slots annotated with real occupancy — which posts already
// sit in each slot and whether it still has capacity. This is what both the
// preview and nextAvailableSlot read, so what you see is what you get.
export async function computeQueuePreview(
  profileId: string,
  config: QueueConfig,
  count: number
): Promise<QueueSlot[]> {
  const slots = computeSlots(config, new Date(), count);
  if (slots.length === 0) return [];

  // Scheduled posts land on an exact slot instant (see nextAvailableSlot), so a
  // single windowed query keyed by scheduledAt tells us each slot's occupancy.
  const posts = await db.post.findMany({
    where: {
      profileId,
      status: "scheduled",
      scheduledAt: { gte: slots[0], lte: slots[slots.length - 1] },
    },
    select: { id: true, title: true, description: true, scheduledAt: true },
    orderBy: { scheduledAt: "asc" },
  });
  const byTime = new Map<number, { id: string; title: string }[]>();
  for (const p of posts) {
    if (!p.scheduledAt) continue;
    const key = p.scheduledAt.getTime();
    const arr = byTime.get(key) ?? [];
    arr.push({ id: p.id, title: p.title || p.description || "(untitled)" });
    byTime.set(key, arr);
  }

  return slots.map((slot) => {
    const occ = byTime.get(slot.getTime()) ?? [];
    return {
      time: slot.toISOString(),
      used: occ.length,
      capacity: config.maxPerSlot,
      available: occ.length < config.maxPerSlot,
      posts: occ,
    };
  });
}

// First slot with free capacity for the profile — reads the same occupancy the
// preview shows, so queuing never lands somewhere the preview called available.
export async function nextAvailableSlot(profileId: string): Promise<Date> {
  const config = await getQueueConfig(profileId);
  const preview = await computeQueuePreview(profileId, config, 90);
  const free = preview.find((s) => s.available);
  if (free) return new Date(free.time);
  const last = preview[preview.length - 1];
  return last ? new Date(last.time) : new Date(Date.now() + 3600000);
}
