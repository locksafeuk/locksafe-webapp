/**
 * §32 — Cost-per-verified-conversion kill switch (2026-06-17, GODMODE plan).
 *
 * Rolling 7-day window. For each ENABLED campaign:
 *   cost_per_verified_conv = spend_7d / verified_conversions_7d
 *
 * "Verified" means uploaded successfully via google-ads-conversions.ts
 * (status="uploaded") AND seen in the Google Ads `conversions` column
 * (we count Google's own metric — it's the only thing the auction
 * algorithm sees). If there are 0 verified conversions in 7 days and
 * spend > £100, cost_per_verified_conv is treated as Infinity.
 *
 * When `cost_per_verified_conv > KILL_SWITCH_THRESHOLD_GBP` (default
 * £150, override via env `KILL_SWITCH_CPC_THRESHOLD_GBP`), the campaign
 * is paused via the Google Ads `campaigns:mutate` API and an admin
 * alert fires.
 *
 * Pure threshold logic is split out as `evaluateKillSwitch()` so the
 * unit test can exercise it without Google + Telegram. The cron route
 * wraps it with the live query + mutate calls.
 */

export interface CampaignSpendRow {
  campaignId:           string;
  campaignName:         string;
  status:               string;
  spendGbp:             number;
  /** Verified conversions = `metrics.conversions` column for this
   *  campaign over the 7d window. We trust Google's count because the
   *  Stripe webhook upload writes back into this column. */
  verifiedConversions:  number;
}

export type KillSwitchDecision =
  | { campaignId: string; campaignName: string; action: "pause";   costPerConvGbp: number; reason: string }
  | { campaignId: string; campaignName: string; action: "keep";    costPerConvGbp: number; reason: string };

export interface KillSwitchOptions {
  /** Threshold for pause; default £150. */
  thresholdGbp?:        number;
  /** Spend floor before "0 conv" counts as Infinity; default £100. */
  zeroConvSpendFloor?:  number;
}

/**
 * Decide which campaigns to pause based on the 7-day rolling
 * cost-per-verified-conversion. Pure function — no I/O.
 *
 * Rules:
 *   • spend <= zeroConvSpendFloor AND 0 verified  → keep (too early to judge)
 *   • spend  > zeroConvSpendFloor AND 0 verified  → pause (cost = Infinity)
 *   • verified > 0  AND spend/verified > threshold → pause
 *   • otherwise                                    → keep
 */
export function evaluateKillSwitch(
  rows: readonly CampaignSpendRow[],
  options: KillSwitchOptions = {},
): KillSwitchDecision[] {
  const threshold        = options.thresholdGbp        ?? 150;
  const zeroConvSpendFloor = options.zeroConvSpendFloor ?? 100;

  const decisions: KillSwitchDecision[] = [];

  for (const row of rows) {
    const spend  = Number.isFinite(row.spendGbp) ? row.spendGbp : 0;
    const verified = Number.isFinite(row.verifiedConversions) ? row.verifiedConversions : 0;

    let costPerConv: number;
    if (verified <= 0) {
      if (spend > zeroConvSpendFloor) {
        costPerConv = Number.POSITIVE_INFINITY;
      } else {
        decisions.push({
          campaignId:     row.campaignId,
          campaignName:   row.campaignName,
          action:         "keep",
          costPerConvGbp: 0,
          reason: `0 verified conversions but only £${spend.toFixed(2)} spend in 7d (below £${zeroConvSpendFloor} floor); too early to judge.`,
        });
        continue;
      }
    } else {
      costPerConv = spend / verified;
    }

    if (costPerConv > threshold) {
      decisions.push({
        campaignId:     row.campaignId,
        campaignName:   row.campaignName,
        action:         "pause",
        costPerConvGbp: costPerConv,
        reason:
          verified <= 0
            ? `0 verified conversions in 7d with £${spend.toFixed(2)} spend (> £${zeroConvSpendFloor} floor) → cost-per-conv = Infinity, > £${threshold} threshold.`
            : `£${spend.toFixed(2)} / ${verified} verified = £${costPerConv.toFixed(2)} per conv > £${threshold} threshold.`,
      });
    } else {
      decisions.push({
        campaignId:     row.campaignId,
        campaignName:   row.campaignName,
        action:         "keep",
        costPerConvGbp: costPerConv,
        reason:         `£${spend.toFixed(2)} / ${verified} verified = £${costPerConv.toFixed(2)} per conv ≤ £${threshold}.`,
      });
    }
  }

  return decisions;
}
