import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import Script from "next/script";

export const metadata: Metadata = {
  title: `Cookie Policy | Manage Your Preferences | ${SITE_NAME}`,
  description: `${SITE_NAME} Cookie Policy. Learn about cookies we use and manage your preferences. GDPR compliant with granular consent options. Essential, functional, analytics, and marketing cookies explained.`,
  keywords: [
    "locksmith cookies",
    "locksafe cookie policy",
    "cookie preferences",
    "GDPR cookies",
    "manage cookies",
    "cookie consent",
    "website cookies",
  ],
  openGraph: {
    title: `Cookie Policy | ${SITE_NAME}`,
    description: "Manage your cookie preferences. GDPR compliant with granular consent options.",
    url: `${SITE_URL}/cookies`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Cookie Policy | ${SITE_NAME}`,
    description: "Manage your cookie preferences. GDPR compliant.",
  },
  alternates: {
    canonical: `${SITE_URL}/cookies`,
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
  name: `Cookie Policy | ${SITE_NAME}`,
  description: "Cookie policy explaining types of cookies used and how to manage preferences",
  url: `${SITE_URL}/cookies`,
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  },
  about: {
    "@type": "Thing",
    name: "Cookie Policy",
    description: "Website cookie usage and management",
  },
};

// FAQ for common cookie questions (AEO optimization)
const cookieFaqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What cookies does LockSafe use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe uses four types of cookies: Essential (always active for basic functionality), Functional (optional, remembers preferences), Analytics (optional, Google Analytics for site improvement), and Marketing (currently not used). You can manage optional cookies through our consent banner.",
      },
    },
    {
      "@type": "Question",
      name: "Can I disable cookies on LockSafe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can disable optional cookies (functional, analytics, marketing) through our cookie consent banner or your browser settings. Essential cookies cannot be disabled as they are required for the website to function (login, security, payments).",
      },
    },
    {
      "@type": "Question",
      name: "Does LockSafe use third-party cookies?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, LockSafe uses some third-party cookies from Stripe (payment processing), Mapbox (maps), and optionally Google Analytics (with your consent). These services have their own privacy policies.",
      },
    },
  ],
};

// Breadcrumb
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
      name: "Cookie Policy",
      item: `${SITE_URL}/cookies`,
    },
  ],
};

export default function CookiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="cookies-webpage-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageStructuredData) }}
      />
      <Script
        id="cookies-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(cookieFaqStructuredData) }}
      />
      <Script
        id="cookies-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
      {children}
    </>
  );
}
