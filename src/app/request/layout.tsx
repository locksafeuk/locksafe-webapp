import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Request Emergency Locksmith | Get Help Now | ${SITE_NAME}`,
  description: "Need a locksmith urgently? Request emergency locksmith help in minutes. Verified locksmiths, transparent pricing, GPS tracking. Average response: 15-30 minutes across the UK.",
  keywords: [
    "request locksmith",
    "emergency locksmith",
    "locksmith near me",
    "locked out help",
    "24 hour locksmith",
    "urgent locksmith",
  ],
  openGraph: {
    title: `Request Emergency Locksmith | ${SITE_NAME}`,
    description: "Get emergency locksmith help in minutes. Verified locksmiths with transparent pricing and GPS tracking.",
    url: `${SITE_URL}/request`,
    siteName: SITE_NAME,
    images: [
      {
        url: "/request/opengraph-image",
        width: 1200,
        height: 630,
        alt: `Request Emergency Locksmith - ${SITE_NAME}`,
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Request Emergency Locksmith | ${SITE_NAME}`,
    description: "Get emergency locksmith help in minutes with transparent pricing.",
    images: ["/request/twitter-image"],
  },
  alternates: {
    canonical: `${SITE_URL}/request`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
