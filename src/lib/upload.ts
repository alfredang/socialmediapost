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

// Downloads a remote media URL into uploads/ so ffmpeg can read it locally.
// Goes through safeFetch: the URL comes from an API caller, so it must not be
// usable to reach loopback, link-local or private-range hosts. The failure
// message deliberately omits the upstream status — echoing it back turned this
// into an oracle for probing which internal hosts and ports are alive.
export async function downloadToUploads(url: string, ext: string): Promise<string> {
  await ensureUploadDir();
  const res = await safeFetch(url);
  if (!res.ok) throw new Error("Could not download the media URL.");
  const key = newUploadKey(ext);
  await writeFile(uploadPath(key), Buffer.from(await res.arrayBuffer()));
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
    return Buffer.from(await res.arrayBuffer());
  }
  try {
    return await readFile(path.join(UPLOAD_DIR, file.path));
  } catch {
    throw new Error(`Stored media file "${file.name}" is missing from the uploads directory`);
  }
}
