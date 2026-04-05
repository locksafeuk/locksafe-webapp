import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Details | Locksmith Portal | LockSafe UK",
  description: "View job details, submit quotes, and manage your locksmith work.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocksmithJobLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
