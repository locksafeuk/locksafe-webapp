import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Available Jobs | Locksmith Portal | LockSafe UK",
  description: "Browse and apply for locksmith jobs in your coverage area. Filter by distance, job type, and urgency.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocksmithJobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
