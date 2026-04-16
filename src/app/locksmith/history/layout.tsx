import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job History | Locksmith Portal | LockSafe UK",
  description: "View your completed jobs, reviews, and service history.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocksmithHistoryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
