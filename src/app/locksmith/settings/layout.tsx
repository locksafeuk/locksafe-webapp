import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | Locksmith Portal | LockSafe UK",
  description: "Manage your profile, coverage area, availability, and account settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocksmithSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
