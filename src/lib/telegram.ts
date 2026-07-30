// Telegram publishing via the Bot API. The credential is a bot token (from
// @BotFather) plus the target channel/chat id — the bot must be an admin of the
// channel. No OAuth. Validated at connect with getMe + getChat so a bad token or
// an inaccessible chat fails loudly instead of being stored.

import { StoredFile, readStoredFile } from "./upload";
import { PostType } from "./platforms";

const API = "https://api.telegram.org";
const TOKEN_RE = /^\d{6,}:[A-Za-z0-9_-]{30,}$/;
const CAPTION_MAX = 1024; // media caption limit; plain text messages allow 4096

interface TgResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function tg<T>(token: string, method: string, body: FormData | Record<string, unknown>): Promise<T> {
  const init: RequestInit =
    body instanceof FormData
      ? { method: "POST", body }
      : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  const res = await fetch(`${API}/bot${token}/${method}`, init);
  const data = (await res.json().catch(() => ({ ok: false }))) as TgResponse<T>;
  if (!data.ok) throw new Error(data.description || `Telegram ${method} failed (${res.status})`);
  return data.result as T;
}

export async function validateTelegram(
  token: string,
  chatId: string
): Promise<{ botId: string; chatTitle: string }> {
  if (!TOKEN_RE.test(token)) {
    throw new Error("That doesn't look like a Telegram bot token (from @BotFather, e.g. 123456789:AA…)");
  }
  if (!chatId) {
    throw new Error("Provide the channel/chat id (e.g. @yourchannel or -1001234567890)");
  }
  const me = await tg<{ id: number }>(token, "getMe", {});
  // The bot only sees a chat it belongs to — verifying it here means we never
  // store a connection that can't actually post.
  try {
    const chat = await tg<{ title?: string; username?: string }>(token, "getChat", { chat_id: chatId });
    const chatTitle = chat.title || (chat.username ? `@${chat.username}` : chatId);
    return { botId: String(me.id), chatTitle };
  } catch (err) {
    throw new Error(
      `Bot can't access ${chatId} — add it to the channel as an admin first (${err instanceof Error ? err.message : "getChat failed"})`
    );
  }
}

interface RawChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}
interface RawUpdate {
  message?: { chat?: RawChat };
  channel_post?: { chat?: RawChat };
  edited_channel_post?: { chat?: RawChat };
  my_chat_member?: { chat?: RawChat };
}

export interface TelegramChat {
  id: string; // the value to store: @username for public, else the numeric id
  title: string;
}

// Lists channels/groups the bot has recently seen (from getUpdates), so the user
// can pick instead of hunting for a numeric id. Adding the bot as admin fires a
// my_chat_member update, so it often appears without posting anything.
export async function detectChats(token: string): Promise<TelegramChat[]> {
  if (!TOKEN_RE.test(token)) {
    throw new Error("Enter the bot token first, then detect.");
  }
  let updates: RawUpdate[];
  try {
    updates = await tg<RawUpdate[]>(token, "getUpdates", {
      allowed_updates: ["message", "channel_post", "my_chat_member"],
      limit: 100,
    });
  } catch (err) {
    throw new Error(
      `Couldn't read the bot's updates (${err instanceof Error ? err.message : "getUpdates failed"}). ` +
        "Make sure the bot has no webhook set, then post a message in your channel and retry."
    );
  }

  const byId = new Map<string, TelegramChat>();
  for (const u of updates) {
    const chat = u.channel_post?.chat ?? u.edited_channel_post?.chat ?? u.my_chat_member?.chat ?? u.message?.chat;
    if (!chat || !["channel", "group", "supergroup"].includes(chat.type)) continue;
    const id = chat.username ? `@${chat.username}` : String(chat.id);
    byId.set(id, { id, title: chat.title ?? id });
  }
  return [...byId.values()];
}

export interface TelegramPublishInput {
  token: string;
  chatId: string;
  type: PostType;
  media: StoredFile[];
  text: string;
}

export async function publishToTelegram(
  input: TelegramPublishInput
): Promise<{ url: string; externalId: string }> {
  const { token, chatId, type, media, text } = input;
  let messageId: number | undefined;

  if (type === "text" || media.length === 0) {
    const msg = await tg<{ message_id: number }>(token, "sendMessage", {
      chat_id: chatId,
      text: text.slice(0, 4096),
    });
    messageId = msg.message_id;
  } else if (media.length === 1) {
    const method = type === "video" ? "sendVideo" : "sendPhoto";
    const field = type === "video" ? "video" : "photo";
    const form = new FormData();
    form.set("chat_id", chatId);
    form.set("caption", text.slice(0, CAPTION_MAX));
    const buf = await readStoredFile(media[0]);
    form.set(field, new Blob([new Uint8Array(buf)]), media[0].name || field);
    const msg = await tg<{ message_id: number }>(token, method, form);
    messageId = msg.message_id;
  } else {
    // Album: sendMediaGroup with each file attached via attach://<name>.
    const form = new FormData();
    form.set("chat_id", chatId);
    const items: Record<string, unknown>[] = [];
    for (let i = 0; i < media.length && i < 10; i++) {
      const buf = await readStoredFile(media[i]);
      const name = `file${i}`;
      form.set(name, new Blob([new Uint8Array(buf)]), media[i].name || name);
      items.push({
        type: media[i].mime.startsWith("video") ? "video" : "photo",
        media: `attach://${name}`,
        ...(i === 0 ? { caption: text.slice(0, CAPTION_MAX) } : {}),
      });
    }
    form.set("media", JSON.stringify(items));
    const msgs = await tg<{ message_id: number }[]>(token, "sendMediaGroup", form);
    messageId = msgs[0]?.message_id;
  }

  // Public channels (@username) have shareable message URLs; private chats don't.
  const url = messageId && chatId.startsWith("@") ? `https://t.me/${chatId.slice(1)}/${messageId}` : "";
  return { url, externalId: messageId ? String(messageId) : "" };
}
