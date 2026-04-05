import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Forgot Password | ${SITE_NAME}`,
  description: `Reset your ${SITE_NAME} account password. We'll send you a secure link to create a new password.`,
  openGraph: {
    title: `Forgot Password | ${SITE_NAME}`,
    description: `Reset your ${SITE_NAME} account password.`,
    url: `${SITE_URL}/forgot-password`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
