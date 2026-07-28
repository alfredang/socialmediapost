import { NextResponse } from "next/server";
import { PLATFORMS, analyticsMetricsFor } from "@/lib/platforms";

// GET /api/uploadposts/platform-metrics — public: metrics available per platform.
// `metrics` lists only what SocialPost actually collects for that platform (from
// its real API), so it is [] for platforms without an analytics integration
// rather than a blanket list that overstates coverage.
export async function GET() {
  return NextResponse.json({
    success: true,
    platforms: Object.fromEntries(
      PLATFORMS.map((p) => [
        p.id,
        {
          name: p.name,
          supports: p.supports,
          metrics: analyticsMetricsFor(p.id).map((m) => m.key),
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
