/**
 * Resolve location criterion IDs to human-readable names via geo_target_constant.
 */
import { getDefaultGoogleAdsClient } from "@/lib/google-ads";

const IDS = ["9198373", "9198785", "9198805", "9198858", "9208638", "1006460", "1006463"];

async function main() {
  const ctx = await getDefaultGoogleAdsClient();
  if (!ctx) throw new Error("No active GoogleAdsAccount");
  const { client } = ctx;
  const resourceNames = IDS.map((id) => `'geoTargetConstants/${id}'`).join(",");
  const rows = await client.query<any>(
    `SELECT geo_target_constant.id, geo_target_constant.name,
            geo_target_constant.country_code, geo_target_constant.target_type,
            geo_target_constant.canonical_name, geo_target_constant.status
     FROM geo_target_constant
     WHERE geo_target_constant.resource_name IN (${resourceNames})`,
  );
  for (const r of rows) {
    console.log(r.geoTargetConstant);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
