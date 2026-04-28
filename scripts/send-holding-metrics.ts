/**
 * Manual runner for the Holding Dashboard metrics sender.
 *
 * Usage:
 *   bun run holding:metrics
 *   bun run holding:metrics -- --verbose   # also prints the snapshot
 *
 * Never prints HOLDING_API_TOKEN or CRON_SECRET.
 */
import { collectHoldingMetrics } from "../src/lib/holding/metrics";
import { sendHoldingMetrics } from "../src/lib/holding/client";

async function main() {
  const verbose = process.argv.includes("--verbose");

  const snapshot = await collectHoldingMetrics();
  if (verbose) {
    console.log("Snapshot:", JSON.stringify(snapshot, null, 2));
  } else {
    console.log(
      `Snapshot built for platform=${snapshot.platform.id} period=${snapshot.period.date}`,
    );
  }

  const result = await sendHoldingMetrics(snapshot);
  console.log(
    JSON.stringify({
      success: result.success,
      skipped: result.skipped ?? false,
      status: result.status ?? null,
      reason: result.reason ?? null,
      error: result.error ?? null,
      platform_id: snapshot.platform.id,
      sent_at: new Date().toISOString(),
    }),
  );

  if (!result.success && !result.skipped) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[send-holding-metrics] fatal:", (err as Error)?.message);
  process.exitCode = 1;
});
