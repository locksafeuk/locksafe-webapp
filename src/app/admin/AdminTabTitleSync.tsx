"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const ROUTE_TITLES: Array<{ test: (path: string) => boolean; title: string }> = [
  { test: (path) => path === "/admin", title: "Admin Dashboard" },
  { test: (path) => path.startsWith("/admin/jobs"), title: "Jobs" },
  { test: (path) => path.startsWith("/admin/agents/approvals"), title: "Agent Approvals" },
  { test: (path) => path.startsWith("/admin/agents"), title: "Agents" },
  { test: (path) => path.startsWith("/admin/locksmiths"), title: "Locksmiths" },
  { test: (path) => path.startsWith("/admin/customers"), title: "Customers" },
  { test: (path) => path.startsWith("/admin/payouts"), title: "Payouts" },
  { test: (path) => path.startsWith("/admin/refunds"), title: "Refunds" },
  { test: (path) => path.startsWith("/admin/disputes"), title: "Disputes" },
  { test: (path) => path.startsWith("/admin/organic"), title: "Organic" },
  { test: (path) => path.startsWith("/admin/emails"), title: "Email Campaigns" },
  { test: (path) => path.startsWith("/admin/seo"), title: "SEO" },
  { test: (path) => path.startsWith("/admin/attribution"), title: "Attribution" },
  { test: (path) => path.startsWith("/admin/ads"), title: "Ads" },
  { test: (path) => path.startsWith("/admin/integrations"), title: "Integrations" },
  { test: (path) => path.startsWith("/admin/security"), title: "Security" },
  { test: (path) => path.startsWith("/admin/settings"), title: "Settings" },
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
    if (!pathname?.startsWith("/admin")) return;
    document.title = resolveAdminTabTitle(pathname);
  }, [pathname]);

  return null;
}
