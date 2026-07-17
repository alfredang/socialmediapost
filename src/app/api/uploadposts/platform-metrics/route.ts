import { NextResponse } from "next/server";
import { PLATFORMS } from "@/lib/platforms";

const METRICS: Record<string, string[]> = {
  default: ["followers", "reach", "impressions", "views", "likes", "comments", "shares"],
};

// GET /api/uploadposts/platform-metrics — public: metrics available per platform
export async function GET() {
  return NextResponse.json({
    success: true,
    platforms: Object.fromEntries(
      PLATFORMS.map((p) => [
        p.id,
        {
          name: p.name,
          supports: p.supports,
          metrics: METRICS[p.id] ?? METRICS.default,
          constraints: {
            title_max: p.titleMax,
            body_max: p.bodyMax,
            photos_max: p.photosMax,
            video_max_seconds: p.videoMaxSeconds,
            first_comment: p.firstComment,
          },
        },
      ])
    ),
  });
}
