import { getDefaultGoogleAdsClient } from "@/lib/google-ads";
import { sendAdminAlert } from "@/lib/telegram";

interface MonitorOptions {
  since?: string;
  until?: string;
}

interface CampaignFraudRow {
  campaignId: string;
  campaignName: string;
  status: string;
  clicks: number;
  conversions: number;
  invalidClicks: number;
  invalidClickRate: number;
  costMicros: number;
}

interface MonitorSummary {
  ok: boolean;
  monitoredCampaigns: number;
  suspiciousCampaigns: number;
  pausedCampaigns: number;
  alertsSent: number;
  suspicious: CampaignFraudRow[];
  range: { since: string; until: string };
  message?: string;
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return 0;
}

function formatCost(micros: number): string {
  return `£${(micros / 1_000_000).toFixed(2)}`;
}

export async function monitorGoogleAdsClickFraud(
  options: MonitorOptions = {},
): Promise<MonitorSummary> {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) {
    return {
      ok: false,
      monitoredCampaigns: 0,
      suspiciousCampaigns: 0,
      pausedCampaigns: 0,
      alertsSent: 0,
      suspicious: [],
      range: { since: "", until: "" },
      message: "No active Google Ads account found",
    };
  }

  const { client } = ctx;

  const defaultSince = new Date();
  defaultSince.setDate(defaultSince.getDate() - 1);
  const since = options.since || toDateString(defaultSince);
  const until = options.until || toDateString(new Date());

  const minInvalidClicks = Math.max(
    1,
    Number.parseInt(process.env.GOOGLE_ADS_FRAUD_MIN_INVALID_CLICKS || "8", 10) || 8,
  );
  const minInvalidRate = Math.max(
    0.01,
    Number.parseFloat(process.env.GOOGLE_ADS_FRAUD_MIN_INVALID_RATE || "0.25") || 0.25,
  );
  const minClicks = Math.max(
    1,
    Number.parseInt(process.env.GOOGLE_ADS_FRAUD_MIN_CLICKS || "20", 10) || 20,
  );
  const maxConversions = Math.max(
    0,
    Number.parseFloat(process.env.GOOGLE_ADS_FRAUD_MAX_CONVERSIONS || "1") || 1,
  );
  const autoPause = process.env.GOOGLE_ADS_FRAUD_AUTO_PAUSE === "true";
  const sendAlerts = process.env.GOOGLE_ADS_FRAUD_ALERTS_ENABLED !== "false";

  const rows = await client.query<any>(`
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      metrics.clicks,
      metrics.conversions,
      metrics.invalid_clicks,
      metrics.invalid_click_rate,
      metrics.cost_micros
    FROM campaign
    WHERE segments.date BETWEEN '${since}' AND '${until}'
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.invalid_clicks DESC
  `);

  const campaigns: CampaignFraudRow[] = rows.map((row: any) => ({
    campaignId: String(row.campaign?.id || ""),
    campaignName: String(row.campaign?.name || ""),
    status: String(row.campaign?.status || "UNKNOWN"),
    clicks: parseNumber(row.metrics?.clicks),
    conversions: parseNumber(row.metrics?.conversions),
    invalidClicks: parseNumber(row.metrics?.invalidClicks),
    invalidClickRate: parseNumber(row.metrics?.invalidClickRate),
    costMicros: parseNumber(row.metrics?.costMicros),
  }));

  const suspicious = campaigns.filter((campaign) =>
    campaign.clicks >= minClicks &&
    campaign.invalidClicks >= minInvalidClicks &&
    campaign.invalidClickRate >= minInvalidRate &&
    campaign.conversions <= maxConversions,
  );

  let pausedCampaigns = 0;
  if (autoPause) {
    for (const campaign of suspicious) {
      if (campaign.status !== "ENABLED") continue;

      try {
        await client.mutate("campaigns", [
          {
            update: {
              resourceName: `customers/${client.customerIdPlain}/campaigns/${campaign.campaignId}`,
              status: "PAUSED",
            },
            updateMask: "status",
          },
        ]);
        pausedCampaigns += 1;
      } catch (error) {
        console.error("[GAds Fraud Monitor] Failed to pause campaign", campaign.campaignId, error);
      }
    }
  }

  let alertsSent = 0;
  if (sendAlerts && suspicious.length > 0) {
    const top = suspicious.slice(0, 5);
    const lines = top.map((campaign) =>
      `${campaign.campaignName} | invalid=${campaign.invalidClicks} (${(campaign.invalidClickRate * 100).toFixed(1)}%) | clicks=${campaign.clicks} | conv=${campaign.conversions} | spend=${formatCost(campaign.costMicros)}`,
    );

    const message = [
      `Range: ${since} -> ${until}`,
      `Suspicious campaigns: ${suspicious.length}`,
      autoPause ? `Auto-paused: ${pausedCampaigns}` : "Auto-paused: disabled",
      "",
      ...lines,
    ].join("\n");

    try {
      const sent = await sendAdminAlert({
        title: "Google Ads click-fraud signal",
        message,
        severity: "warning",
        bypassPolicyGate: true,
      });
      alertsSent = sent ? 1 : 0;
    } catch (error) {
      console.error("[GAds Fraud Monitor] Failed sending alert", error);
    }
  }

  return {
    ok: true,
    monitoredCampaigns: campaigns.length,
    suspiciousCampaigns: suspicious.length,
    pausedCampaigns,
    alertsSent,
    suspicious,
    range: { since, until },
  };
}
