import type { Metadata } from "next";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { Features } from "@/components/sections/Features";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Pricing } from "@/components/sections/Pricing";
import { Stats } from "@/components/sections/Stats";
import { Testimonials } from "@/components/sections/Testimonials";
import { FAQ } from "@/components/sections/FAQ";
import { CTA } from "@/components/sections/CTA";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `${SITE_NAME} - The Only Platform That Prevents Locksmith Price Scams`,
  description: "Tired of £50 quotes becoming £300? LockSafe is the UK's first anti-fraud locksmith platform. Verified locksmiths. Legally-binding documentation. See the quote BEFORE work starts. 15-30 min response, 24/7.",
  openGraph: {
    title: `Locked Out? Don't Get Scammed | ${SITE_NAME}`,
    description: "Every LockSafe job creates a legally-binding digital paper trail. GPS tracking, timestamped photos, digital signatures. The UK's first anti-fraud locksmith platform.",
    url: SITE_URL,
    siteName: SITE_NAME,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - UK's First Anti-Fraud Locksmith Platform`,
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@locksafeuk",
    creator: "@locksafeuk",
    title: `Locked Out? Don't Get Scammed.`,
    description: "LockSafe: See the quote BEFORE work starts. Accept or decline. Full documentation. Your protection against cowboy locksmiths.",
    images: ["/twitter-image"],
  },
  alternates: {
    canonical: SITE_URL,
  },
};

// FAQ Structured Data for SEO
const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is LockSafe free for customers?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, LockSafe is 100% free for customers. There are no platform fees, booking fees, or hidden charges. You simply pay the locksmith directly for their assessment and work. LockSafe makes money by charging locksmiths a commission (15% on assessment fees, 25% on work quotes) - customers never pay LockSafe anything.",
      },
    },
    {
      "@type": "Question",
      name: "What is the assessment fee?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When a locksmith applies for your job, they set their own assessment fee (typically £25-£49). This covers their travel to your location and time to diagnose the problem. You pay this directly to the locksmith to confirm the booking. Once on-site, the locksmith will provide a separate quote for the actual work.",
      },
    },
    {
      "@type": "Question",
      name: "What if the locksmith doesn't arrive?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You're fully protected with our automatic refund guarantee. If a locksmith accepts your job but fails to arrive within their agreed ETA plus a 30-minute grace period, you can request and receive an automatic full refund of your assessment fee. No questions asked. The locksmith's payment account is automatically debited.",
      },
    },
    {
      "@type": "Question",
      name: "How does the refund protection work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "When you pay the assessment fee, the money goes through our secure platform. If the locksmith doesn't arrive on time, you tap 'Request Refund' in the app. We immediately refund you in full and automatically debit the locksmith's connected account. The locksmith bears the cost, not you or the platform.",
      },
    },
    {
      "@type": "Question",
      name: "How do you verify your locksmiths?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Every locksmith on our platform goes through a rigorous verification process: DBS background check, proof of qualifications, insurance verification, and reference checks. We also continuously monitor ratings and investigate any complaints.",
      },
    },
    {
      "@type": "Question",
      name: "What makes LockSafe different from other locksmith services?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our anti-fraud protection system. Every job creates a complete digital paper trail: GPS tracking, timestamped photos before/during/after, digital signatures, and instant PDF reports. This protects both customers from overcharging and locksmiths from false claims.",
      },
    },
    {
      "@type": "Question",
      name: "How long does it take for a locksmith to arrive?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our average response time is 15-30 minutes in urban areas. You'll see the exact ETA when a locksmith accepts your job. In rural areas, it may take slightly longer, but we always show you realistic estimates.",
      },
    },
    {
      "@type": "Question",
      name: "Is the service available 24/7?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, we have verified locksmiths available around the clock, 365 days a year. Emergency lockouts don't follow business hours, and neither do we. Pricing may vary for out-of-hours calls, but this is always shown upfront.",
      },
    },
    {
      "@type": "Question",
      name: "Do you cover commercial properties?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, we serve both residential and commercial properties across the UK. For businesses, we offer additional services like access control systems, master key systems, and emergency lockout support with SLA agreements.",
      },
    },
    {
      "@type": "Question",
      name: "What payment methods do you accept?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "We accept all major credit/debit cards, Apple Pay, Google Pay, and bank transfers. Payment is processed securely through our platform - the locksmith never handles your payment details directly.",
      },
    },
  ],
};

// Service Structured Data for SEO
const serviceStructuredData = {
  "@context": "https://schema.org",
  "@type": "Service",
  name: "Emergency Locksmith Service",
  serviceType: "Locksmith",
  provider: {
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
  },
  areaServed: {
    "@type": "Country",
    name: "United Kingdom",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Locksmith Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Emergency Lockout Service",
          description: "24/7 emergency lockout assistance with transparent pricing and GPS tracking",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Lock Repair & Replacement",
          description: "Professional lock repair and replacement services with verified locksmiths",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Key Cutting & Replacement",
          description: "Professional key cutting and replacement services",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Security Upgrades",
          description: "Home and business security upgrades including anti-snap locks and smart locks",
        },
      },
    ],
  },
};

export default function Home() {
  return (
    <>
      {/* FAQ Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      {/* Service Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceStructuredData) }}
      />

      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Pricing />
        <Stats />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
