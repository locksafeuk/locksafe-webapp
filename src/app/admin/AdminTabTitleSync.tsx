"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ROUTE_TITLES: Array<{ test: (path: string) => boolean; title: string }> = [
  { test: (path) => path === "/admin", title: "Admin Dashboard" },
  { test: (path) => path.startsWith("/admin/jobs"), title: "Jobs" },
  { test: (path) => path.startsWith("/admin/agents/approvals"), title: "Agent Approvals" },
  { test: (path) => path.startsWith("/admin/agents/tasks"), title: "Agent Tasks" },
  { test: (path) => path.startsWith("/admin/agents/reflections"), title: "Agent Reflections" },
  { test: (path) => path.startsWith("/admin/agents/goals"), title: "Agent Goals" },
  { test: (path) => path.startsWith("/admin/agents/policy"), title: "Agent Policy" },
  { test: (path) => path.startsWith("/admin/agents"), title: "Agents" },
  { test: (path) => path.startsWith("/admin/locksmiths/coverage"), title: "Locksmith Coverage" },
  { test: (path) => path.startsWith("/admin/locksmiths"), title: "Locksmiths" },
  { test: (path) => path.startsWith("/admin/locksmith-teams"), title: "Locksmith Teams" },
  { test: (path) => path.startsWith("/admin/customers"), title: "Customers" },
  { test: (path) => path.startsWith("/admin/payouts"), title: "Payouts" },
  { test: (path) => path.startsWith("/admin/payments"), title: "Payments" },
  { test: (path) => path.startsWith("/admin/refunds"), title: "Refunds" },
  { test: (path) => path.startsWith("/admin/disputes"), title: "Disputes" },
  { test: (path) => path.startsWith("/admin/organic"), title: "Organic" },
  { test: (path) => path.startsWith("/admin/emails"), title: "Email Campaigns" },
  { test: (path) => path.startsWith("/admin/seo"), title: "SEO" },
  { test: (path) => path.startsWith("/admin/attribution"), title: "Attribution" },
  { test: (path) => path.startsWith("/admin/ads"), title: "Ads" },
  { test: (path) => path.startsWith("/admin/integrations/google-ads"), title: "Google Ads" },
  { test: (path) => path.startsWith("/admin/integrations"), title: "Integrations" },
  { test: (path) => path.startsWith("/admin/security"), title: "Security" },
  { test: (path) => path.startsWith("/admin/settings"), title: "Settings" },
  { test: (path) => path.startsWith("/admin/leads"), title: "Leads" },
  { test: (path) => path.startsWith("/admin/referrals"), title: "Referrals" },
  { test: (path) => path.startsWith("/admin/subscriptions"), title: "Subscriptions" },
  { test: (path) => path.startsWith("/admin/voice-receptionist"), title: "Voice Receptionist" },
  { test: (path) => path.startsWith("/admin/analytics"), title: "Analytics" },
  { test: (path) => path.startsWith("/admin/organisations"), title: "Organisations" },
  { test: (path) => path.startsWith("/admin/commission-tiers"), title: "Commission Tiers" },
  { test: (path) => path.startsWith("/admin/marketing"), title: "Marketing" },
  { test: (path) => path.startsWith("/admin/ops"), title: "Ops" },
  { test: (path) => path.startsWith("/admin/testing"), title: "Testing" },
  { test: (path) => path.startsWith("/admin/login"), title: "Admin Login" },
];

function titleCaseFromSegment(segment: string): string {
  return segment
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function resolveAdminTabTitle(pathname: string): string {
  const match = ROUTE_TITLES.find((item) => item.test(pathname));
  if (match) return `${match.title} | Admin | LockSafe UK`;

  const parts = pathname.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || last === "admin") return "Admin Dashboard | LockSafe UK";

  return `${titleCaseFromSegment(last)} | Admin | LockSafe UK`;
}

export function AdminTabTitleSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!pathname?.startsWith("/admin")) return;

    const desired = resolveAdminTabTitle(pathname);

    // Set the title immediately and again on the next animation frame to
    // win against Next.js's metadata head manager which can re-apply the
    // layout's default title shortly after our effect runs.
    const apply = () => {
      if (document.title !== desired) document.title = desired;
    };
    apply();
    const raf1 = requestAnimationFrame(() => {
      apply();
      // One more pass on the following frame in case the metadata manager
      // updates after the first paint.
      requestAnimationFrame(apply);
    });

    // Guard against any later re-write of <title> while this route is
    // active by watching the <title> element for mutations.
    const titleEl = document.querySelector("title");
    let observer: MutationObserver | null = null;
    if (titleEl) {
      observer = new MutationObserver(() => {
        if (document.title !== desired) document.title = desired;
      });
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }

    return () => {
      cancelAnimationFrame(raf1);
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
