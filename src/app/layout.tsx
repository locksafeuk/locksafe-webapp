import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import ClientBody from "./ClientBody";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { MetaPixel } from "@/components/analytics/MetaPixel";
import { GoogleAdsTracking } from "@/components/analytics/GoogleAdsTracking";
import { MicrosoftAds } from "@/components/analytics/MicrosoftAds";
import { SITE_URL, SITE_NAME, SUPPORT_PHONE, SUPPORT_EMAIL } from "@/lib/config";

// Self-hosted Google Fonts via next/font — no render-blocking external CSS,
// preloaded subset, and font-display: swap by default.
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

// Analytics & Ads Configuration
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || "";
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || "";
const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "";
const BING_UET_TAG_ID = process.env.NEXT_PUBLIC_BING_UET_TAG_ID || "";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: `%s | ${SITE_NAME}`,
    default: `${SITE_NAME} - The Only Locksmith Platform That Prevents Price Scams`,
  },
  description: "Tired of £50 quotes becoming £300? LockSafe is the UK's first anti-fraud locksmith platform. Automatic refund if locksmith doesn't arrive. See the quote BEFORE work starts. Every job creates legally-binding documentation with GPS tracking, photos, and digital signatures. Verified locksmiths. 15-30 min response.",
  keywords: [
    // Primary intent keywords (SEO)
    "emergency locksmith near me",
    "24 hour locksmith UK",
    "locksmith near me now",
    "locked out of house",
    "locked out of car",
    // Problem-aware keywords (AEO/GEO)
    "how to avoid locksmith scams",
    "locksmith price transparency",
    "trusted locksmith UK",
    "verified locksmith service",
    "anti-fraud locksmith",
    "locksmith refund guarantee",
    "locksmith with money back guarantee",
    "safe locksmith booking",
    // Location keywords
    "locksmith London",
    "locksmith Manchester",
    "locksmith Birmingham",
    "locksmith Glasgow",
    "locksmith Leeds",
    // Service keywords
    "lock repair service",
    "lock replacement",
    "door lock installation",
    "upvc door lock repair",
    "euro cylinder replacement",
    // Trust keywords
    "locksmith no hidden fees",
    "upfront locksmith pricing",
    "locksmith see quote first",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    telephone: true,
    date: false,
    email: true,
    address: true,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} - The Only Platform That Prevents Locksmith Scams`,
    description: "Tired of £50 quotes becoming £300? Every LockSafe job creates a legally-binding digital paper trail. GPS tracking, timestamped photos, digital signatures. Your protection against overcharging.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} - UK's First Anti-Fraud Locksmith Platform`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@locksafeuk",
    creator: "@locksafeuk",
    title: `Locked Out? Don't Get Scammed.`,
    description: "LockSafe is the UK's first anti-fraud locksmith platform. See the quote BEFORE work starts. Accept or decline. Full documentation on every job.",
    images: ["/twitter-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || "",
  },
  alternates: {
    canonical: SITE_URL,
  },
  category: "business",
  classification: "Locksmith Services",
  referrer: "origin-when-cross-origin",
  applicationName: SITE_NAME,
};

// Schema.org structured data for local business SEO + AEO/GEO optimization
const structuredData = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": SITE_URL,
  name: SITE_NAME,
  alternateName: "LockSafe",
  description: "The UK's first anti-fraud locksmith platform. Every job creates a legally-binding digital paper trail with GPS tracking, timestamped photos, and digital signatures. Verified locksmiths. Transparent pricing. No more £50 quotes becoming £300.",
  slogan: "The Only Platform That Prevents Locksmith Scams",
  url: SITE_URL,
  telephone: SUPPORT_PHONE,
  email: SUPPORT_EMAIL,
  logo: `${SITE_URL}/opengraph-image`,
  image: `${SITE_URL}/opengraph-image`,
  address: {
    "@type": "PostalAddress",
    addressCountry: "GB",
    addressRegion: "United Kingdom",
  },
  geo: {
    "@type": "GeoCoordinates",
    latitude: "51.5074",
    longitude: "-0.1278",
  },
  areaServed: [
    {
      "@type": "Country",
      name: "United Kingdom",
    },
    {
      "@type": "City",
      name: "London",
    },
    {
      "@type": "City",
      name: "Manchester",
    },
    {
      "@type": "City",
      name: "Birmingham",
    },
    {
      "@type": "City",
      name: "Glasgow",
    },
    {
      "@type": "City",
      name: "Leeds",
    },
  ],
  priceRange: "££",
  currenciesAccepted: "GBP",
  paymentAccepted: "Credit Card, Debit Card, Apple Pay, Google Pay",
  openingHoursSpecification: {
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
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.9",
    bestRating: "5",
    worstRating: "1",
    reviewCount: "1250",
    ratingCount: "1250",
  },
  hasOfferCatalog: {
    "@type": "OfferCatalog",
    name: "Anti-Fraud Protected Locksmith Services",
    itemListElement: [
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Emergency Lockout Service",
          description: "24/7 emergency lockout assistance with transparent upfront pricing. See the quote BEFORE work starts. Legally-binding documentation with GPS tracking and timestamped photos.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Lock Repair & Replacement",
          description: "Professional lock repair and replacement by DBS-checked, verified locksmiths. Full digital paper trail protects you from overcharging.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Security Upgrades",
          description: "Anti-snap locks, smart locks, and security upgrades. All work documented with before/after photos and digital signatures.",
        },
      },
      {
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: "Commercial Locksmith Services",
          description: "Business locksmith services with SLA agreements. Access control, master key systems, and emergency support for commercial properties.",
        },
      },
    ],
  },
  knowsAbout: [
    "Emergency locksmith services",
    "Lock repair and replacement",
    "Anti-fraud protection for locksmith services",
    "Transparent locksmith pricing",
    "GPS-tracked locksmith services",
    "DBS-checked locksmiths",
    "UPVC door lock repair",
    "Euro cylinder replacement",
    "Smart lock installation",
    "Anti-snap lock installation",
  ],
  sameAs: [
    "https://twitter.com/locksafeuk",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${dmSans.variable} ${jakarta.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.svg" />
        <meta name="theme-color" content="#f97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LockSafe" />
        <meta name="mobile-web-app-capable" content="yes" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body suppressHydrationWarning className="antialiased">
        {/* Analytics & Conversion Tracking */}
        <GoogleAnalytics measurementId={GA_MEASUREMENT_ID} />
        <MetaPixel pixelId={META_PIXEL_ID} />
        <GoogleAdsTracking adsId={GOOGLE_ADS_ID} gaId={GA_MEASUREMENT_ID} />
        <MicrosoftAds uetTagId={BING_UET_TAG_ID} />
        <ClientBody>{children}</ClientBody>
      </body>
    </html>
  );
}
