import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/internal-auth";
import { saveUploadedFile, StoredFile } from "@/lib/upload";

// POST — stage media files for later use (pipeline content items). Saves each
// uploaded file and returns its StoredFile ref, which the caller includes when
// creating the pipeline. Mirrors how /api/internal/posts stores upload media.
export async function POST(req: NextRequest) {
  const auth = await requireSession();
  if (auth instanceof NextResponse) return auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Expected multipart/form-data" }, { status: 400 });
  }

  const media: StoredFile[] = [];
  for (const item of form.getAll("media")) {
    if (item instanceof File && item.size > 0) media.push(await saveUploadedFile(item));
  }
  if (media.length === 0) {
    return NextResponse.json({ success: false, error: "No files provided" }, { status: 400 });
  }
  return NextResponse.json({ success: true, media });
}
