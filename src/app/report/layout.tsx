import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Job Report | LockSafe UK",
  description: "View your complete job report including photos, documentation, and invoice details.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
