import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import Script from "next/script";

export const metadata: Metadata = {
  title: `Locksmith FAQ | Partner Help Centre | ${SITE_NAME}`,
  description: `Everything you need to know as a LockSafe locksmith partner. Learn about commission rates (15% on assessment, 25% on work), getting paid, documentation requirements, and best practices.`,
  keywords: [
    "locksmith partner FAQ",
    "LockSafe commission rates",
    "locksmith earnings",
    "locksmith platform help",
    "locksmith payment system",
    "locksmith documentation",
    "locksafe partner support",
  ],
  openGraph: {
    title: `Locksmith FAQ | Partner Help Centre | ${SITE_NAME}`,
    description: "Complete guide for LockSafe locksmith partners. Commission rates, payments, documentation, and more.",
    url: `${SITE_URL}/locksmith/faq`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  alternates: {
    canonical: `${SITE_URL}/locksmith/faq`,
  },
};

// FAQ Structured Data
const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What commission does LockSafe charge locksmiths?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe charges 15% commission on assessment fees (you keep 85%) and 25% commission on work quotes (you keep 75%). There are no monthly fees or subscriptions.",
      },
    },
    {
      "@type": "Question",
      name: "How do I get paid as a LockSafe locksmith?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Payments are transferred to your bank account automatically after each completed job via Stripe Connect. Funds typically arrive within 2-3 business days.",
      },
    },
    {
      "@type": "Question",
      name: "What documentation is required for each job?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You must GPS check-in when arriving, take before/after photos, create a detailed work quote, and obtain the customer's digital signature. This documentation protects both you and the customer.",
      },
    },
    {
      "@type": "Question",
      name: "How do I set my coverage area on LockSafe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Go to Settings > Coverage Area. Enter your base postcode and set your radius in miles. You'll only receive notifications for jobs within this radius.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if a customer requests a refund?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If a refund is processed (e.g., for a no-show), your share of the payment is debited from your Stripe account. Ensure you arrive on time and communicate any delays to avoid refunds.",
      },
    },
  ],
};

export default function LocksmithFAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="locksmith-faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      {children}
    </>
  );
}
