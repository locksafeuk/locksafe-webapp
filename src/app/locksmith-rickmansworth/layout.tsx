import { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Locksmith Rickmansworth | 24/7 Emergency | Fast Response | WD3",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Locked out in Rickmansworth? Our verified WD3 locksmiths typically arrive in 15-30 minutes. Transparent pricing with assessment fees from £25. Trusted by 2,847+ local homeowners. Call now.",
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  generator: "Next.js",
  keywords: [
    "locksmith rickmansworth",
    "emergency locksmith wd3",
    "24 hour locksmith rickmansworth",
    "locksmith near me rickmansworth",
    "locked out rickmansworth",
    "locksmith chorleywood",
    "locksmith croxley green",
    "rickmansworth lock repair",
    "wd3 locksmith",
    "locksmith three rivers",
    "locksmith hertfordshire",
    "emergency locksmith near me",
    "24/7 locksmith",
    "locksmith mill end",
    "locksmith loudwater",
  ],
  referrer: "origin-when-cross-origin",
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: true,
    telephone: true,
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: `${SITE_URL}/locksmith-rickmansworth`,
    siteName: SITE_NAME,
    title: "Locked Out in Rickmansworth? Help Typically Arrives in 15-30 Minutes",
    description:
      "24/7 verified locksmiths covering all WD3 areas. Transparent two-stage pricing with upfront assessment fees. See your work quote before accepting.",
    images: [
      {
        url: `${SITE_URL}/og/locksmith-rickmansworth.png`,
        width: 1200,
        height: 630,
        alt: "LockSafe Emergency Locksmith Rickmansworth",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Emergency Locksmith Rickmansworth | 15-30 Min Response",
    description:
      "24/7 verified locksmiths in WD3. Trusted by 2,847+ locals. Transparent pricing. Call now.",
    images: [`${SITE_URL}/og/locksmith-rickmansworth.png`],
  },
  alternates: {
    canonical: `${SITE_URL}/locksmith-rickmansworth`,
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
    google: "your-google-verification-code",
  },
  other: {
    // GEO Meta Tags for local SEO
    "geo.region": "GB-HRT",
    "geo.placename": "Rickmansworth",
    "geo.position": "51.6400;-0.4730",
    ICBM: "51.6400, -0.4730",
    // Additional AEO tags
    "speakable": JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SpeakableSpecification",
      cssSelector: ["h1", "h2", ".speakable"],
    }),
  },
};

export default function LocksmithRickmansworthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
