// Platform registry: constraints + content adaptation for every supported network.
// Real publishing lives in src/lib/publishers.ts — platforms without an entry
// there are listed for their constraints/adaptation rules but cannot publish yet.

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
  // Content model, driving both adaptation and the composer's field labels:
  //   "titled"  — a real, separate title field (YouTube, Reddit, blogs).
  //   "caption" — title & body both feed the caption; stored apart but there is
  //               no true title (Instagram, TikTok, Facebook, LinkedIn).
  //   "merge"   — a single message with no title concept (X, chat/webhook
  //               platforms); the title is folded into the one body.
  // Only "merge" collapses the title into the body during adaptation.
  titleRole: "titled" | "caption" | "merge";
  notes: string;
}

export const PLATFORMS: PlatformDef[] = [
  { id: "tiktok", name: "TikTok", color: "#010101", emoji: "🎵", supports: ["video", "photos"], titleMax: 150, bodyMax: 2200, photosMax: 35, videoMaxSeconds: 600, firstComment: false, hashtagStyle: "inline", titleRole: "caption", notes: "MP4/WebM, 9:16 preferred, max 10 min" },
  { id: "instagram", name: "Instagram", color: "#E4405F", emoji: "📸", supports: ["video", "photos"], titleMax: 2200, bodyMax: 2200, photosMax: 10, videoMaxSeconds: 900, firstComment: true, hashtagStyle: "first-comment", titleRole: "caption", notes: "Reels ≤15 min, carousel ≤10 images" },
  { id: "youtube", name: "YouTube", color: "#FF0000", emoji: "▶️", supports: ["video"], titleMax: 100, bodyMax: 5000, photosMax: 0, videoMaxSeconds: 43200, firstComment: true, hashtagStyle: "end", titleRole: "titled", notes: "Title ≤100 chars, description ≤5000" },
  { id: "linkedin", name: "LinkedIn", color: "#0A66C2", emoji: "💼", supports: ["video", "photos", "text", "document"], titleMax: 3000, bodyMax: 3000, photosMax: 9, videoMaxSeconds: 600, firstComment: true, hashtagStyle: "end", titleRole: "caption", notes: "Posts ≤3000 chars, documents ≤100MB/300 pages" },
  { id: "facebook", name: "Facebook", color: "#1877F2", emoji: "👥", supports: ["video", "photos", "text"], titleMax: 63206, bodyMax: 63206, photosMax: 10, videoMaxSeconds: 14400, firstComment: true, hashtagStyle: "end", titleRole: "caption", notes: "Pages posting, Reels ≤90s or video ≤4h" },
  { id: "x", name: "X", color: "#000000", emoji: "✖️", supports: ["video", "photos", "text"], titleMax: 280, bodyMax: 280, photosMax: 4, videoMaxSeconds: 140, firstComment: true, hashtagStyle: "inline", titleRole: "merge", notes: "280 weighted chars, ≤4 images, video ≤2:20" },
  { id: "threads", name: "Threads", color: "#000000", emoji: "🧵", supports: ["video", "photos", "text"], titleMax: 500, bodyMax: 500, photosMax: 20, videoMaxSeconds: 300, firstComment: true, hashtagStyle: "inline", titleRole: "merge", notes: "500 chars, video ≤5 min" },
  { id: "pinterest", name: "Pinterest", color: "#BD081C", emoji: "📌", supports: ["video", "photos"], titleMax: 100, bodyMax: 500, photosMax: 5, videoMaxSeconds: 900, firstComment: false, hashtagStyle: "none", titleRole: "titled", notes: "Pin title ≤100, description ≤500, board required" },
  { id: "reddit", name: "Reddit", color: "#FF4500", emoji: "👽", supports: ["video", "photos", "text"], titleMax: 300, bodyMax: 40000, photosMax: 20, videoMaxSeconds: 900, firstComment: true, hashtagStyle: "none", titleRole: "titled", notes: "Title ≤300, subreddit required" },
  { id: "bluesky", name: "Bluesky", color: "#0285FF", emoji: "🦋", supports: ["video", "photos", "text"], titleMax: 300, bodyMax: 300, photosMax: 4, videoMaxSeconds: 180, firstComment: true, hashtagStyle: "inline", titleRole: "merge", notes: "300 graphemes, images ≤1MB each, video ≤3 min" },
  { id: "google_business", name: "Google Business", color: "#4285F4", emoji: "🏢", supports: ["video", "photos", "text"], titleMax: 1500, bodyMax: 1500, photosMax: 10, videoMaxSeconds: 30, firstComment: false, hashtagStyle: "none", titleRole: "merge", notes: "Business profile updates ≤1500 chars" },
  { id: "discord", name: "Discord", color: "#5865F2", emoji: "🎮", supports: ["video", "photos", "text"], titleMax: 2000, bodyMax: 2000, photosMax: 10, videoMaxSeconds: 600, firstComment: false, hashtagStyle: "none", titleRole: "merge", notes: "Webhook message ≤2000 chars" },
  { id: "telegram", name: "Telegram", color: "#26A5E4", emoji: "✈️", supports: ["video", "photos", "text"], titleMax: 4096, bodyMax: 4096, photosMax: 10, videoMaxSeconds: 3600, firstComment: false, hashtagStyle: "inline", titleRole: "merge", notes: "Channel post ≤4096 chars (1024 caption)" },
  { id: "slack", name: "Slack", color: "#4A154B", emoji: "💬", supports: ["text"], titleMax: 4000, bodyMax: 4000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "none", titleRole: "merge", notes: "Channel message via webhook" },
  { id: "mastodon", name: "Mastodon", color: "#6364FF", emoji: "🐘", supports: ["video", "photos", "text"], titleMax: 500, bodyMax: 500, photosMax: 4, videoMaxSeconds: 300, firstComment: true, hashtagStyle: "inline", titleRole: "merge", notes: "500 chars default instance limit" },
  { id: "nostr", name: "Nostr", color: "#8E44AD", emoji: "🟣", supports: ["text"], titleMax: 10000, bodyMax: 10000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "inline", titleRole: "merge", notes: "Plain-text notes, media via links" },
  { id: "lemmy", name: "Lemmy", color: "#00BC8C", emoji: "🐭", supports: ["photos", "text"], titleMax: 200, bodyMax: 10000, photosMax: 1, videoMaxSeconds: 0, firstComment: true, hashtagStyle: "none", titleRole: "titled", notes: "Community post, title ≤200" },
  { id: "devto", name: "Dev.to", color: "#0A0A0A", emoji: "👩‍💻", supports: ["text"], titleMax: 128, bodyMax: 100000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "end", titleRole: "titled", notes: "Markdown articles, ≤4 tags" },
  { id: "hashnode", name: "Hashnode", color: "#2962FF", emoji: "📝", supports: ["text"], titleMax: 250, bodyMax: 100000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "end", titleRole: "titled", notes: "Markdown blog posts" },
  { id: "wordpress", name: "WordPress", color: "#21759B", emoji: "🌐", supports: ["video", "photos", "text"], titleMax: 200, bodyMax: 100000, photosMax: 20, videoMaxSeconds: 3600, firstComment: false, hashtagStyle: "none", titleRole: "titled", notes: "Self-hosted or .com blog posts" },
  { id: "whop", name: "Whop", color: "#FF6243", emoji: "🛍️", supports: ["text"], titleMax: 300, bodyMax: 10000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "none", titleRole: "titled", notes: "Community forum posts" },
  { id: "listmonk", name: "Listmonk", color: "#0055D4", emoji: "📧", supports: ["text"], titleMax: 200, bodyMax: 100000, photosMax: 0, videoMaxSeconds: 0, firstComment: false, hashtagStyle: "none", titleRole: "titled", notes: "Email campaign to subscriber list" },
];

