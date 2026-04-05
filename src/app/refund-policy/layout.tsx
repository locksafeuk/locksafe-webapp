import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/config";

export const metadata: Metadata = {
  title: `Refund Policy | ${SITE_NAME}`,
  description: `${SITE_NAME} refund policy - Full refund if locksmith doesn't arrive. Fair protection for customers and locksmiths.`,
  openGraph: {
    title: `Refund Policy | ${SITE_NAME}`,
    description: `${SITE_NAME} refund policy - Full refund if locksmith doesn't arrive. Fair protection for customers and locksmiths.`,
  },
};

export default function RefundPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
