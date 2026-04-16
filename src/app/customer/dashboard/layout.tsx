import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Customer Portal | LockSafe UK",
  description: "View and manage your locksmith requests. Track active jobs, view quotes, and access your service history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
