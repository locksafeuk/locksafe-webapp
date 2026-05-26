/**
 * Backfill AI face verification for existing locksmith profile photos.
 *
 * Iterates every locksmith with a profileImage that has not yet been verified
 * (profilePhotoVerifiedAt IS NULL AND profilePhotoVerified = false) and runs
 * the Ollama vision face check, persisting the result.
 *
 * Usage:
 *   node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json \
 *     scripts/backfill-profile-photo-verification.ts
 *
 * Dry run:
 *   DRY_RUN=1 node_modules/.bin/ts-node -r tsconfig-paths/register \
 *     --project tsconfig.scripts.json \
 *     scripts/backfill-profile-photo-verification.ts
 */
import * as path from "path";
require("tsconfig-paths").register({
  baseUrl: path.resolve(__dirname, ".."),
  paths: { "@/*": ["src/*"] },
});

import { prisma as _prisma } from "../src/lib/db";
import { verifyProfilePhoto } from "../src/lib/credential-verifier";

const prisma = _prisma as any;

const DRY_RUN = process.env["DRY_RUN"] === "1";
const REQ_DELAY_MS = Number(process.env["REQ_DELAY_MS"] ?? "1000"); // vision model is heavy
const LIMIT = process.env["LIMIT"] ? Number(process.env["LIMIT"]) : undefined;
const VISION_TIMEOUT_MS = Number(process.env["VISION_TIMEOUT_MS"] ?? "240000"); // 4 min
// If RETRY_FAILED=1 we re-process records where AI confidence is 0
// (these were previously aborted by the vision-model timeout and got the
// fails-open treatment).
const RETRY_FAILED = process.env["RETRY_FAILED"] === "1";

interface BackfillSummary {
  considered: number;
  verified: number;
  rejected: number;
  errors: number;
  skipped: number;
  failures: string[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Profile photo backfill starting...\n`);

  const summary: BackfillSummary = {
    considered: 0,
    verified: 0,
    rejected: 0,
    errors: 0,
    skipped: 0,
    failures: [],
  };

  // Fetch all locksmiths with a profile photo. We filter in-memory because
  // MongoDB documents predating the schema change have the new fields
  // missing entirely (and Prisma's `: null` does not match missing fields).
  const all = await prisma.locksmith.findMany({
    where: { profileImage: { not: null } },
    select: {
      id: true,
      name: true,
      profileImage: true,
      profilePhotoVerified: true,
      profilePhotoVerifiedAt: true,
      profilePhotoAiConfidence: true,
    },
  });

  // Pick records needing work:
  //   - never verified (no timestamp + not flagged verified=true), OR
  //   - RETRY_FAILED=1 AND confidence is 0/null (previous timeouts)
  const todo = all
    .filter((ls: any) => {
      const neverChecked = !ls.profilePhotoVerifiedAt && ls.profilePhotoVerified !== true;
      const wasTimeout = RETRY_FAILED && (ls.profilePhotoAiConfidence === 0 || ls.profilePhotoAiConfidence === null);
      return neverChecked || wasTimeout;
    })
    .slice(0, LIMIT ?? all.length);

  console.log(`Found ${todo.length} locksmith(s) needing photo verification.\n`);

  for (const ls of todo) {
    summary.considered++;
    const tag = `[${summary.considered}/${todo.length}] ${ls.name} (${ls.id})`;

    if (!ls.profileImage) {
      summary.skipped++;
      console.log(`${tag}: skipped (no profileImage)`);
      continue;
    }

    try {
      console.log(`${tag}: verifying ${ls.profileImage}`);

      if (DRY_RUN) {
        console.log(`${tag}: [DRY RUN] would call verifyProfilePhoto + persist result`);
        summary.skipped++;
      } else {
        const result = await verifyProfilePhoto(ls.profileImage, ls.name, {
          timeoutMs: VISION_TIMEOUT_MS,
        });

        // Guard against fail-open: verifyProfilePhoto returns
        // {isRealFace:true, confidence:0} when the vision model errors or
        // times out. Treat that as a hard failure here — never persist a
        // verified=true with confidence=0.
        if (result.isRealFace && result.confidence === 0) {
          summary.errors++;
          summary.failures.push(`${ls.id}: vision model fail-open (timeout or error)`);
          console.error(`${tag}: ERROR — vision model fail-open (timeout/error); not persisting`);
          await sleep(REQ_DELAY_MS);
          continue;
        }

        await prisma.locksmith.update({
          where: { id: ls.id },
          data: {
            profilePhotoVerified: result.isRealFace,
            profilePhotoVerifiedAt: result.isRealFace ? new Date() : null,
            profilePhotoRejectionReason: result.rejectionReason ?? null,
            profilePhotoAiConfidence: result.confidence,
          },
        });

        if (result.isRealFace) {
          summary.verified++;
          console.log(`${tag}: ✓ verified (confidence ${(result.confidence * 100).toFixed(0)}%)`);
        } else {
          summary.rejected++;
          console.log(`${tag}: ✗ rejected — ${result.rejectionReason ?? "low confidence"} (confidence ${(result.confidence * 100).toFixed(0)}%)`);
        }
      }
    } catch (err) {
      summary.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      summary.failures.push(`${ls.id}: ${msg}`);
      console.error(`${tag}: ERROR — ${msg}`);
    }

    await sleep(REQ_DELAY_MS);
  }

  console.log("\n=== Backfill summary ===");
  console.log(`Considered: ${summary.considered}`);
  console.log(`Verified:   ${summary.verified}`);
  console.log(`Rejected:   ${summary.rejected}`);
  console.log(`Skipped:    ${summary.skipped}`);
  console.log(`Errors:     ${summary.errors}`);
  if (summary.failures.length > 0) {
    console.log("\nFailures:");
    summary.failures.forEach((f) => console.log(`  - ${f}`));
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Backfill script failed:", err);
  await prisma.$disconnect();
  process.exit(1);
});
