/**
 * GET /api/cron/google-ads-automation-rules
 *
 * Runs every 4 hours (configured in vercel.json). Evaluates all enabled
 * automation rules and takes the configured action (pause or alert).
 *
 * Conditions:
 *   SPEND_NO_CONV  — campaign spent > threshold with 0 conversions in period
 *   CTR_DROP       — campaign CTR < threshold over last 7 days
 *   BUDGET_80PCT   — daily spend > 80% of daily budget
 */

import { NextRequest, NextResponse } from "next/server";
import { getDefaultGoogleAdsClient, GoogleAdsClient } from "@/lib/google-ads";
import { sendAdminAlert } from "@/lib/telegram";
import prisma from "@/lib/db";

const prismaAny = prisma as unknown as {
  googleAdsAutomationRule: {
    findMany: (opts: object) => Promise<AutomationRule[]>;
    update: (opts: object) => Promise<unknown>;
  };
};

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: string;
  thresholdSpend: number | null;
  thresholdPeriodDays: number | null;
  thresholdCtr: number | null;
  action: string;
  campaignIds: string[];
}

function fmt(d: Date): string { return d.toISOString().slice(0, 10); }

export async function GET(request: NextRequest) {
  // Validate cron secret to prevent external invocation
  const auth = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (process.env.CRON_SECRET && auth !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rules = await prismaAny.googleAdsAutomationRule.findMany({
    where: { enabled: true },
  } as object);

  if (rules.length === 0) {
    return NextResponse.json({ message: "No enabled rules", processed: 0 });
  }

  const clientData = await getDefaultGoogleAdsClient();
  if (!clientData) {
    return NextResponse.json({ message: "No active Google Ads account", processed: 0 });
  }

  const { client } = clientData;
  let triggered = 0;

  for (const rule of rules) {
    try {
      await processRule(rule, client, clientData.customerId);
      triggered++;
    } catch (err) {
      console.error(`[AutomationRules] rule ${rule.id} (${rule.name}) failed:`, err instanceof Error ? err.message : err);
    }
  }

  return NextResponse.json({ message: "Done", processed: rules.length, triggered });
}

async function processRule(
  rule: AutomationRule,
  client: GoogleAdsClient,
  _customerId: string,
) {
  const now = new Date();

  if (rule.condition === "SPEND_NO_CONV") {
    const periodDays = rule.thresholdPeriodDays ?? 7;
    const thresholdSpend = rule.thresholdSpend ?? 10;
    const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const gaql = `
      SELECT campaign.id, campaign.name, campaign.status, metrics.cost_micros, metrics.conversions
      FROM campaign
      WHERE segments.date BETWEEN '${fmt(since)}' AND '${fmt(now)}'
        AND campaign.status = 'ENABLED'
        AND metrics.cost_micros > ${thresholdSpend * 1_000_000}
        AND metrics.conversions = 0
      ORDER BY metrics.cost_micros DESC
    `;

    const rows = await client.query<{
      campaign: { id: string; name: string; status: string };
      metrics: { costMicros?: string };
    }>(gaql);

    const affected = rows.filter((r) => {
      if (rule.campaignIds.includes("*")) return true;
      return rule.campaignIds.includes(r.campaign.id);
    });

    if (affected.length === 0) return;

    await markTriggered(rule.id);

    if (rule.action === "ALERT_TELEGRAM") {
      const lines = affected.map((r) => `• ${r.campaign.name} — £${(Number(r.metrics.costMicros ?? 0) / 1_000_000).toFixed(2)} spent, 0 conversions`);
      await sendAdminAlert({
        title: `Google Ads: Spend with no conversions (${rule.name})`,
        message: `${affected.length} campaign(s) have spent over £${thresholdSpend} in ${periodDays} days with 0 conversions:\n${lines.join("\n")}`,
        severity: "warning",
        dedupeKey: `ads-rule-${rule.id}`,
        cooldownMsOverride: 4 * 60 * 60 * 1000,
      });
    } else if (rule.action === "PAUSE_CAMPAIGN") {
      for (const row of affected) {
        const resourceName = `customers/${_customerId}/campaigns/${row.campaign.id}`;
        await client.mutate("campaigns", [
          { update: { resourceName, status: "PAUSED" }, updateMask: "status" },
        ]);
      }
      const lines = affected.map((r) => `• ${r.campaign.name}`);
      await sendAdminAlert({
        title: `Google Ads: Paused ${affected.length} campaign(s) — no conversions (${rule.name})`,
        message: `Paused due to spend >£${thresholdSpend} with 0 conversions in ${periodDays}d:\n${lines.join("\n")}`,
        severity: "warning",
        dedupeKey: `ads-rule-${rule.id}`,
      });
    }
  } else if (rule.condition === "CTR_DROP") {
    const thresholdCtr = rule.thresholdCtr ?? 0.02;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const gaql = `
      SELECT campaign.id, campaign.name, metrics.ctr, metrics.impressions
      FROM campaign
      WHERE segments.date BETWEEN '${fmt(since)}' AND '${fmt(now)}'
        AND campaign.status = 'ENABLED'
        AND metrics.impressions > 100
      ORDER BY metrics.ctr ASC
    `;

    const rows = await client.query<{
      campaign: { id: string; name: string };
      metrics: { ctr?: number; impressions?: string };
    }>(gaql);

    const lowCtr = rows.filter((r) => {
      const inScope = rule.campaignIds.includes("*") || rule.campaignIds.includes(r.campaign.id);
      return inScope && Number(r.metrics.ctr ?? 0) < thresholdCtr;
    });

    if (lowCtr.length === 0) return;

    await markTriggered(rule.id);
    const lines = lowCtr.map((r) => `• ${r.campaign.name} — CTR ${(Number(r.metrics.ctr ?? 0) * 100).toFixed(2)}%`);
    await sendAdminAlert({
      title: `Google Ads: Low CTR detected (${rule.name})`,
      message: `${lowCtr.length} campaign(s) have CTR below ${(thresholdCtr * 100).toFixed(1)}% over the last 7 days:\n${lines.join("\n")}`,
      severity: "warning",
      dedupeKey: `ads-rule-${rule.id}`,
      cooldownMsOverride: 24 * 60 * 60 * 1000,
    });
  } else if (rule.condition === "BUDGET_80PCT") {
    // Check today's spend vs daily budget
    const todayStr = fmt(now);
    const gaql = `
      SELECT campaign.id, campaign.name, metrics.cost_micros, campaign_budget.amount_micros
      FROM campaign
      WHERE segments.date = '${todayStr}'
        AND campaign.status = 'ENABLED'
      ORDER BY metrics.cost_micros DESC
    `;

    const rows = await client.query<{
      campaign: { id: string; name: string };
      campaignBudget: { amountMicros?: string };
      metrics: { costMicros?: string };
    }>(gaql);

    const over80 = rows.filter((r) => {
      const inScope = rule.campaignIds.includes("*") || rule.campaignIds.includes(r.campaign.id);
      if (!inScope) return false;
      const budget = Number(r.campaignBudget?.amountMicros ?? 0);
      const spend = Number(r.metrics.costMicros ?? 0);
      if (budget <= 0) return false;
      return spend / budget >= 0.8;
    });

    if (over80.length === 0) return;

    await markTriggered(rule.id);
    const lines = over80.map((r) => {
      const budget = Number(r.campaignBudget?.amountMicros ?? 0);
      const spend = Number(r.metrics.costMicros ?? 0);
      const pct = budget > 0 ? ((spend / budget) * 100).toFixed(0) : "?";
      return `• ${r.campaign.name} — ${pct}% of daily budget used`;
    });
    await sendAdminAlert({
      title: `Google Ads: Budget 80%+ consumed today (${rule.name})`,
      message: lines.join("\n"),
      severity: "info",
      dedupeKey: `ads-rule-${rule.id}`,
      cooldownMsOverride: 4 * 60 * 60 * 1000,
    });
  }
}

async function markTriggered(id: string) {
  await prismaAny.googleAdsAutomationRule.update({
    where: { id },
    data: { lastTriggeredAt: new Date() },
  } as object);
}
