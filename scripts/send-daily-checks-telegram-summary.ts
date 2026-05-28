import fs from "fs";
import path from "path";
import { config as loadEnv } from "dotenv";
import { sendAdminAlert } from "@/lib/telegram";

loadEnv({ path: ".env.local" });

type Args = {
  summaryFile: string;
  logFile: string;
  failedCount: number;
};

function parseArgs(argv: string[]): Args {
  let summaryFile = "";
  let logFile = "";
  let failedCount = 0;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--summary" && argv[i + 1]) {
      summaryFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--log" && argv[i + 1]) {
      logFile = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--failed" && argv[i + 1]) {
      failedCount = Number(argv[i + 1]) || 0;
      i += 1;
    }
  }

  if (!summaryFile || !logFile) {
    throw new Error("Usage: --summary <path> --log <path> --failed <count>");
  }

  return { summaryFile, logFile, failedCount };
}

function compactLine(line: string): string {
  return line.replace(/\s+/g, " ").trim();
}

function readSummaryLines(summaryFile: string): string[] {
  const raw = fs.readFileSync(summaryFile, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => compactLine(line))
    .filter((line) => line.length > 0)
    .slice(0, 14);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const summaryPath = path.resolve(args.summaryFile);
  const logPath = path.resolve(args.logFile);

  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Summary file not found: ${summaryPath}`);
  }

  const summaryLines = readSummaryLines(summaryPath);
  const title = args.failedCount > 0
    ? `Daily Checks FAILED (${args.failedCount})`
    : "Daily Checks PASSED";

  const severity: "info" | "warning" | "error" =
    args.failedCount > 0 ? "error" : "info";

  const message = [
    `Host: local Mac Studio`,
    `Run: ${new Date().toISOString()}`,
    "",
    ...summaryLines,
    "",
    `Summary file: ${summaryPath}`,
    `Log file: ${logPath}`,
  ].join("\n");

  const sent = await sendAdminAlert({
    title,
    message,
    severity,
    bypassPolicyGate: true,
    dedupeKey: `daily-checks:${path.basename(summaryPath)}`,
    cooldownMsOverride: 0,
  });

  if (!sent) {
    throw new Error("Telegram summary was not sent");
  }

  console.log("[daily-checks] Telegram summary sent");
}

main().catch((error) => {
  console.error(
    "[daily-checks] Telegram summary failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
