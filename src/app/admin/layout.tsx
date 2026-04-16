import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | Admin | LockSafe UK",
    default: "Admin Dashboard | LockSafe UK",
  },
  description: "LockSafe UK Admin Portal - Manage locksmiths, jobs, payments, and analytics.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
