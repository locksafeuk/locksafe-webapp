import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Earnings & Payouts | Locksmith Portal | LockSafe UK",
  description: "View your earnings, track payouts, and manage your Stripe Connect account for fast bank transfers.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LocksmithEarningsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
