import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Locksmith Login | ${SITE_NAME} Partner Portal`,
  description: `Sign in to your ${SITE_NAME} locksmith account. Manage jobs, view earnings, and update your availability.`,
  openGraph: {
    title: `Locksmith Login | ${SITE_NAME}`,
    description: `Access your ${SITE_NAME} locksmith partner portal.`,
    url: `${SITE_URL}/locksmith/login`,
    siteName: SITE_NAME,
    locale: "en_GB",
    type: "website",
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function LocksmithLoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
