/**
 * Update ad 809706429260 final URL to the East London landing page.
 * RSA final_urls is mutable via ad.final_urls (the ad text is immutable; URLs aren't).
 *
 * Run with:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/update-ad-final-url.ts
 * DRY_RUN=1 to validate without writing.
 */

import { getDefaultGoogleAdsClient, buildResourceName } from "@/lib/google-ads";

const AD_ID = "809706429260";
const NEW_FINAL_URL = "https://www.locksafe.uk/locksmith-east-london";
const DRY_RUN = process.env.DRY_RUN === "1";

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;
  const cid = client.customerIdPlain;

  const adResource = buildResourceName(cid, "ads" as any, AD_ID).replace("ads", "ads");
  // buildResourceName doesn't accept "ads" in its type union; build manually:
  const adResourceName = `customers/${cid}/ads/${AD_ID}`;

  console.log(`[ad] updating final_urls on ${adResourceName} -> ${NEW_FINAL_URL} (dryRun=${DRY_RUN})`);
  try {
    await client.mutate(
      "ads",
      [
        {
          update: {
            resourceName: adResourceName,
            finalUrls: [NEW_FINAL_URL],
          },
          updateMask: "final_urls",
        },
      ],
      { validateOnly: DRY_RUN },
    );
    console.log("[ad] update succeeded");
  } catch (err: any) {
    console.error("[ad] update FAILED:", err.message);
    console.error("[ad] RSAs may be immutable; will need to create a replacement ad in same ad group.");
    throw err;
  }

  // Verify
  const rows = await client.query<any>(
    `SELECT ad_group_ad.ad.id, ad_group_ad.ad.final_urls, ad_group_ad.status,
            ad_group_ad.policy_summary.approval_status, ad_group_ad.policy_summary.review_status
     FROM ad_group_ad WHERE ad_group_ad.ad.id = ${AD_ID}`,
  );
  console.log("[verify]", JSON.stringify(rows[0], null, 2));
}

main().catch((e) => { process.exit(1); });
