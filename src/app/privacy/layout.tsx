import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import Script from "next/script";

export const metadata: Metadata = {
  title: `Privacy Policy | GDPR Compliant | ${SITE_NAME}`,
  description: `${SITE_NAME} Privacy Policy. Learn how we collect, use, and protect your data. GDPR compliant with full transparency. Your rights: access, delete, and export your data. GPS data used for anti-fraud protection.`,
  keywords: [
    "locksmith privacy policy",
    "locksafe privacy",
    "locksmith data protection",
    "GDPR locksmith",
    "locksmith personal data",
    "locksmith GPS data",
    "how locksafe uses data",
    "locksmith data rights",
  ],
  openGraph: {
    title: `Privacy Policy | GDPR Compliant | ${SITE_NAME}`,
    description: "GDPR compliant privacy policy. Full transparency on how we collect, use, and protect your data. Exercise your rights anytime.",
    url: `${SITE_URL}/privacy`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Privacy Policy | ${SITE_NAME}`,
    description: "GDPR compliant. Learn how we protect your data and your rights.",
  },
  alternates: {
    canonical: `${SITE_URL}/privacy`,
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
  name: `Privacy Policy | ${SITE_NAME}`,
  description: "GDPR compliant privacy policy explaining data collection, use, and your rights",
  url: `${SITE_URL}/privacy`,
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  },
  about: {
    "@type": "Thing",
    name: "Privacy Policy",
    description: "Data protection and privacy practices",
  },
  mainEntity: {
    "@type": "Article",
    headline: `${SITE_NAME} Privacy Policy`,
    datePublished: "2026-01-01",
    dateModified: "2026-02-23",
    author: {
      "@type": "Organization",
      name: SITE_NAME,
    },
  },
};

// FAQ for common privacy questions (AEO optimization)
const privacyFaqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What personal data does LockSafe collect?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe collects: account information (name, email, phone), location data (postcode, address for service), payment information (processed by Stripe - we don't store card details), job details, and GPS coordinates for anti-fraud verification.",
      },
    },
    {
      "@type": "Question",
      name: "Does LockSafe sell my personal data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. LockSafe does not sell your personal data to third parties. We only share data with service providers necessary to deliver our platform (Stripe for payments, Mapbox for maps, Resend for emails) and between customers and locksmiths for job completion.",
      },
    },
    {
      "@type": "Question",
      name: "Why does LockSafe use GPS tracking?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "GPS tracking is our anti-fraud protection. For locksmiths, it proves they arrived at the job location. For customers, it verifies the locksmith actually came. GPS data is stored in job records and included in PDF reports for dispute resolution.",
      },
    },
    {
      "@type": "Question",
      name: "How long does LockSafe keep my data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Account data is kept until you delete your account. Job records and payment records are kept for 7 years as required by UK financial regulations. Marketing preferences are kept until you withdraw consent.",
      },
    },
    {
      "@type": "Question",
      name: "How can I delete my LockSafe data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can request deletion of your personal data by emailing privacy@locksafe.uk. We will process your request within 30 days. Note that some data must be retained for legal compliance (e.g., 7 years for financial records).",
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
      name: "Privacy Policy",
      item: `${SITE_URL}/privacy`,
    },
  ],
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="privacy-webpage-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageStructuredData) }}
      />
      <Script
        id="privacy-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(privacyFaqStructuredData) }}
      />
      <Script
        id="privacy-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
      {children}
    </>
  );
}
