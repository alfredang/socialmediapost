import { makeUploadHandler } from "@/lib/api-upload";

// POST /api/upload_photos — photo/carousel posts
export const POST = makeUploadHandler({
  type: "photos",
  fileFields: ["photos[]"],
  requireMedia: true,
});
