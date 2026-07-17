import { makeUploadHandler } from "@/lib/api-upload";

// POST /api/upload — one API call to post a video to all platforms
export const POST = makeUploadHandler({
  type: "video",
  fileFields: ["video"],
  requireMedia: true,
});
