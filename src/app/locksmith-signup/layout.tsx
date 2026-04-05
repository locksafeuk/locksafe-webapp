import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Join as a Locksmith | Guaranteed Payment & Protection | ${SITE_NAME}`,
  description: `Join the UK's first anti-fraud locksmith platform. Guaranteed payments via Stripe Connect. GPS proof protects against false claims. Digital signatures confirm work approval. Set your own rates, keep 85%. Sign up in minutes.`,
  keywords: [
    "locksmith jobs",
    "become a locksmith",
    "locksmith work",
    "locksmith platform",
    "locksmith earnings",
    "join locksmith network",
    "guaranteed locksmith payment",
    "locksmith protection",
    "verified locksmith jobs",
  ],
  openGraph: {
    title: `Join as a Locksmith | Guaranteed Payment | ${SITE_NAME}`,
    description: "Guaranteed payments. GPS proof protects you. Digital signatures confirm work approval. Set your own rates, keep 85%. Join the UK's first anti-fraud locksmith platform.",
    url: `${SITE_URL}/locksmith-signup`,
    siteName: SITE_NAME,
    images: [
      {
        url: `${SITE_URL}/locksmith-signup/opengraph-image`,
        width: 1200,
        height: 630,
        alt: `Join ${SITE_NAME} - Guaranteed Payment for Locksmiths`,
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Join as a Locksmith | Guaranteed Payment | ${SITE_NAME}`,
    description: "Guaranteed payments. GPS proof protects you. Set your own rates and keep 85%. Join the UK's first anti-fraud locksmith platform.",
    images: [`${SITE_URL}/locksmith-signup/opengraph-image`],
  },
  alternates: {
    canonical: `${SITE_URL}/locksmith-signup`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LocksmithSignupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
