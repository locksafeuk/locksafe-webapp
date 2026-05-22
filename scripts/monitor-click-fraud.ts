/**
 * Google Ads click-fraud monitor
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/monitor-click-fraud.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/monitor-click-fraud.ts --since=2026-05-20 --until=2026-05-22
 */

import { monitorGoogleAdsClickFraud } from "@/lib/google-ads-fraud-monitor";

function getArg(name: string): string | undefined {
  return process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
}

async function main() {
  const since = getArg("since");
  const until = getArg("until");

  const summary = await monitorGoogleAdsClickFraud({ since, until });

  if (!summary.ok) {
    throw new Error(summary.message || "Google Ads fraud monitor failed");
  }

  console.log("Google Ads fraud monitor summary:");
  console.log(`  Range: ${summary.range.since} -> ${summary.range.until}`);
  console.log(`  Campaigns monitored: ${summary.monitoredCampaigns}`);
  console.log(`  Suspicious campaigns: ${summary.suspiciousCampaigns}`);
  console.log(`  Campaigns paused: ${summary.pausedCampaigns}`);
  console.log(`  Alerts sent: ${summary.alertsSent}`);

  if (summary.suspicious.length > 0) {
    console.log("\nTop suspicious campaigns:");
    for (const campaign of summary.suspicious.slice(0, 10)) {
      console.log(
        `  - ${campaign.campaignName} (id=${campaign.campaignId}) invalid=${campaign.invalidClicks} (${(
          campaign.invalidClickRate * 100
        ).toFixed(1)}%) clicks=${campaign.clicks} conv=${campaign.conversions}`,
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
