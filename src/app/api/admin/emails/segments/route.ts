import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { getLocksmithSegmentCounts } from "@/lib/email-campaign-recipient-segments";

export async function GET() {
  const admin = await isAdminAuthenticated();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const counts = await getLocksmithSegmentCounts();
    return NextResponse.json({
      success: true,
      segments: [
        {
          key: "all_locksmiths",
          label: "All locksmiths",
          description: "All locksmiths with email notifications enabled",
          count: counts.all_locksmiths,
        },
        {
          key: "active_locksmiths",
          label: "Active locksmiths",
          description: "Locksmiths marked active in profile",
          count: counts.active_locksmiths,
        },
        {
          key: "inactive_locksmiths",
          label: "Inactive locksmiths",
          description: "Locksmiths currently marked inactive",
          count: counts.inactive_locksmiths,
        },
        {
          key: "stripe_not_onboarded",
          label: "Stripe not onboarded",
          description: "Locksmiths who still need Stripe onboarding",
          count: counts.stripe_not_onboarded,
        },
        {
          key: "schedule_enabled",
          label: "Schedule enabled",
          description: "Locksmiths using automatic availability schedule",
          count: counts.schedule_enabled,
        },
        {
          key: "no_base_location",
          label: "No base location",
          description: "Locksmiths missing base coordinates",
          count: counts.no_base_location,
        },
      ],
    });
  } catch (error) {
    console.error("[admin/emails/segments] Failed to load segment counts:", error);
    return NextResponse.json({ error: "Failed to fetch segments" }, { status: 500 });
  }
}
