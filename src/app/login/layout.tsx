import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Login | ${SITE_NAME} Customer Portal`,
  description: `Sign in to your ${SITE_NAME} account to track your locksmith requests, view quotes, and manage your service history.`,
  openGraph: {
    title: `Login | ${SITE_NAME}`,
    description: `Sign in to your ${SITE_NAME} account to track your locksmith requests and manage your service history.`,
    url: `${SITE_URL}/login`,
    siteName: SITE_NAME,
    images: [
      {
        url: `${SITE_URL}/opengraph-image`,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} Login`,
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Login | ${SITE_NAME}`,
    description: `Sign in to your ${SITE_NAME} account.`,
  },
  alternates: {
    canonical: `${SITE_URL}/login`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
