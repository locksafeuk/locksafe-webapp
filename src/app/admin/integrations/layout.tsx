"use client";

/**
 * Shared layout for all /admin/integrations/** routes.
 *
 * Wraps every page under this segment in the standard <AdminSidebar> so the
 * navigation chrome stays consistent with the rest of the admin. Without this,
 * the integrations pages rendered as bare full-width content, which made
 * browser-Back feel like it was jumping to a different menu item (because the
 * left sidebar vanished and then reappeared on the previous page).
 */

import { AdminSidebar } from "@/components/layout/AdminSidebar";

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminSidebar>{children}</AdminSidebar>;
}
