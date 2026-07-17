import { makeUploadHandler } from "@/lib/api-upload";

// POST /api/upload_video — alias of /api/upload for video posts
export const POST = makeUploadHandler({
  type: "video",
  fileFields: ["video"],
  requireMedia: true,
});
