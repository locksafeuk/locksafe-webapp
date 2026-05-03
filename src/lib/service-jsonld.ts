/**
 * Pure JSON-LD builders for /services and /services/[slug].
 *
 * Each function returns a plain object ready to be stringified into a
 * <script type="application/ld+json"> tag. No runtime side-effects.
 *
 * Schemas emitted:
 *   - Service                  (the offering itself, with Offer + priceSpecification)
 *   - FAQPage                  (per-service FAQs for AEO)
 *   - BreadcrumbList           (Home → Services → Slug)
 *   - SpeakableSpecification   (TL;DR + FAQ anchors for voice / GEO)
 *   - HowTo                    (3-step "post → quote → done" flow)
 *   - ItemList                 (services index page)
 */

import { SITE_NAME, SITE_URL, getFullUrl } from "@/lib/config";
import type { ServiceEntry } from "@/lib/services-catalog";

const PROVIDER = {
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: getFullUrl("/icons/icon-512x512.png"),
} as const;

export function buildServiceJsonLd(entry: ServiceEntry) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: entry.title,
    serviceType: entry.title,
    description: entry.shortDescription,
    provider: PROVIDER,
    areaServed: { "@type": "Country", name: "United Kingdom" },
    hoursAvailable: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ],
      opens: "00:00",
      closes: "23:59",
    },
    url: entry.link,
    image: entry.image_link,
    offers: {
      "@type": "Offer",
      url: entry.link,
      availability: "https://schema.org/InStock",
      priceCurrency: "GBP",
      price: String(entry.priceRangeLow),
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "GBP",
        minPrice: entry.priceRangeLow,
        maxPrice: entry.priceRangeHigh,
      },
    },
  };
}

export function buildFaqJsonLd(entry: ServiceEntry) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entry.faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildBreadcrumbJsonLd(entry: ServiceEntry) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Services",
        item: getFullUrl("/services"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: entry.title,
        item: entry.link,
      },
    ],
  };
}

export function buildSpeakableJsonLd(url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    url,
    speakable: {
      "@type": "SpeakableSpecification",
      cssSelector: ["#tldr", "#faq"],
    },
  };
}

export function buildHowToJsonLd(entry: ServiceEntry) {
  if (entry.howItWorks.length < 3) return null;
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: `How to book a ${entry.title.toLowerCase()} on ${SITE_NAME}`,
    description: entry.shortDescription,
    totalTime: "PT5M",
    step: entry.howItWorks.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.title,
      text: step.description,
      url: `${entry.link}#how-it-works`,
    })),
  };
}

export function buildServicesItemListJsonLd(entries: readonly ServiceEntry[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: entries.map((entry, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: entry.link,
      name: entry.title,
    })),
  };
}

export function buildServicesIndexBreadcrumbJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: "Services",
        item: getFullUrl("/services"),
      },
    ],
  };
}

export function buildServicesIndexFaqJsonLd(
  faqs: { question: string; answer: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * Stub for AggregateRating — deliberately unused until real review data is
 * wired in. Google penalises pages with fake or unverifiable ratings.
 */
export function buildAggregateRatingJsonLd(params: {
  ratingValue: number;
  reviewCount: number;
}) {
  return {
    "@type": "AggregateRating",
    ratingValue: params.ratingValue,
    reviewCount: params.reviewCount,
    bestRating: 5,
    worstRating: 1,
  };
}
