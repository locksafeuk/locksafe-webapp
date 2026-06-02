/**
 * GET  /api/admin/google-ads/automation-rules — list all rules
 * POST /api/admin/google-ads/automation-rules — create or update a rule
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

const prismaAny = prisma as unknown as {
  googleAdsAutomationRule: {
    findMany: (opts: object) => Promise<unknown[]>;
    create: (opts: object) => Promise<unknown>;
    update: (opts: object) => Promise<unknown>;
  };
};

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rules = await prismaAny.googleAdsAutomationRule.findMany({
    orderBy: { createdAt: "desc" },
  } as object);

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    id?: string;
    name?: string;
    enabled?: boolean;
    condition?: string;
    thresholdSpend?: number;
    thresholdPeriodDays?: number;
    thresholdCtr?: number;
    action?: string;
    campaignIds?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, name, enabled, condition, thresholdSpend, thresholdPeriodDays, thresholdCtr, action, campaignIds } = body;

  if (!name?.trim()) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!condition) return NextResponse.json({ error: "condition is required" }, { status: 400 });
  if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

  const validConditions = ["SPEND_NO_CONV", "CTR_DROP", "BUDGET_80PCT"];
  const validActions = ["PAUSE_CAMPAIGN", "ALERT_TELEGRAM"];
  if (!validConditions.includes(condition)) return NextResponse.json({ error: "Invalid condition" }, { status: 400 });
  if (!validActions.includes(action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  const data = {
    name: name.trim(),
    enabled: enabled ?? true,
    condition,
    thresholdSpend: thresholdSpend ?? null,
    thresholdPeriodDays: thresholdPeriodDays ?? null,
    thresholdCtr: thresholdCtr ?? null,
    action,
    campaignIds: Array.isArray(campaignIds) ? campaignIds : ["*"],
  };

  if (id) {
    const updated = await prismaAny.googleAdsAutomationRule.update({
      where: { id },
      data,
    } as object);
    return NextResponse.json({ rule: updated });
  }

  const created = await prismaAny.googleAdsAutomationRule.create({ data } as object);
  return NextResponse.json({ rule: created }, { status: 201 });
}
