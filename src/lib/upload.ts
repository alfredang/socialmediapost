import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { safeFetch } from "./safe-fetch";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export interface StoredFile {
  path: string; // relative key under uploads/
  name: string;
  size: number;
  mime: string;
}

export async function saveUploadedFile(file: File): Promise<StoredFile> {
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name) || "";
  const key = `${Date.now()}-${randomBytes(6).toString("hex")}${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, key), buf);
  return { path: key, name: file.name, size: file.size, mime: file.type };
}

export function uploadDir() {
  return UPLOAD_DIR;
}

// Client-supplied media can't be trusted verbatim: a forged `path` would let a
// publish read/serve an arbitrary server file. Uploaded keys are basename-only
// (`<ts>-<hex>.<ext>`), so reject anything with a separator, and only accept URL
// stubs that are real http(s) URLs. Shared by the pipeline + post APIs.
export function sanitizeStoredMedia(raw: unknown): StoredFile[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredFile[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const rec = m as Record<string, unknown>;
    const mime = String(rec.mime ?? "");
    if (mime === "url") {
      const name = String(rec.name ?? "");
      if (/^https?:\/\//i.test(name)) out.push({ path: "", name, size: 0, mime: "url" });
    } else {
      const path = String(rec.path ?? "");
      if (/^[A-Za-z0-9._-]+$/.test(path)) {
        out.push({
          path,
          name: String(rec.name ?? path),
          size: Number(rec.size) || 0,
          mime: mime || "application/octet-stream",
        });
      }
    }
  }
  return out;
}

// A fresh collision-free key under uploads/, for files this server generates
// itself (e.g. FFmpeg output) rather than receiving from a client.
export function newUploadKey(ext: string): string {
  const suffix = ext.startsWith(".") ? ext : `.${ext}`;
  return `${Date.now()}-${randomBytes(6).toString("hex")}${suffix}`;
}

export function uploadPath(key: string): string {
  return path.join(UPLOAD_DIR, key);
}

export async function ensureUploadDir(): Promise<void> {
  await mkdir(UPLOAD_DIR, { recursive: true });
}

// Ceiling for anything fetched from a caller-supplied URL. safeFetch decides
// WHICH hosts may be reached; this bounds WHAT they may send back. Without it
// arrayBuffer() buffers the whole response into memory before any per-platform
// limit (Discord 8MB, Bluesky 1MB) gets a chance to reject it — and those run
// after the download, so they never protect this step.
export const MAX_MEDIA_BYTES = 200 * 1024 * 1024;

const mb = (n: number) => (n / 1048576).toFixed(0);

// Reads a response body, aborting past `max`. Streamed rather than buffered:
// Content-Length is a hint from an untrusted server, so it's used as a fast
// reject only — a missing or lying header still can't get past the cap.
export async function readCapped(res: Response, max: number): Promise<Buffer> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    throw new Error(`That media is ${mb(declared)}MB — over the ${mb(max)}MB limit.`);
  }
  if (!res.body) return Buffer.alloc(0);

  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        throw new Error(`That media is over the ${mb(max)}MB limit.`);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks);
}

// Container signatures for the media ffmpeg is willing to parse. This is a
// cheap sanity gate, NOT a malware check: a well-formed but malicious MP4 still
// passes. It exists because downloadToUploads feeds ffmpeg — a large C parsing
// surface — with bytes from a URL the caller chose, so refusing input that
// isn't even the right shape removes the trivial cases.
export function sniffMediaKind(buf: Buffer): string | null {
  const ascii = (start: number, end: number) => buf.subarray(start, end).toString("latin1");
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (ascii(0, 8) === "\x89PNG\r\n\x1a\n") return "image/png";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF") {
    const form = ascii(8, 12);
    if (form === "WEBP") return "image/webp";
    if (form === "AVI ") return "video/x-msvideo";
    if (form === "WAVE") return "audio/wav";
    return null;
  }
  if (ascii(4, 8) === "ftyp") return "video/mp4"; // also .mov/.m4a/.m4v
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return "video/webm";
  if (ascii(0, 4) === "OggS") return "video/ogg";
  if (ascii(0, 3) === "ID3" || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

// Downloads a remote media URL into uploads/ so ffmpeg can read it locally.
// Goes through safeFetch: the URL comes from an API caller, so it must not be
// usable to reach loopback, link-local or private-range hosts. The failure
// message deliberately omits the upstream status — echoing it back turned this
// into an oracle for probing which internal hosts and ports are alive.
export async function downloadToUploads(url: string, ext: string): Promise<string> {
  await ensureUploadDir();
  const res = await safeFetch(url);
  if (!res.ok) throw new Error("Could not download the media URL.");

  const buf = await readCapped(res, MAX_MEDIA_BYTES);
  // Only this sink feeds ffmpeg, so the type gate lives here rather than in
  // readStoredFile — which also carries documents (LinkedIn PDFs) that have no
  // business being sniffed as media.
  if (!sniffMediaKind(buf)) {
    throw new Error("That URL isn't an image, video or audio file we recognise.");
  }

  const key = newUploadKey(ext);
  await writeFile(uploadPath(key), buf);
  return key;
}

// Reads a stored file's bytes back — used by publishers that push media to the
// platform (LinkedIn, TikTok) instead of handing it a public URL. Media-URL
// mode stores { path: "", name: <url>, mime: "url" } stubs; those are fetched.
export async function readStoredFile(file: StoredFile): Promise<Buffer> {
  if (file.mime === "url") {
    // Same untrusted-URL path as downloadToUploads — sanitizeStoredMedia only
    // checks the http(s) prefix, so the host is still caller-chosen here.
    const res = await safeFetch(file.name);
    if (!res.ok) throw new Error("Could not download the media URL.");
    // Capped, but not type-gated: this path also carries documents.
    return readCapped(res, MAX_MEDIA_BYTES);
  }
  try {
    return await readFile(path.join(UPLOAD_DIR, file.path));
  } catch {
    throw new Error(`Stored media file "${file.name}" is missing from the uploads directory`);
  }
}
