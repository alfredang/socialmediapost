// Dev.to (Forem) publishing via a personal API key — no OAuth, no app
// registration, no review. The key is generated at
// https://dev.to/settings/extensions under "DEV Community API Keys" and is the
// entire credential.
//
// Dev.to is a "titled" platform: the composer's title and body stay separate,
// and the body is posted as Markdown.

const API = "https://dev.to/api";

// Dev.to caps an article at 4 tags.
const MAX_TAGS = 4;

async function devtoFetch(apiKey: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      "api-key": apiKey,
      accept: "application/vnd.forem.api-v1+json",
    },
  });
}

// Validate by reading the key's own user. This is a plain GET — it publishes
// nothing and creates nothing.
export async function validateDevto(
  rawKey: string
): Promise<{ id: string; username: string; name: string }> {
  const apiKey = rawKey.trim();
  if (!apiKey) throw new Error("Enter your Dev.to API key");

  const res = await devtoFetch(apiKey, "/users/me");
  if (res.status === 401) {
    throw new Error(
      "Dev.to rejected that API key. Generate one at dev.to → Settings → Extensions → DEV Community API Keys."
    );
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.username) {
    throw new Error(data.error || `Dev.to rejected the request (${res.status})`);
  }
  return { id: String(data.id), username: data.username, name: data.name || data.username };
}

// On Dev.to tags are metadata, not inline text — they must be lowercase
// alphanumeric, and anything else is rejected. Derived from the hashtags the
// author already wrote rather than asking for them twice.
// The leading (^|\s) matters: without it a URL fragment like
// "example.com/page#section" turns into a bogus "section" tag.
export function devtoTags(text: string): string[] {
  const found = [...text.matchAll(/(?:^|\s)#([\p{L}\p{N}_]+)/gu)];
  const tags = new Set<string>();
  for (const match of found) {
    const slug = match[1].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (slug) tags.add(slug);
    if (tags.size >= MAX_TAGS) break;
  }
  return [...tags];
}

export interface DevtoPublishInput {
  apiKey: string;
  title: string;
  bodyMarkdown: string;
}

export async function publishToDevto(
  input: DevtoPublishInput
): Promise<{ url: string; externalId: string }> {
  const { apiKey, title, bodyMarkdown } = input;
  if (!title.trim()) throw new Error("Dev.to articles need a title");

  const res = await devtoFetch(apiKey, "/articles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      article: {
        title,
        body_markdown: bodyMarkdown,
        published: true,
        tags: devtoTags(`${title} ${bodyMarkdown}`),
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.url) {
    // 422 carries per-field validation detail; keep whatever Dev.to said.
    const detail = data.error || (data.errors ? JSON.stringify(data.errors) : "");
    throw new Error(`Dev.to rejected the article (${res.status})${detail ? ` — ${detail}` : ""}`);
  }
  return { url: String(data.url), externalId: String(data.id) };
}
