import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Details | Customer Portal | LockSafe UK",
  description: "Track your locksmith job in real-time. View locksmith location, quotes, and job progress.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerJobLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
