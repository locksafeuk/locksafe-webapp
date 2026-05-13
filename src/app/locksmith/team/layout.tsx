import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Team | Locksmith Portal | LockSafe UK",
  description: "Manage your team and set commission splits for your locksmiths.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocksmithTeamLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
