/**
 * POST /api/admin/google-ads/opportunities/scan
 *
 * Manually trigger an Opportunity Scout run. Used by the admin UI's
 * "Run scan now" button. Caps the scan size to keep latency reasonable
 * (full weekly cron runs via /api/cron/google-ads-opportunity-scout).
 *
 * Auth: admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { runOpportunityScoutHeartbeat } from "@/agents/cmo/subagents/opportunity-scout/agent";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    skipRecruit?: boolean;
    skipAutoDraft?: boolean;
    maxCoverageGeos?: number;
    maxRecruitGeos?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine
  }

  const result = await runOpportunityScoutHeartbeat({
    skipRecruit: body.skipRecruit ?? false,
    skipAutoDraft: body.skipAutoDraft ?? true, // manual runs default to no-auto-draft
    maxCoverageGeos: body.maxCoverageGeos ?? 15,
    maxRecruitGeos: body.maxRecruitGeos ?? 10,
  });

  return NextResponse.json(result);
}
