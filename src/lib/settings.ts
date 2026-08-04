import { db } from "./db";
import { decrypt, encrypt } from "./secret-box";

// Instance settings an admin can enter at /settings instead of redeploying.
//
// Precedence: process.env ALWAYS wins. The database only fills a gap where the
// environment variable is unset. That keeps whatever is deployed in Coolify
// authoritative, and leaves env as the escape hatch if a bad value is ever
// saved through the UI.

export type SettingSpec = {
  key: string;
  label: string;
  group: "google" | "smtp" | "linkedin";
  secret: boolean;
  placeholder?: string;
  hint?: string;
};

export const SETTING_SPECS: SettingSpec[] = [
  // Google sign-in. The redirect URI is derived from PUBLIC_BASE_URL, not
  // configured here, so it can never drift from what the route actually sends.
  { key: "GOOGLE_CLIENT_ID", label: "Client ID", group: "google", secret: false, placeholder: "1234-abc.apps.googleusercontent.com" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Client secret", group: "google", secret: true, placeholder: "GOCSPX-…" },

  // SMTP. Brevo is the other supported transport (BREVO_API_KEY) and takes
  // priority in lib/mail.ts when both are present.
  { key: "SMTP_HOST", label: "Host", group: "smtp", secret: false, placeholder: "smtp.example.com" },
  { key: "SMTP_PORT", label: "Port", group: "smtp", secret: false, placeholder: "587", hint: "587 for STARTTLS, 465 for implicit TLS" },
  { key: "SMTP_USER", label: "Username", group: "smtp", secret: false, placeholder: "no-reply@example.com" },
  { key: "SMTP_PASS", label: "Password", group: "smtp", secret: true },
  { key: "SMTP_SECURE", label: "Force TLS", group: "smtp", secret: false, placeholder: "false", hint: "\"true\" for port 465; port 465 is treated as secure automatically" },
  { key: "MAIL_FROM", label: "From address", group: "smtp", secret: false, placeholder: "SocialPost <no-reply@example.com>" },

  // LinkedIn publishing. Without these the Connect button on the Users page
  // cannot start an OAuth flow, so posts fail with "isn't OAuth-connected".
  { key: "LINKEDIN_CLIENT_ID", label: "Client ID", group: "linkedin", secret: false, placeholder: "86xxxxxxxxxxxx" },
  { key: "LINKEDIN_CLIENT_SECRET", label: "Client secret", group: "linkedin", secret: true, placeholder: "WPL_AP1..." },
];

const SPEC_BY_KEY = new Map(SETTING_SPECS.map((s) => [s.key, s]));
export const SETTING_KEYS = SETTING_SPECS.map((s) => s.key);

// Which keys the DEPLOYMENT actually provided, captured at module load before
// applySettingsToEnv() can copy database values into process.env. Without this
// snapshot, a DB-backed setting reads back as environment-provided the moment
// any route calls applySettingsToEnv(), and the settings page would disable the
// field an admin needs to edit.
const ENV_PROVIDED: ReadonlySet<string> = new Set(
  SETTING_SPECS.filter((s) => Boolean(process.env[s.key])).map((s) => s.key)
);

export function isFromEnv(key: string): boolean {
  return ENV_PROVIDED.has(key);
}

// Cache so a request that reads several keys does not hit the DB per key. Kept
// short: an admin saving a setting should see it take effect promptly, and a
// scheduler tick reading stale SMTP config for a few seconds is harmless.
let cache: { at: number; values: Map<string, string> } | null = null;
const TTL_MS = 10_000;

export function invalidateSettingsCache() {
  cache = null;
}

async function dbValues(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.values;
  const values = new Map<string, string>();
  try {
    for (const row of await db.setting.findMany()) {
      const plain = row.encrypted ? decrypt(row.value) : row.value;
      // decrypt() returns null after a SESSION_SECRET rotation — skip rather
      // than surface ciphertext as if it were a real password.
      if (plain) values.set(row.key, plain);
    }
  } catch {
    // Table missing (migration not yet applied) — behave as env-only.
    return new Map();
  }
  cache = { at: Date.now(), values };
  return values;
}

// Resolved value for one key, or undefined when configured nowhere.
export async function getSetting(key: string): Promise<string | undefined> {
  // Deployment-provided values win. Checked against the snapshot so a value
  // this module previously copied into process.env is not mistaken for one.
  if (isFromEnv(key)) return process.env[key];
  return (await dbValues()).get(key);
}

// Loads the DB-backed settings into process.env for the current server process
// so existing readers (lib/mail.ts, the OAuth routes) pick them up without
// every call site becoming async. Env-provided values are never overwritten.
export async function applySettingsToEnv(): Promise<void> {
  const values = await dbValues();
  for (const [key, value] of values) {
    // Never clobber a deployment-provided value; the snapshot keeps this
    // correct even on later calls, once earlier ones have written to env.
    if (!isFromEnv(key)) process.env[key] = value;
  }
}

export type SettingStatus = {
  key: string;
  label: string;
  group: string;
  secret: boolean;
  placeholder?: string;
  hint?: string;
  /** Non-secret values are returned for editing; secrets never are. */
  value: string;
  configured: boolean;
  /** Set in Coolify/env, so the UI field is read-only. */
  fromEnv: boolean;
};

// Everything the settings page needs to render. Secret VALUES are never
// included — only whether one is set.
export async function settingsStatus(): Promise<SettingStatus[]> {
  const values = await dbValues();
  return SETTING_SPECS.map((spec) => {
    const fromEnv = isFromEnv(spec.key);
    const envValue = fromEnv ? process.env[spec.key] : undefined;
    const dbValue = values.get(spec.key);
    const effective = envValue || dbValue;
    return {
      key: spec.key,
      label: spec.label,
      group: spec.group,
      secret: spec.secret,
      placeholder: spec.placeholder,
      hint: spec.hint,
      value: spec.secret ? "" : (dbValue ?? ""),
      configured: Boolean(effective),
      fromEnv,
    };
  });
}

// Writes one setting. Empty string clears it. Rejects unknown keys so this can
// never be used to write arbitrary rows.
export async function saveSetting(key: string, raw: string, updatedBy: string): Promise<void> {
  const spec = SPEC_BY_KEY.get(key);
  if (!spec) throw new Error(`Unknown setting: ${key}`);

  const value = raw.trim();
  if (!value) {
    await db.setting.deleteMany({ where: { key } });
    invalidateSettingsCache();
    return;
  }

  const stored = spec.secret ? encrypt(value) : value;
  await db.setting.upsert({
    where: { key },
    create: { key, value: stored, encrypted: spec.secret, updatedBy },
    update: { value: stored, encrypted: spec.secret, updatedBy },
  });
  invalidateSettingsCache();
}
