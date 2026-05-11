import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { blogPosts, getAllCategories } from "@/lib/blog-data";
import { postcodeData, getAllPostcodes } from "@/lib/postcode-data";
import { getAllCitySlugs, ukCitiesData } from "@/lib/uk-cities-data";
import { getAllServiceSlugs } from "@/lib/services-catalog";
import {
  getAllIntentLandingSlugs,
  getActiveIntentLandings,
} from "@/lib/intent-landings";
import { PILLAR_KEYWORDS } from "@/lib/intents-catalog";
import { slugify } from "@/lib/seo/url-helpers";

const POSTCODE_PILLAR_SERVICES = [
  "emergency-locksmith",
  "lock-change",
  "burglary-repair",
  "auto-locksmith",
  "commercial-locksmith",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = SITE_URL;

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/request`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/how-it-works`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/pricing`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/contact`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/for-locksmiths`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locksmith-rickmansworth`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/locksmith-signup`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/security-checklist`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cookies`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/refund-policy`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/accessibility`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/vulnerable-customers`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/cooling-off`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/locksmith/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  // City-specific pages - all major UK cities
  const cityPages: MetadataRoute.Sitemap = getAllCitySlugs().map((citySlug) => ({
    url: `${baseUrl}/locksmith-${citySlug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.85, // High priority for local SEO
  }));

  // Postcode-specific landing pages (WD, AL postcodes)
  const postcodePages: MetadataRoute.Sitemap = getAllPostcodes().map((pc) => {
    const data = postcodeData[pc];
    return {
      url: `${baseUrl}/emergency-locksmith-${data.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.85, // Higher priority for targeted ads pages
    };
  });

  // Blog posts
  const blogPostPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: new Date(post.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Blog category pages
  const blogCategoryPages: MetadataRoute.Sitemap = getAllCategories().map((category) => ({
    url: `${baseUrl}/blog/category/${category}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Service-intent landing pages (one per Meta catalog item)
  const servicePages: MetadataRoute.Sitemap = getAllServiceSlugs().map((slug) => ({
    url: `${baseUrl}/services/${slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Top-level /services overview
  const servicesIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/services`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.85,
    },
  ];

  // ── Intent SEO pages ──────────────────────────────────────────────────────
  // Boost priority for pages aligned to high-volume pillar keywords.
  // If ≥2 active landings share a pillarKeyword, bump that pillar's pages.
  const landings = getActiveIntentLandings();
  const pillarCounts = new Map<string, number>();
  for (const l of landings) {
    if (l.pillarKeyword) {
      pillarCounts.set(l.pillarKeyword, (pillarCounts.get(l.pillarKeyword) ?? 0) + 1);
    }
  }
  const isBoostedPillar = (pk: string | null | undefined) =>
    Boolean(pk && (PILLAR_KEYWORDS as readonly string[]).includes(pk) && (pillarCounts.get(pk) ?? 0) >= 2);

  const intentIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/intent`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.85,
    },
  ];

  const intentPages: MetadataRoute.Sitemap = landings.map((l) => ({
    url: `${baseUrl}/intent/${l.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: isBoostedPillar(l.pillarKeyword) ? 0.9 : 0.8,
  }));

  // Intent × city
  const citySlugs = getAllCitySlugs();
  const intentCityPages: MetadataRoute.Sitemap = [];
  for (const l of landings) {
    for (const city of citySlugs) {
      intentCityPages.push({
        url: `${baseUrl}/intent/${l.slug}/in/${city}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: isBoostedPillar(l.pillarKeyword) ? 0.8 : 0.7,
      });
    }
  }

  // Service × city
  const serviceCityPages: MetadataRoute.Sitemap = [];
  for (const s of getAllServiceSlugs()) {
    for (const city of citySlugs) {
      serviceCityPages.push({
        url: `${baseUrl}/services/${s}/in/${city}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.75,
      });
    }
  }

  // City × area
  const cityAreaPages: MetadataRoute.Sitemap = [];
  for (const cityData of Object.values(ukCitiesData)) {
    for (const area of cityData.areas) {
      cityAreaPages.push({
        url: `${baseUrl}/locksmith-${cityData.slug}/${slugify(area)}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      });
    }
  }

  // Postcode × pillar service
  const postcodeServicePages: MetadataRoute.Sitemap = [];
  for (const data of Object.values(postcodeData)) {
    for (const service of POSTCODE_PILLAR_SERVICES) {
      postcodeServicePages.push({
        url: `${baseUrl}/emergency-locksmith-${data.slug}/${service}`,
        lastModified: new Date(),
        changeFrequency: "weekly" as const,
        priority: 0.75,
      });
    }
  }

  return [
    ...staticPages,
    ...servicesIndex,
    ...servicePages,
    ...intentIndex,
    ...intentPages,
    ...intentCityPages,
    ...serviceCityPages,
    ...cityPages,
    ...cityAreaPages,
    ...postcodePages,
    ...postcodeServicePages,
    ...blogPostPages,
    ...blogCategoryPages,
  ];
}
