import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/signup", "/privacy", "/terms"],
      disallow: ["/dashboard", "/api/", "/preview.dashboard", "/auth/", "/forgot-password", "/reset-password"],
    },
    sitemap: new URL("/sitemap.xml", base).toString(),
  };
}
