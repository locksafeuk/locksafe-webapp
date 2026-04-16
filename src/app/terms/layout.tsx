import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import Script from "next/script";

export const metadata: Metadata = {
  title: `Terms of Service | Legal Agreement | ${SITE_NAME}`,
  description: `Read ${SITE_NAME}'s Terms of Service. Understand your rights as a customer (refund guarantee, quote approval) and locksmith (85% earnings, payment protection). Fair, transparent terms for the UK's anti-fraud locksmith platform.`,
  keywords: [
    "locksmith terms of service",
    "locksafe terms",
    "locksmith legal terms",
    "locksmith refund policy",
    "locksmith customer rights",
    "locksmith platform terms",
    "locksmith service agreement",
  ],
  openGraph: {
    title: `Terms of Service | ${SITE_NAME}`,
    description: "Fair, transparent terms for customers and locksmiths. Understand your rights including our refund guarantee and anti-fraud protection.",
    url: `${SITE_URL}/terms`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Terms of Service | ${SITE_NAME}`,
    description: "Fair, transparent terms including refund guarantee and customer protection.",
  },
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// WebPage Structured Data
const webPageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: `Terms of Service | ${SITE_NAME}`,
  description: "Terms of Service for the UK's first anti-fraud locksmith platform",
  url: `${SITE_URL}/terms`,
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  },
  about: {
    "@type": "Thing",
    name: "Terms of Service",
    description: "Legal agreement governing use of LockSafe platform",
  },
  mainEntity: {
    "@type": "Article",
    headline: `${SITE_NAME} Terms of Service`,
    datePublished: "2026-01-01",
    dateModified: "2026-02-23",
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  },
};

// Breadcrumb Structured Data
const breadcrumbStructuredData = {
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
      name: "Terms of Service",
      item: `${SITE_URL}/terms`,
    },
  ],
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="terms-webpage-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageStructuredData) }}
      />
      <Script
        id="terms-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
      {children}
    </>
  );
}
