import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

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
