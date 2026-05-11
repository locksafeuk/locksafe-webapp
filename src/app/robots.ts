import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin/",
          "/admin/*",
          "/customer/",
          "/customer/*",
          "/locksmith/dashboard",
          "/locksmith/dashboard/*",
          "/locksmith/jobs",
          "/locksmith/jobs/*",
          "/locksmith/earnings",
          "/locksmith/earnings/*",
          "/locksmith/settings",
          "/locksmith/settings/*",
          "/locksmith/history",
          "/locksmith/history/*",
          "/locksmith/job/",
          "/locksmith/job/*",
          "/api/",
          "/api/*",
          "/job/",
          "/job/*",
          "/report/",
          "/report/*",
          "/review/",
          "/review/*",
          "/forgot-password",
          "/reset-password",
          "/verify-email",
          // Next.js generated image endpoints — not indexable content
          "/opengraph-image",
          "/**/opengraph-image",
          "/twitter-image",
          "/**/twitter-image",
          "/manifest.json",
          // Legacy Shopify URLs that no longer exist
          "/products/",
          "/products/*",
          "/*/policies/",
          "/*/policies/*",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
