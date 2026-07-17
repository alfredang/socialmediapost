import { makeUploadHandler } from "@/lib/api-upload";

// POST /api/upload_text — text-only posts
export const POST = makeUploadHandler({
  type: "text",
  fileFields: [],
  requireMedia: false,
});
