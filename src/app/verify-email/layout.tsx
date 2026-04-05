import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Verify Email | ${SITE_NAME}`,
  description: `Verify your email address to complete your ${SITE_NAME} account setup.`,
  openGraph: {
    title: `Verify Email | ${SITE_NAME}`,
    description: `Verify your email address for your ${SITE_NAME} account.`,
    url: `${SITE_URL}/verify-email`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function VerifyEmailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
