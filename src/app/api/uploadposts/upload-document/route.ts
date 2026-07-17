import { makeUploadHandler } from "@/lib/api-upload";

// POST /api/uploadposts/upload-document — LinkedIn document posts (PDF/PPT/DOC)
export const POST = makeUploadHandler({
  type: "document",
  fileFields: ["document"],
  requireMedia: true,
});
