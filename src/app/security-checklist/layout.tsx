import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Free Home Security Checklist | Is Your Home Safe? | ${SITE_NAME}`,
  description: "Take our free home security checklist to identify vulnerabilities in your home security. Get personalized recommendations from locksmith experts.",
  keywords: [
    "home security checklist",
    "security audit",
    "home safety check",
    "lock security",
    "burglar prevention",
    "home protection",
  ],
  openGraph: {
    title: `Free Home Security Checklist | ${SITE_NAME}`,
    description: "Is your home secure? Take our free 5-minute checklist and get personalized security recommendations.",
    url: `${SITE_URL}/security-checklist`,
    siteName: SITE_NAME,
    images: [
      {
        url: `${SITE_URL}/security-checklist/opengraph-image`,
        width: 1200,
        height: 630,
        alt: `Free Home Security Checklist - ${SITE_NAME}`,
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Free Home Security Checklist | ${SITE_NAME}`,
    description: "Is your home secure? Take our free 5-minute checklist.",
    images: [`${SITE_URL}/security-checklist/opengraph-image`],
  },
  alternates: {
    canonical: `${SITE_URL}/security-checklist`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SecurityChecklistLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
