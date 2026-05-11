/**
 * Centralised JSON-LD + metadata helpers for LockSafe UK.
 *
 * Ported from the Mademoiselle Atelier "Intent SEO" stack and adapted for
 * the UK locksmith niche: LocalBusiness + Service schemas instead of Product,
 * GEO-aware payloads carrying lat/lng and areaServed, and an `intent-landing`
 * data layer that drives programmatic /intent and /services/[s]/in/[city]
 * pages with FAQPage, HowTo, Speakable and BreadcrumbList markup.
 */

import { SITE_URL, SITE_NAME, SUPPORT_PHONE, getFullUrl } from "@/lib/config";

export interface SEOMetadata {
  title: string;
  description: string;
  keywords?: string[];
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
}

export function buildMetadata(meta: SEOMetadata) {
  const title = meta.title.includes(SITE_NAME) ? meta.title : `${meta.title} | ${SITE_NAME}`;
  return {
    title,
    description: meta.description,
    keywords: meta.keywords?.join(", "),
    alternates: { canonical: meta.canonical },
    openGraph: {
      title,
      description: meta.description,
      url: meta.canonical,
      siteName: SITE_NAME,
      images: meta.ogImage ? [{ url: meta.ogImage, width: 1200, height: 630 }] : [],
      locale: "en_GB",
      type: "website" as const,
    },
    twitter: {
      card: "summary_large_image" as const,
      title,
      description: meta.description,
      images: meta.ogImage ? [meta.ogImage] : [],
    },
    robots: meta.noIndex
      ? { index: false, follow: true }
      : { index: true, follow: true },
  };
}

// ---------------------------------------------------------------------------
// JSON-LD generators
// ---------------------------------------------------------------------------

const SOCIAL_PROFILES: string[] = [
  process.env.NEXT_PUBLIC_FACEBOOK_URL || "",
  process.env.NEXT_PUBLIC_INSTAGRAM_URL || "",
  process.env.NEXT_PUBLIC_TWITTER_URL || "",
].filter((url): url is string => Boolean(url && url.trim()));

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": getFullUrl("/#organization"),
    name: SITE_NAME,
    url: getFullUrl("/"),
    logo: getFullUrl("/logo.png"),
    description:
      "The UK's first anti-fraud locksmith platform. Verified DBS-checked locksmiths, transparent pricing agreed before work starts, and a digital paper trail you can share with your insurer.",
    telephone: SUPPORT_PHONE,
    address: { "@type": "PostalAddress", addressCountry: "GB" },
    sameAs: SOCIAL_PROFILES,
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": getFullUrl("/#website"),
    name: SITE_NAME,
    url: getFullUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: getFullUrl("/blog?q={search_term_string}"),
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getFullUrl(item.url),
    })),
  };
}

export function faqJsonLd(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function howToJsonLd(input: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
  totalTime?: string; // ISO 8601 duration, e.g. "PT30M"
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    step: input.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

export function speakableJsonLd(input: {
  url: string;
  cssSelectors: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url: getFullUrl(input.url),
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: input.cssSelectors,
    },
  };
}

export function itemListJsonLd(items: Array<{ url: string; name: string; image?: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: getFullUrl(it.url),
      name: it.name,
      ...(it.image ? { image: it.image } : {}),
    })),
  };
}

/**
 * Service schema for service-intent pages.
 * Pass `areaServed` (city/postcode) when emitting on a geo-scoped page.
 */
export function serviceJsonLd(input: {
  name: string;
  description: string;
  url: string;
  serviceType?: string;
  priceRange?: { low: number; high: number; currency?: string };
  areaServed?: Array<{ name: string; type?: "City" | "AdministrativeArea" | "Country" }>;
  provider?: {
    name?: string;
    telephone?: string;
    url?: string;
  };
}) {
  const provider = {
    "@type": "LocalBusiness" as const,
    name: input.provider?.name || SITE_NAME,
    telephone: input.provider?.telephone || SUPPORT_PHONE,
    url: input.provider?.url || getFullUrl("/"),
  };

  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    description: input.description,
    url: getFullUrl(input.url),
    ...(input.serviceType ? { serviceType: input.serviceType } : {}),
    provider,
    ...(input.areaServed?.length
      ? {
          areaServed: input.areaServed.map((a) => ({
            "@type": a.type || "City",
            name: a.name,
          })),
        }
      : {}),
    ...(input.priceRange
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: input.priceRange.currency || "GBP",
            lowPrice: input.priceRange.low,
            highPrice: input.priceRange.high,
            availability: "https://schema.org/InStock",
          },
        }
      : {}),
  };
}

/**
 * LocalBusiness schema scoped to a specific geography. Use for /locksmith-[city],
 * /emergency-locksmith-[postcode] and any /…/in/[city] geo-localised pages.
 */
export function localBusinessJsonLd(input: {
  name: string;
  description: string;
  url: string;
  telephone?: string;
  coordinates?: { lat: number; lng: number };
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  areaServed?: string[];
  rating?: { value: number; count: number };
  priceRange?: string;
  openingHours?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${getFullUrl(input.url)}#localbusiness`,
    name: input.name,
    description: input.description,
    url: getFullUrl(input.url),
    telephone: input.telephone || SUPPORT_PHONE,
    priceRange: input.priceRange || "££",
    address: {
      "@type": "PostalAddress",
      ...(input.addressLocality ? { addressLocality: input.addressLocality } : {}),
      ...(input.addressRegion ? { addressRegion: input.addressRegion } : {}),
      ...(input.postalCode ? { postalCode: input.postalCode } : {}),
      addressCountry: "GB",
    },
    ...(input.coordinates
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: input.coordinates.lat,
            longitude: input.coordinates.lng,
          },
        }
      : {}),
    ...(input.areaServed?.length
      ? {
          areaServed: input.areaServed.map((name) => ({ "@type": "City", name })),
        }
      : {}),
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        opens: "00:00",
        closes: "23:59",
      },
    ],
    ...(input.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: input.rating.value.toFixed(1),
            reviewCount: input.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

/** Helper: render a JSON-LD <script> body. */
export function ldScript(payload: unknown): string {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}

// Re-export site constants commonly used alongside SEO helpers
export { SITE_URL, SITE_NAME, SUPPORT_PHONE };
