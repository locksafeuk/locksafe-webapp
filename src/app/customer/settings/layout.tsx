import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings | Customer Portal | LockSafe UK",
  description: "Manage your account settings, update your profile, and configure notification preferences.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CustomerSettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