// Null prototype — indexed by caller- and DB-supplied platform ids, so an
// inherited name like "constructor" must miss rather than return a truthy
// non-PlatformDef. Object.fromEntries yields a normal object, hence the copy.
export const PLATFORM_MAP: Record<string, PlatformDef> = Object.assign(
  Object.create(null),
  Object.fromEntries(PLATFORMS.map((p) => [p.id, p]))
);

// ── Connectable platforms ────────────────────────────────────────────────────
// The two lists below are the single source of truth for "can this platform be
// connected at all". Every UI availability check derives from them, and
// publishers.ts `satisfies Record<ConnectablePlatform, …>` — so adding an id
// here without shipping a publisher (or vice versa) is a compile error, not a
// grey button that silently lies.

// Connected through a real OAuth redirect (/api/auth/<platform>).
export const OAUTH_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "tiktok",
  "youtube",
  "threads",
] as const;
export const OAUTH_PLATFORM_SET: ReadonlySet<string> = new Set(OAUTH_PLATFORMS);

// Connected by pasting a credential (webhook URL / token / app password) rather
// than an OAuth redirect. The Users page shows these a credential form instead
// of a "Connect" redirect, and /api/internal/social-accounts validates + stores
// them. These need a session, so they are NOT offered on the whitelabel
// /connect page — an end user there can only run OAuth.
export const CREDENTIAL_PLATFORMS = [
  "discord",
  "slack",
  "telegram",
  "bluesky",
  "devto",
  "hashnode",
  "wordpress",
  "mastodon",
  "listmonk",
] as const;
export const CREDENTIAL_PLATFORM_SET: ReadonlySet<string> = new Set(CREDENTIAL_PLATFORMS);

