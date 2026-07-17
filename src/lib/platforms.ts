// Platform registry: constraints + content adaptation for every supported network.
// publish() is simulated; swap the body with a real API call per platform to go live.

export type PostType = "video" | "photos" | "text" | "document";

export interface PlatformDef {
  id: string;
  name: string;
  color: string; // brand hex for icons/chips
  emoji: string; // lightweight icon fallback
  supports: PostType[];
  titleMax: number; // grapheme limit for title/primary text
  bodyMax: number; // description/body limit (0 = unsupported)
  photosMax: number;
  videoMaxSeconds: number;
  firstComment: boolean;
  hashtagStyle: "inline" | "end" | "first-comment" | "none";
  notes: string;
}

export const PLATFORMS: PlatformDef[] = [
  { id: "tiktok", name: "TikTok", color: "#010101", emoji: "🎵", supports: ["video", "photos"], titleMax: 150, bodyMax: 2200, photosMax: 35, videoMaxSeconds: 600, firstComment: false, hashtagStyle: "inline", notes: "MP4/WebM, 9:16 preferred, max 10 min" },
  { id: "instagram", name: "Instagram", color: "#E4405F", emoji: "📸", supports: ["video", "photos"], titleMax: 2200, bodyMax: 2200, photosMax: 10, videoMaxSeconds: 900, firstComment: true, hashtagStyle: "first-comment", notes: "Reels ≤15 min, carousel ≤10 images" },
  { id: "youtube", name: "YouTube", color: "#FF0000", emoji: "▶️", supports: ["video"], titleMax: 100, bodyMax: 5000, photosMax: 0, videoMaxSeconds: 43200, firstComment: true, hashtagStyle: "end", notes: "Title ≤100 chars, description ≤5000" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", emoji: "💼", supports: ["video", "photos", "text", "document"], titleMax: 3000, bodyMax: 3000, photosMax: 9, videoMaxSeconds: 600, firstComment: true, hashtagStyle: "end", notes: "Posts ≤3000 chars, documents ≤100MB/300 pages" },
  { id: "facebook", name: "Facebook", color: "#1877F2", emoji: "👥", supports: ["video", "photos", "text"], titleMax: 63206, bodyMax: 63206, photosMax: 10, videoMaxSeconds: 14400, firstComment: true, hashtagStyle: "end", notes: "Pages posting, Reels ≤90s or video ≤4h" },
  { id: "x", name: "X", color: "#000000", emoji: "✖️", supports: ["video", "photos", "text"], titleMax: 280, bodyMax: 280, photosMax: 4, videoMaxSeconds: 140, firstComment: true, hashtagStyle: "inline", notes: "280 weighted chars, ≤4 images, video ≤2:20" },
  { id: "threads", name: "Threads", color: "#000000", emoji: "🧵", supports: ["video", "photos", "text"], titleMax: 500, bodyMax: 500, photosMax: 20, videoMaxSeconds: 300, firstComment: true, hashtagStyle: "inline", notes: "500 chars, video ≤5 min" },
  { id: "pinterest", name: "Pinterest", color: "#BD081C", emoji: "📌", supports: ["video", "photos"], titleMax: 100, bodyMax: 500, photosMax: 5, videoMaxSeconds: 900, firstComment: false, hashtagStyle: "none", notes: "Pin title ≤100, description ≤500, board required" },
  { id: "reddit", name: "Reddit", color: "#FF4500", emoji: "👽", supports: ["video", "photos", "text"], titleMax: 300, bodyMax: 40000, photosMax: 20, videoMaxSeconds: 900, firstComment: true, hashtagStyle: "none", notes: "Title ≤300, subreddit required" },
  { id: "bluesky", name: "Bluesky", color: "#0285FF", emoji: "🦋", supports: ["video", "photos", "text"], titleMax: 300, bodyMax: 300, photosMax: 4, videoMaxSeconds: 60, firstComment: true, hashtagStyle: "inline", notes: "300 graphemes, video ≤60s" },
  { id: "google_business", name: "Google Business", color: "#4285F4", emoji: "🏢", supports: ["video", "photos", "text"], titleMax: 1500, bodyMax: 1500, photosMax: 10, videoMaxSeconds: 30, firstComment: false, hashtagStyle: "none", notes: "Business profile updates ≤1500 chars" },
  { id: "discord", name: "Discord", color: "#5865F2", emoji: "🎮", supports: ["video", "photos", "text"], titleMax: 2000, bodyMax: 2000, photosMax: 10, videoMaxSeconds: 600, firstComment: false, hashtagStyle: "none", notes: "Webhook message ≤2000 chars" },
  { id: "telegram", name: "Telegram", color: "#26A5E4", emoji: "✈️", supports: ["video", "photos", "text"], titleMax: 4096, bodyMax: 4096, photosMax: 10, videoMaxSeconds: 3600, firstComment: false, hashtagStyle: "inline", notes: "Channel post ≤4096 chars (1024 caption)" },
  { id: "slack", name: "Slack", color: "#4A154B", emoji: "💬", supports: ["text"], titleMax: 4000, bodyMax: 4000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "none", notes: "Channel message via webhook" },
  { id: "mastodon", name: "Mastodon", color: "#6364FF", emoji: "🐘", supports: ["video", "photos", "text"], titleMax: 500, bodyMax: 500, photosMax: 4, videoMaxSeconds: 300, firstComment: true, hashtagStyle: "inline", notes: "500 chars default instance limit" },
  { id: "nostr", name: "Nostr", color: "#8E44AD", emoji: "🟣", supports: ["text"], titleMax: 10000, bodyMax: 10000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "inline", notes: "Plain-text notes, media via links" },
  { id: "lemmy", name: "Lemmy", color: "#00BC8C", emoji: "🐭", supports: ["photos", "text"], titleMax: 200, bodyMax: 10000, photosMax: 1, videoMaxSeconds: 0, firstComment: true, hashtagStyle: "none", notes: "Community post, title ≤200" },
  { id: "devto", name: "Dev.to", color: "#0A0A0A", emoji: "👩‍💻", supports: ["text"], titleMax: 128, bodyMax: 100000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "end", notes: "Markdown articles, ≤4 tags" },
  { id: "hashnode", name: "Hashnode", color: "#2962FF", emoji: "📝", supports: ["text"], titleMax: 250, bodyMax: 100000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "end", notes: "Markdown blog posts" },
  { id: "wordpress", name: "WordPress", color: "#21759B", emoji: "🌐", supports: ["video", "photos", "text"], titleMax: 200, bodyMax: 100000, photosMax: 20, videoMaxSeconds: 3600, firstComment: false, hashtagStyle: "none", notes: "Self-hosted or .com blog posts" },
  { id: "whop", name: "Whop", color: "#FF6243", emoji: "🛍️", supports: ["text"], titleMax: 300, bodyMax: 10000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "none", notes: "Community forum posts" },
  { id: "listmonk", name: "Listmonk", color: "#0055D4", emoji: "📧", supports: ["text"], titleMax: 200, bodyMax: 100000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "none", notes: "Email campaign to subscriber list" },
];

export const PLATFORM_MAP: Record<string, PlatformDef> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p])
);

