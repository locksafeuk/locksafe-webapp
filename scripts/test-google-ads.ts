/**
 * Google Ads Integration Test Script
 *
 * Connects to the Google Ads API using the credentials stored in the DB
 * (set via /admin/integrations/google-ads) and prints a full snapshot of
 * campaigns, top search terms, and account details to the console.
 *
 * Usage:
 *   npx ts-node --compiler-options '{"module":"CommonJS","strict":false}' scripts/test-google-ads.ts
 *
 * Optional flags:
 *   --days=N          Number of days to look back (default: 30)
 *   --top=N           Max search-term rows to display (default: 20)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { GoogleAdsClient } from "../src/lib/google-ads";

// ─── helpers ────────────────────────────────────────────────────────────────

function pad(s: string | number, n: number): string {
  return String(s).padEnd(n);
}
function rpad(s: string | number, n: number): string {
  return String(s).padStart(n);
}
function fmt(micros: number): string {
  return `£${(micros / 1_000_000).toFixed(2)}`;
}
function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}
function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return dateStr(d);
}
function hr(char = "─", width = 80): void {
  console.log(char.repeat(width));
}
function section(title: string): void {
  hr();
  console.log(`  ${title}`);
  hr();
}

// ─── parse args ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const days = parseInt(args.find((a) => a.startsWith("--days="))?.split("=")[1] ?? "30", 10);
const topN = parseInt(args.find((a) => a.startsWith("--top="))?.split("=")[1] ?? "20", 10);

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  // 1. Load connected account from DB
  section("Google Ads Integration Test");
  console.log(`  Date range : last ${days} days  (${daysAgo(days)} → ${dateStr(new Date())})`);
  console.log(`  Top terms  : ${topN}`);
  hr("─", 80);

  const account = await prisma.googleAdsAccount.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
  });

  if (!account) {
    console.error("\n❌  No active Google Ads account found in DB.");
    console.error("   → Go to /admin/integrations/google-ads and connect via OAuth first.\n");
    process.exit(1);
  }

  console.log(`\n✅  Account found:`);
  console.log(`     Customer ID  : ${account.customerId}`);
  console.log(`     Name         : ${account.name}`);
  console.log(`     Currency     : ${account.currency}`);
  console.log(`     Timezone     : ${account.timezone}`);
  console.log(`     Last sync    : ${account.lastSyncAt ? account.lastSyncAt.toISOString() : "never"}`);
  console.log(`     Token expiry : ${account.tokenExpiresAt?.toISOString() ?? "unknown"}`);

  // Load API config (developer token etc.) from DB / env
  const { getGoogleAdsApiConfig } = await import("../src/lib/google-ads");
  const cfg = await getGoogleAdsApiConfig();
  if (!cfg) {
    console.error("\n❌  Google Ads API credentials not configured in DB or .env.\n");
    process.exit(1);
  }

  const client = new GoogleAdsClient({
    customerId: account.customerId,
    refreshToken: account.refreshToken,
    accessToken: account.accessToken ?? undefined,
    accessTokenExpiresAt: account.tokenExpiresAt ?? undefined,
    loginCustomerId: cfg.loginCustomerId,
  });

  const range = { since: daysAgo(days), until: dateStr(new Date()) };

  // ── 2. Campaigns ────────────────────────────────────────────────────────────
  section(`Campaign Performance  (last ${days} days)`);

  let campaigns;
  try {
    campaigns = await client.getCampaignMetrics(range);
  } catch (err) {
    console.error("\n❌  getCampaignMetrics failed:");
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (campaigns.length === 0) {
    console.log("  (no campaigns found — account may be new or have no data in range)");
  } else {
    const colW = [28, 12, 10, 8, 10, 8, 9, 9];
    const header = [
      pad("Campaign", colW[0]),
      rpad("Status", colW[1]),
      rpad("Impr.", colW[2]),
      rpad("Clicks", colW[3]),
      rpad("Spend", colW[4]),
      rpad("Conv.", colW[5]),
      rpad("CTR", colW[6]),
      rpad("Avg CPC", colW[7]),
    ].join("  ");

    console.log(`  ${header}`);
    hr("─", 80);

    let totalSpend = 0;
    let totalImpr = 0;
    let totalClicks = 0;
    let totalConv = 0;

    for (const c of campaigns) {
      const name = c.campaignName.length > 26 ? c.campaignName.slice(0, 25) + "…" : c.campaignName;
      console.log([
        "  " + pad(name, colW[0]),
        rpad(c.status, colW[1]),
        rpad(c.impressions.toLocaleString(), colW[2]),
        rpad(c.clicks.toLocaleString(), colW[3]),
        rpad(fmt(c.costMicros), colW[4]),
        rpad(c.conversions.toFixed(1), colW[5]),
        rpad(pct(c.ctr), colW[6]),
        rpad(fmt(c.averageCpc), colW[7]),
      ].join("  "));
      totalSpend += c.costMicros;
      totalImpr += c.impressions;
      totalClicks += c.clicks;
      totalConv += c.conversions;
    }

    hr("─", 80);
    console.log([
      "  " + pad(`TOTAL (${campaigns.length} campaigns)`, colW[0]),
      rpad("", colW[1]),
      rpad(totalImpr.toLocaleString(), colW[2]),
      rpad(totalClicks.toLocaleString(), colW[3]),
      rpad(fmt(totalSpend), colW[4]),
      rpad(totalConv.toFixed(1), colW[5]),
    ].join("  "));
  }

  // ── 3. Search Terms ─────────────────────────────────────────────────────────
  section(`Top ${topN} Search Terms  (by spend)`);

  let searchTerms;
  try {
    searchTerms = await client.getSearchTermsReport(range);
  } catch (err) {
    console.warn("  ⚠️  Could not fetch search terms:", err instanceof Error ? err.message : err);
    searchTerms = [];
  }

  if (searchTerms.length === 0) {
    console.log("  (no search term data in range)");
  } else {
    const top = searchTerms.slice(0, topN);
    const colW = [36, 14, 8, 8, 8, 8];
    const header = [
      pad("Search Term", colW[0]),
      pad("Campaign", colW[1]),
      rpad("Impr.", colW[2]),
      rpad("Clicks", colW[3]),
      rpad("Spend", colW[4]),
      rpad("Conv.", colW[5]),
    ].join("  ");

    console.log(`  ${header}`);
    hr("─", 80);

    for (const t of top) {
      const term = t.searchTerm.length > 34 ? t.searchTerm.slice(0, 33) + "…" : t.searchTerm;
      const camp = t.campaignName.length > 12 ? t.campaignName.slice(0, 11) + "…" : t.campaignName;
      console.log([
        "  " + pad(term, colW[0]),
        pad(camp, colW[1]),
        rpad(t.impressions.toLocaleString(), colW[2]),
        rpad(t.clicks.toLocaleString(), colW[3]),
        rpad(fmt(t.costMicros), colW[4]),
        rpad(t.conversions.toFixed(1), colW[5]),
      ].join("  "));
    }

    if (searchTerms.length > topN) {
      console.log(`\n  … and ${searchTerms.length - topN} more terms (use --top=N to show more)`);
    }
  }

  // ── 4. Campaign Drafts in DB ─────────────────────────────────────────────────
  section("Campaign Drafts in DB");

  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      status: true,
      dailyBudget: true,
      googleCampaignId: true,
      createdAt: true,
    },
  });

  if (drafts.length === 0) {
    console.log("  (no drafts — CMO agent hasn't generated any yet)");
  } else {
    for (const d of drafts) {
      const published = d.googleCampaignId ? ` → Campaign #${d.googleCampaignId}` : "";
      console.log(`  [${d.status.padEnd(16)}]  £${d.dailyBudget.toFixed(2)}/day  ${d.name}${published}`);
    }
  }

  hr();
  console.log("\n✅  Done.\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("\n❌  Script crashed:", err);
  process.exit(1);
});
