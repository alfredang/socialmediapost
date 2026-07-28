// Discord publishing via an incoming webhook URL — no OAuth. The webhook URL is
// the credential; we read it once at connect to validate it and capture the
// channel/guild for building message permalinks. Nothing is ever simulated: a
// bad URL or an oversized file fails loudly.

import { StoredFile, readStoredFile } from "./upload";
import { PostType } from "./platforms";

// Default webhook attachment cap for non-boosted servers.
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_CONTENT = 2000;

const WEBHOOK_RE = /^https:\/\/(?:discord|discordapp)\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+/;

export interface DiscordWebhookInfo {
  id: string;
  name: string;
  channelId?: string;
  guildId?: string;
}

// Validate a webhook URL by reading it (a GET on a webhook returns its metadata
// and sends no message).
export async function validateDiscordWebhook(url: string): Promise<DiscordWebhookInfo> {
  if (!WEBHOOK_RE.test(url)) {
    throw new Error("That doesn't look like a Discord webhook URL (https://discord.com/api/webhooks/…)");
  }
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data.message || "Discord rejected that webhook URL — check it's correct and not deleted");
  }
  return {
    id: String(data.id),
    name: data.name || "Discord webhook",
    channelId: data.channel_id,
    guildId: data.guild_id,
  };
}

export interface DiscordPublishInput {
  webhookUrl: string;
  meta?: string | null; // JSON { channelId, guildId } captured at connect
  type: PostType;
  media: StoredFile[];
  content: string;
}

export async function publishToDiscord(
  input: DiscordPublishInput
): Promise<{ url: string; externalId: string }> {
  const { webhookUrl, type, media, content } = input;
  // ?wait=true makes Discord return the created message (so we get its id).
  const endpoint = new URL(webhookUrl);
  endpoint.searchParams.set("wait", "true");

  let res: Response;
  if (type === "text" || media.length === 0) {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content: content.slice(0, MAX_CONTENT) }),
    });
  } else {
    const form = new FormData();
    form.set("payload_json", JSON.stringify({ content: content.slice(0, MAX_CONTENT) }));
    let i = 0;
    for (const file of media.slice(0, 10)) {
      const buf = await readStoredFile(file);
      if (buf.byteLength > MAX_ATTACHMENT_BYTES) {
        throw new Error(
          `"${file.name}" is ${(buf.byteLength / 1048576).toFixed(1)}MB — over Discord's 8MB webhook limit`
        );
      }
      form.append(`files[${i}]`, new Blob([new Uint8Array(buf)]), file.name || `file${i}`);
      i++;
    }
    res = await fetch(endpoint, { method: "POST", body: form });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) {
    throw new Error(data.message || `Discord webhook post failed (${res.status})`);
  }

  const meta = input.meta ? (JSON.parse(input.meta) as { channelId?: string; guildId?: string }) : {};
  const url =
    meta.guildId && meta.channelId
      ? `https://discord.com/channels/${meta.guildId}/${meta.channelId}/${data.id}`
      : "";
  return { url, externalId: String(data.id) };
}
