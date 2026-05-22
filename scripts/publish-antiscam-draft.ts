/**
 * Publish draft 6a0f8700240e1b81545583c7 (AntiScam) directly via publishGoogleAdsDraft.
 */
import { publishGoogleAdsDraft } from "@/lib/google-ads-publish";

const DRAFT_ID = "6a0f8700240e1b81545583c7";

async function main() {
  console.log(`[publish] starting for draft ${DRAFT_ID}`);
  const result = await publishGoogleAdsDraft(DRAFT_ID);
  console.log("[publish] result:", JSON.stringify(result, null, 2));
}
main().catch((e) => { console.error("[publish] FAILED:", e?.message || e); process.exit(1); });
