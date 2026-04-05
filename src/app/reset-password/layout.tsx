import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Reset Password | ${SITE_NAME}`,
  description: `Create a new password for your ${SITE_NAME} account.`,
  openGraph: {
    title: `Reset Password | ${SITE_NAME}`,
    description: `Create a new password for your ${SITE_NAME} account.`,
    url: `${SITE_URL}/reset-password`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
