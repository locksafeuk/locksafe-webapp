/**
 * Scheduled job: top up the poster image library.
 *
 * Generates a small batch of text-free background assets via Draw Things,
 * vision-gates them, and stores the passers as PENDING_REVIEW for human
 * approval. Run from cron on the Mac (see scripts/poster-library-cron.sh) so the
 * approved pool stays stocked ahead of posting time.
 *
 *   COUNT env var sets the batch size (default 3).
 */
import "dotenv/config";
import { generateLibraryAssets } from "@/lib/poster-library";

(async () => {
  const count = Number(process.env.COUNT) > 0 ? Number(process.env.COUNT) : 3;
  const summary = await generateLibraryAssets({ count });
  console.log(`${new Date().toISOString()} poster-library-job ${JSON.stringify(summary)}`);
  process.exit(0);
})();