export type CredentialPlatform = (typeof CREDENTIAL_PLATFORMS)[number];

export type ConnectablePlatform = (typeof OAUTH_PLATFORMS)[number] | CredentialPlatform;

export const CONNECTABLE_PLATFORM_SET: ReadonlySet<string> = new Set<string>([
  ...OAUTH_PLATFORMS,
  ...CREDENTIAL_PLATFORMS,
]);

// ── Analytics capability ─────────────────────────────────────────────────────
// The metrics SocialPost can actually collect for each platform, in display
// order. This is the single source of truth for the analytics dashboard and the
// public platform-metrics API — a platform only shows the metrics listed here,
// so nothing is rendered as an empty "—" column just because the grid has room.
//
// `source` says where the number comes from:
//   account — the daily AnalyticsSnapshot (audience-level, e.g. followers)
//   post    — summed across the period's published posts (engagement)
//
// Notable per-platform realities baked in here:
//   * Instagram reports "views", NOT "impressions" — Meta removed the
//     impressions metric from IG insights in Graph API v22 (2025).
//   * TikTok exposes lifetime "Total Likes" at the account level; per-post
//     engagement (views/comments/shares) comes from the video query API.
//   * LinkedIn only exposes per-post likes/comments to non-partner apps —
//     member follower/impression insights are gated, so there is no account row.

export type MetricSource = "account" | "post";
export type MetricKey =
  | "followers"
  | "reach"
  | "impressions"
  | "views"
  | "likes"
  | "comments"
  | "shares";

export interface AnalyticsMetric {
  key: MetricKey;
  label: string;
  source: MetricSource;
}

export const ANALYTICS_METRICS: Record<string, AnalyticsMetric[]> = {
  instagram: [
    { key: "followers", label: "Followers", source: "account" },
    { key: "reach", label: "Reach", source: "account" },
    { key: "views", label: "Views", source: "account" },
    { key: "likes", label: "Likes", source: "post" },
    { key: "comments", label: "Comments", source: "post" },
    { key: "shares", label: "Shares", source: "post" },
  ],
  facebook: [
    { key: "followers", label: "Followers", source: "account" },
    { key: "reach", label: "Reach", source: "account" },
    { key: "impressions", label: "Impressions", source: "account" },
    { key: "likes", label: "Likes", source: "post" },
    { key: "comments", label: "Comments", source: "post" },
    { key: "shares", label: "Shares", source: "post" },
  ],
  tiktok: [
    { key: "followers", label: "Followers", source: "account" },
    { key: "likes", label: "Total Likes", source: "account" },
    { key: "views", label: "Views", source: "post" },
    { key: "comments", label: "Comments", source: "post" },
    { key: "shares", label: "Shares", source: "post" },
  ],
  linkedin: [
    { key: "likes", label: "Likes", source: "post" },
    { key: "comments", label: "Comments", source: "post" },
  ],
};

