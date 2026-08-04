import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { uploadDir } from "@/lib/upload";
import { verifyMediaSignature } from "@/lib/media-url";

// Serves files stored under uploads/, but only to a caller holding a signed,
// unexpired URL. This endpoint cannot require a session: Instagram, Facebook
// and Threads fetch these URLs from their own servers to pull the media, with
// no cookie. See lib/media-url.ts.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const { key } = await params;
  const rel = key.join("/");

  const q = req.nextUrl.searchParams;
  if (!verifyMediaSignature(rel, q.get("exp"), q.get("sig"))) {
    // Same response for missing, malformed, wrong and expired signatures, so
    // this can't be used to probe which files exist.
    return new NextResponse("Not found", { status: 404 });
  }

  const full = path.normalize(path.join(uploadDir(), rel));
  if (!full.startsWith(uploadDir())) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  try {
    const buf = await readFile(full);
    const ext = path.extname(full).toLowerCase();
    const mime: Record<string, string> = {
      ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".gif": "image/gif", ".webp": "image/webp", ".pdf": "application/pdf",
    };
    return new NextResponse(new Uint8Array(buf), {
      headers: { "content-type": mime[ext] ?? "application/octet-stream" },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
