import type { Metadata } from "next";
import { ApprovalsClient } from "./ApprovalsClient";

export const metadata: Metadata = {
  title: "Agent Approvals — LockSafe Admin",
  robots: { index: false, follow: false },
};

export default function AgentApprovalsPage() {
  return <ApprovalsClient />;
}