// Metrics for a platform, or [] when SocialPost has no collector for it.
export function analyticsMetricsFor(platformId: string): AnalyticsMetric[] {
  return ANALYTICS_METRICS[platformId] ?? [];
}

export function platformsForType(type: PostType): PlatformDef[] {
  return PLATFORMS.filter((p) => p.supports.includes(type));
}

// ── Hashtags ─────────────────────────────────────────────────────────────────
// One definition of "what is a hashtag", used by adaptContent and by every
// adapter that turns hashtags into platform tag metadata.
//
// The leading (^|\s) is the whole point: matching a bare '#' anywhere treats a
// URL fragment as a tag, so "docs#install" yields "install" — which published
// junk tags on Dev.to/Hashnode and, worse, let the strip below cut "#install"
// out of the middle of a link.
const HASHTAG_RE = /(^|\s)#([\p{L}\p{N}_]+)/gu;

/** Hashtag names the author actually wrote, without the leading '#'. */
export function extractHashtags(text: string): string[] {
  return [...text.matchAll(HASHTAG_RE)].map((m) => m[2]);
}

/** Removes those same hashtags (and the space before them) — never touches a URL. */
export function stripHashtags(text: string): string {
  return text.replace(HASHTAG_RE, "").trim();
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
  const hashtags = extractHashtags(`${title} ${body}`);
  if (def.hashtagStyle === "first-comment" && def.firstComment && hashtags.length > 0 && !firstComment) {
    // Move hashtags out of the caption into the first comment (Instagram convention)
    firstComment = hashtags.map((t) => `#${t}`).join(" ");
    title = stripHashtags(title);
    body = stripHashtags(body);
    warnings.push("Hashtags moved to first comment");
  }
  if (def.hashtagStyle === "none" && hashtags.length > 0) {
    warnings.push("Hashtags have no effect on this platform");
  }

  // Message platforms with no title concept (X, chat/webhook, …): fold title into
  // the one body so there's no stray pseudo-heading. Driven by an explicit
  // titleRole, not a character-limit guess (which mis-handled Discord/Slack/
  // Telegram, whose limits are well over 500).
  if (def.titleRole === "merge") {
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

// Media constraint checks that real platform APIs would reject anyway — fail
// fast with a friendly message instead. Files with mime "url" are remote-URL
// stubs whose real type is unknown, so mime checks skip them. videoMaxSeconds
// cannot be checked here (StoredFile has no duration; no ffprobe available) —
// the platform's own rejection lands in the target error instead.
export function validateMediaForPlatform(
  def: PlatformDef,
  type: PostType,
  media: { name: string; mime: string }[]
): void {
  if (type === "video") {
    if (media.length === 0) throw new Error(`No video file to publish to ${def.name}`);
    const bad = media[0].mime !== "url" && !media[0].mime.startsWith("video/");
    if (bad) throw new Error(`"${media[0].name}" is not a video file`);
  }
  if (type === "photos") {
    if (media.length === 0) throw new Error(`No photos to publish to ${def.name}`);
    if (media.length > def.photosMax) {
      throw new Error(`${def.name} allows at most ${def.photosMax} photos per post (got ${media.length})`);
    }
    const bad = media.find((f) => f.mime !== "url" && !f.mime.startsWith("image/"));
    if (bad) throw new Error(`"${bad.name}" is not an image file`);
  }
  if (type === "document" && media.length === 0) {
    throw new Error(`No document to publish to ${def.name}`);
  }
}
