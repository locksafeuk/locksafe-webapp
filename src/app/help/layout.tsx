import type { Metadata } from "next";
import { SITE_URL, SITE_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/config";
import Script from "next/script";

export const metadata: Metadata = {
  title: `Help Centre & Support | 24/7 Assistance | ${SITE_NAME}`,
  description: `Need help with ${SITE_NAME}? Find instant answers about booking locksmiths, payments, refunds, and our anti-fraud protection. 24/7 customer support via phone and email. Quick solutions for customers and locksmiths.`,
  keywords: [
    "locksmith help",
    "locksmith support",
    "locksmith FAQ",
    "locksmith refund help",
    "locksmith payment issues",
    "locksafe customer service",
    "emergency locksmith support",
    "locksmith booking help",
    "how to book locksmith",
    "locksmith quote questions",
  ],
  openGraph: {
    title: `Help Centre | 24/7 Support | ${SITE_NAME}`,
    description: "Find instant answers about booking, payments, refunds, and our anti-fraud protection. 24/7 customer support available.",
    url: `${SITE_URL}/help`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Help Centre | ${SITE_NAME}`,
    description: "24/7 customer support. Find answers about booking, payments, and refunds.",
  },
  alternates: {
    canonical: `${SITE_URL}/help`,
  },
};

// FAQ Structured Data for AEO/GEO
const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "How do I book a locksmith on LockSafe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Click 'Get Emergency Help' on our homepage, enter your postcode and describe your problem. Multiple verified locksmiths will apply with their assessment fee and ETA. You choose who to book based on price, rating, and reviews. Payment is secure through Stripe.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if the locksmith doesn't arrive?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You're fully protected with our automatic refund guarantee. If a locksmith accepts your job but fails to arrive within their agreed ETA plus a 30-minute grace period, you can request an automatic full refund. No questions asked - the locksmith's account is debited, not the platform.",
      },
    },
    {
      "@type": "Question",
      name: "Can I decline the locksmith's work quote?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Absolutely! When the locksmith provides their on-site quote for the work, you can accept or decline. If you decline, you've only paid the assessment fee and the job is closed. There's no pressure and no hidden fees.",
      },
    },
    {
      "@type": "Question",
      name: "How much commission does LockSafe charge locksmiths?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe charges 15% commission on the assessment fee and 25% commission on the work quote. There are no monthly fees, subscription costs, or hidden charges. Locksmiths only pay when they earn.",
      },
    },
    {
      "@type": "Question",
      name: "How do locksmith refunds work on LockSafe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If you're eligible for a refund (e.g., locksmith didn't arrive), you can request it directly from the job page. Refunds are processed automatically and typically arrive within 3-5 business days. The locksmith's connected Stripe account is debited.",
      },
    },
  ],
};

// Contact Page Structured Data
const contactStructuredData = {
  "@context": "https://schema.org",
  "@type": "ContactPage",
  name: `${SITE_NAME} Help Centre`,
  description: "24/7 customer support for locksmith booking, payments, and refunds",
  url: `${SITE_URL}/help`,
  mainEntity: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: SUPPORT_PHONE || "+44-800-123-456",
        contactType: "customer service",
        availableLanguage: "English",
        areaServed: "GB",
        hoursAvailable: {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
          opens: "00:00",
          closes: "23:59",
        },
      },
      {
        "@type": "ContactPoint",
        email: SUPPORT_EMAIL || "help@locksafe.uk",
        contactType: "customer service",
        availableLanguage: "English",
        areaServed: "GB",
      },
    ],
  },
};

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="help-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <Script
        id="help-contact-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactStructuredData) }}
      />
      {children}
    </>
  );
}
