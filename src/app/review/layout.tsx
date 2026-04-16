import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Leave a Review | LockSafe UK",
  description: "Share your experience with your locksmith. Your review helps other customers make informed decisions.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ReviewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
