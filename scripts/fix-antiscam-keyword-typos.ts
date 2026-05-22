/**
 * Fix keyword typos in the live AntiScam campaign (23876350462).
 *
 *   "locksmith hidden fess" -> "locksmith hidden fees"
 *   "rogur locksmith"       -> "rogue locksmith"
 *
 * Strategy: remove the typo criterion, then add a corrected one with the
 * same match type. Runs idempotently — if the typo is already gone, it
 * just no-ops.
 */
import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";

const CAMPAIGN_ID = "23876350462";
const DRY_RUN = process.env.DRY_RUN === "1";

const FIXES: Array<{ typo: string; correct: string }> = [
  { typo: "locksmith hidden fess", correct: "locksmith hidden fees" },
  { typo: "rogur locksmith", correct: "rogue locksmith" },
];

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("no active Google Ads account");
  const { client } = ctx;
  const cid = client.customerIdPlain;

  const rows = await client.query<any>(
    `SELECT ad_group.id,
            ad_group_criterion.criterion_id,
            ad_group_criterion.keyword.text,
            ad_group_criterion.keyword.match_type,
            ad_group_criterion.status
     FROM ad_group_criterion
     WHERE campaign.id = ${CAMPAIGN_ID}
       AND ad_group_criterion.type = 'KEYWORD'
       AND ad_group_criterion.status != 'REMOVED'`,
  );

  const removes: any[] = [];
  const creates: any[] = [];

  for (const r of rows) {
    const text = r.adGroupCriterion?.keyword?.text as string | undefined;
    const matchType = r.adGroupCriterion?.keyword?.matchType as string | undefined;
    const critId = r.adGroupCriterion?.criterionId as string | undefined;
    const adGroupId = r.adGroup?.id as string | undefined;
    if (!text || !critId || !adGroupId) continue;

    const fix = FIXES.find((f) => f.typo.toLowerCase() === text.toLowerCase());
    if (!fix) continue;

    console.log(`[fix] ad_group=${adGroupId} crit=${critId} "${text}" -> "${fix.correct}" (${matchType})`);
    removes.push({
      remove: `customers/${cid}/adGroupCriteria/${adGroupId}~${critId}`,
    });
    creates.push({
      create: {
        adGroup: buildResourceName(cid, "adGroups", adGroupId),
        status: "ENABLED",
        keyword: { text: fix.correct, matchType: matchType ?? "BROAD" },
      },
    });
  }

  if (!removes.length) {
    console.log("[done] no typo keywords found — nothing to fix");
    return;
  }

  // Do removes first, then creates (separate mutate calls keep things clear)
  await client.mutate("adGroupCriteria", removes, { validateOnly: DRY_RUN });
  console.log(`[remove] ${removes.length} typo keyword(s) removed`);
  await client.mutate("adGroupCriteria", creates, { validateOnly: DRY_RUN });
  console.log(`[create] ${creates.length} corrected keyword(s) added`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
