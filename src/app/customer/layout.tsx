import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Customer Portal | LockSafe UK",
    default: "Customer Portal | LockSafe UK",
  },
  description: "Manage your locksmith requests, view quotes, track jobs in real-time, and access your service history.",
  openGraph: {
    title: "Customer Portal | LockSafe UK",
    description: "Manage your locksmith requests and track jobs in real-time.",
    siteName: "LockSafe UK",
    locale: "en_GB",
    type: "website",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
