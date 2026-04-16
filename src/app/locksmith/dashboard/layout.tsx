import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard | Locksmith Portal | LockSafe UK",
  description: "View your locksmith dashboard - track earnings, active jobs, and find new work opportunities in your area.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocksmithDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
