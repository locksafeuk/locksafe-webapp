import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { blogPosts, getAllCategories } from "@/lib/blog-data";
import { postcodeData, getAllPostcodes } from "@/lib/postcode-data";
import { getAllCitySlugs } from "@/lib/uk-cities-data";
import { getAllServiceSlugs } from "@/lib/services-catalog";

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

  return [
    ...staticPages,
    ...servicesIndex,
    ...servicePages,
    ...cityPages,
    ...postcodePages,
    ...blogPostPages,
    ...blogCategoryPages,
  ];
}