export function platformsForType(type: PostType): PlatformDef[] {
  return PLATFORMS.filter((p) => p.supports.includes(type));
}

// Grapheme-aware length so emoji/CJK count like the real platforms do.
export function graphemeLength(text: string): number {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    return [...new Intl.Segmenter().segment(text)].length;
  }
  return [...text].length;
}

export function truncateGraphemes(text: string, max: number): string {
  if (graphemeLength(text) <= max) return text;
  const segs = [...new Intl.Segmenter().segment(text)].map((s) => s.segment);
  return segs.slice(0, Math.max(0, max - 1)).join("") + "…";
}

export interface AdaptInput {
  type: PostType;
  title: string;
  description: string;
  firstComment?: string;
  overrides?: Record<string, string>; // e.g. { instagram_title: "...", youtube_description: "..." }
}

export interface AdaptedContent {
  platform: string;
  title: string;
  body: string;
  firstComment: string;
  warnings: string[];
}

// "Auto-adapts content to each platform requirements"
export function adaptContent(platformId: string, input: AdaptInput): AdaptedContent {
  const def = PLATFORM_MAP[platformId];
  const warnings: string[] = [];
  const o = input.overrides ?? {};
  let title = o[`${platformId}_title`] ?? input.title;
  let body = o[`${platformId}_description`] ?? input.description;
  let firstComment = input.firstComment ?? "";

  // Hashtag handling
  const hashtags = (title + " " + body).match(/#[\p{L}\p{N}_]+/gu) ?? [];
  if (def.hashtagStyle === "first-comment" && def.firstComment && hashtags.length > 0 && !firstComment) {
    // Move hashtags out of the caption into the first comment (Instagram convention)
    firstComment = hashtags.join(" ");
    title = title.replace(/#[\p{L}\p{N}_]+\s*/gu, "").trim();
    body = body.replace(/#[\p{L}\p{N}_]+\s*/gu, "").trim();
    warnings.push("Hashtags moved to first comment");
  }
  if (def.hashtagStyle === "none" && hashtags.length > 0) {
    warnings.push("Hashtags have no effect on this platform");
  }

  // Single-text platforms (X, Threads, Bluesky, Mastodon…): merge title+body into one post
  if (def.titleMax === def.bodyMax && def.titleMax <= 500 && input.type === "text") {
    const merged = [title, body].filter(Boolean).join("\n\n");
    title = merged;
    body = "";
  }

  if (graphemeLength(title) > def.titleMax) {
    title = truncateGraphemes(title, def.titleMax);
    warnings.push(`Title truncated to ${def.titleMax} characters`);
  }
  if (def.bodyMax > 0 && graphemeLength(body) > def.bodyMax) {
    body = truncateGraphemes(body, def.bodyMax);
    warnings.push(`Description truncated to ${def.bodyMax} characters`);
  }
  if (firstComment && !def.firstComment) {
    warnings.push("First comment not supported; dropped");
    firstComment = "";
  }

  return { platform: platformId, title, body, firstComment, warnings };
}

// Simulated network publish. Replace with the platform's real API call.
export async function publishToPlatform(
  platformId: string,
  handle: string,
  adapted: AdaptedContent
): Promise<{ url: string; externalId: string }> {
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 350));
  const externalId = `${platformId}_${Math.random().toString(36).slice(2, 12)}`;
  const urls: Record<string, string> = {
    tiktok: `https://www.tiktok.com/@${handle}/video/${externalId}`,
    instagram: `https://www.instagram.com/p/${externalId}/`,
    youtube: `https://www.youtube.com/watch?v=${externalId}`,
    linkedin: `https://www.linkedin.com/feed/update/urn:li:share:${externalId}`,
    facebook: `https://www.facebook.com/${handle}/posts/${externalId}`,
    x: `https://x.com/${handle}/status/${externalId}`,
    threads: `https://www.threads.net/@${handle}/post/${externalId}`,
    pinterest: `https://www.pinterest.com/pin/${externalId}/`,
    reddit: `https://www.reddit.com/r/${handle}/comments/${externalId}/`,
    bluesky: `https://bsky.app/profile/${handle}/post/${externalId}`,
    mastodon: `https://mastodon.social/@${handle}/${externalId}`,
  };
  return { url: urls[platformId] ?? `https://${platformId}.example.com/${handle}/${externalId}`, externalId };
}
