import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://socialmediapost.tertiaryinfotech.com";

// /login and /register stay crawlable on purpose: they carry `noindex`, and
// Google can only honour that if it is allowed to fetch the page. Blocking
// them would leave the known URLs "Indexed, though blocked by robots.txt".
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/connect"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
