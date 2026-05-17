import type { Metadata } from "next";
import { Suspense } from "react";
import CoverClient from "./CoverClient";

export const metadata: Metadata = {
  title: "LockSafe Cover | Protect Your Home",
  description:
    "Get 50% off every locksmith callout, priority dispatch, and one free callout per month with LockSafe Cover.",
  alternates: { canonical: "/customer/cover" },
};

export default function CoverPage() {
  return (
    <Suspense>
      <CoverClient />
    </Suspense>
  );
}
