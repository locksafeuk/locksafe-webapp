import type { Metadata } from "next";
import { LaunchEngineClient } from "./LaunchEngineClient";

export const metadata: Metadata = {
  title: "Launch Acquisition Engine — LockSafe Admin",
  robots: { index: false, follow: false },
};

export default function LaunchAcquisitionEnginePage() {
  return <LaunchEngineClient />;
}
