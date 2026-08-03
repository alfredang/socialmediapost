// Single source of truth for what the upload composer's side panel shows.
//
// This used to be half a dozen inline expressions scattered through the JSX,
// each deriving state from a different input — `method` here, `files.length`
// there, `postType` somewhere else. They drifted: a text-only post still
// rendered the previously-selected image, and the summary line claimed
// "Attached File" when nothing was attached. One pure function, one set of
// rules, and tests/composer-preview.test.mts pins the behaviour.

import { PostType } from "./platforms";

export type ComposerMethod = "file" | "url" | "text";

// Structurally satisfied by a real File, so the component passes File[] and
// tests pass plain objects — no DOM needed to test this.
export interface ComposerFile {
  name: string;
  type: string;
}

export interface ComposerState {
  method: ComposerMethod;
  files: ComposerFile[];
  mediaUrls: string; // newline-separated
}

export interface ComposerPreview {
  postType: PostType;
  /** Media the post will actually carry (text posts never carry any). */
  hasMedia: boolean;
  /** Whether the side panel renders its media box at all. */
  showMediaBox: boolean;
  /** Index into `files` for the thumbnail, or null when there isn't one. */
  thumbnailIndex: number | null;
  /** The "· …" clause after the schedule line. */
  mediaSummary: string;
  typeLabel: string;
  /** Submit must be blocked: a media post with no media. */
  mediaMissing: boolean;
  /** Header badge: "Ready" vs "Media pending". */
  ready: boolean;
}

const VIDEO_URL_RE = /\.(mp4|mov|webm|m4v)(\?|#|$)/i;

export function parseMediaUrls(raw: string): string[] {
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function derivePreview(state: ComposerState): ComposerPreview {
  const { method, files } = state;

  // Text mode ignores any file selection completely. The files stay in
  // component state so switching back to file mode restores them, but they are
  // not part of this post — not shown, not counted, not uploaded.
  if (method === "text") {
    return {
      postType: "text",
      hasMedia: false,
      showMediaBox: false,
      thumbnailIndex: null,
      mediaSummary: "Text-only",
      typeLabel: "Post",
      mediaMissing: false,
      ready: true,
    };
  }

  const urls = method === "url" ? parseMediaUrls(state.mediaUrls) : [];
  const hasFiles = files.length > 0;
  const hasUrls = urls.length > 0;
  const hasMedia = hasFiles || hasUrls;

  const isVideo =
    files.some((f) => f.type.startsWith("video")) || urls.some((u) => VIDEO_URL_RE.test(u));

  // With nothing chosen yet the composer sits in its default video posture —
  // that drives which platforms are listed as eligible, so it must stay stable
  // rather than flipping as the first file lands.
  const postType: PostType = isVideo ? "video" : hasMedia ? "photos" : "video";

  const thumbnail = files.findIndex((f) => f.type.startsWith("image"));

  const mediaSummary = hasFiles
    ? `${files.length} attached file${files.length > 1 ? "s" : ""}`
    : hasUrls
      ? `${urls.length} media URL${urls.length > 1 ? "s" : ""}`
      : "No media yet";

  return {
    postType,
    hasMedia,
    showMediaBox: true,
    thumbnailIndex: thumbnail >= 0 ? thumbnail : null,
    mediaSummary,
    typeLabel: postType === "video" ? "Video" : "Photos",
    mediaMissing: !hasMedia,
    ready: hasMedia,
  };
}
