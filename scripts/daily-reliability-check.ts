/**
 * Daily Reliability Check
 *
 * Usage:
 *   npx tsx --env-file=.env.local --tsconfig tsconfig.scripts.json scripts/daily-reliability-check.ts
 *
 * Optional env:
 *   RELIABILITY_BASE_URL=https://www.locksafe.uk
 */

import { config as loadEnv } from "dotenv";
import * as fs from "fs";
import * as path from "path";
import {
  formatDailyReliabilityMarkdown,
  runDailyReliabilityChecks,
} from "@/lib/reliability/daily";

loadEnv({ path: ".env.local" });

const BASE_URL = (process.env.RELIABILITY_BASE_URL || "https://www.locksafe.uk").replace(/\/$/, "");
const now = new Date();
const dateStamp = now.toISOString().slice(0, 10);

async function main() {
  console.log(`Running daily reliability checks for ${BASE_URL}`);
  const report = await runDailyReliabilityChecks({ baseUrl: BASE_URL });

  const reportDir = path.join(process.cwd(), "reports", "reliability");
  fs.mkdirSync(reportDir, { recursive: true });

  const md = formatDailyReliabilityMarkdown(report);
  const mdPath = path.join(reportDir, `daily-reliability-${dateStamp}.md`);
  const jsonPath = path.join(reportDir, `daily-reliability-${dateStamp}.json`);

  fs.writeFileSync(mdPath, md, "utf8");
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        timestamp: report.timestamp,
        baseUrl: report.baseUrl,
        score: report.score,
        results: report.results,
      },
      null,
      2
    ),
    "utf8"
  );

  console.log(`Score: ${report.score.score}/100 (${report.score.overall})`);
  console.log(`Checks: PASS=${report.score.pass}, WARN=${report.score.warn}, FAIL=${report.score.fail}`);
  console.log(`Report: ${mdPath}`);
  console.log(`JSON:   ${jsonPath}`);

  process.exit(report.score.overall === "RED" ? 1 : 0);
}

main().catch((error) => {
  console.error("Daily reliability check failed:", error);
  process.exit(1);
});
