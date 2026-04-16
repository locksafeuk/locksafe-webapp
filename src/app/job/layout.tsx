import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Details | LockSafe UK",
  description: "View job details, status updates, and completion information.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function JobLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
