/**
 * GET  /api/admin/agents/policy   — list all MarketingPolicy rows (global, meta, google)
 * POST /api/admin/agents/policy   — upsert one platform's policy. Body matches MarketingPolicy fields.
 *
 * The "Stop everything" kill switch is implemented as POST with
 * { platform: "global", autonomyEnabled: false }.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { killSwitchAll } from "@/lib/spend-guard";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

const ALLOWED_PLATFORMS = new Set(["global", "meta", "google"]);

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const policies = await prisma.marketingPolicy.findMany({ orderBy: { platform: "asc" } });
  return NextResponse.json({ policies });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const platform = String(body.platform ?? "");
  if (!ALLOWED_PLATFORMS.has(platform)) {
    return NextResponse.json(
      { error: "platform must be one of global, meta, google" },
      { status: 400 },
    );
  }

  // Special path: emergency kill-switch. Disables autonomy on every row.
  if (body.killAll === true) {
    await killSwitchAll(admin.id, String(body.notes ?? "").slice(0, 500));
    console.warn(`[policy] kill-switch invoked by admin ${admin.id}`);
    const policies = await prisma.marketingPolicy.findMany({ orderBy: { platform: "asc" } });
    return NextResponse.json({ ok: true, policies });
  }

  const numericFields = [
    "maxDailySpend",
    "maxMonthlySpend",
    "maxCampaignDailyBudget",
    "minCampaignDailyBudget",
    "autoApproveMaxBudget",
    "maxWeeklyAutoApproveSpend",
    "pauseRoasThreshold",
    "pauseGraceDays",
    "minImpressionsForPause",
  ] as const;

  const data: Record<string, unknown> = {
    platform,
    updatedBy: admin.id,
  };
  if (typeof body.autonomyEnabled === "boolean") data.autonomyEnabled = body.autonomyEnabled;
  if (typeof body.notifyOnAutoAction === "boolean") {
    data.notifyOnAutoAction = body.notifyOnAutoAction;
  }
  if (typeof body.notes === "string") data.notes = body.notes.slice(0, 500);
  for (const f of numericFields) {
    if (body[f] !== undefined) {
      const n = Number(body[f]);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: `${f} must be a non-negative number` },
          { status: 400 },
        );
      }
      data[f] = n;
    }
  }

  // Sanity check: campaign budget cap should not exceed daily cap (the agent
  // could create a single campaign that immediately busts the daily budget).
  const proposedCampaignCap = Number(data.maxCampaignDailyBudget ?? 0);
  const proposedDailyCap = Number(data.maxDailySpend ?? 0);
  if (proposedCampaignCap && proposedDailyCap && proposedCampaignCap > proposedDailyCap) {
    return NextResponse.json(
      { error: "maxCampaignDailyBudget cannot exceed maxDailySpend" },
      { status: 400 },
    );
  }

  const row = await prisma.marketingPolicy.upsert({
    where: { platform },
    create: data as never,
    update: data,
  });

  console.log(
    `[policy] ${platform} updated by admin ${admin.id} → autonomyEnabled=${row.autonomyEnabled}`,
  );
  return NextResponse.json({ ok: true, policy: row });
}
