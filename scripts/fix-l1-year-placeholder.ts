/**
 * One-off: strip the LLM placeholder "since [year implied by operation]"
 * from L1's whyChooseUs. Also marks the row contentSource="manual_override"
 * so the auto-regenerator (90-day cadence) never overwrites the hand fix.
 *
 * Idempotent — run safe.
 */

import * as path from "path";
import { config as dotenvConfig } from "dotenv";
dotenvConfig({ path: path.resolve(__dirname, "..", ".env") });

import { prisma as _prisma } from "../src/lib/db";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

async function main() {
  const row = await prisma.districtLandingPage.findUnique({ where: { district: "L1" } });
  if (!row) { console.error("L1 row missing"); process.exit(1); }

  // Strip the invented "since [year ...]" tail, keep punctuation clean.
  const fixed = (row.whyChooseUs as string)
    .replace(
      /,?\s*just a team embedded in Liverpool[’']s community since \[year[^\]]*\]\.?/i,
      ", just a team embedded in Liverpool’s community.",
    )
    // Belt-and-braces: nuke any leftover "[year ...]" placeholders site-wide.
    .replace(/\s*\[year[^\]]*\]\.?/gi, ".")
    .trim();

  if (fixed === row.whyChooseUs) {
    console.log("No change needed — placeholder not found.");
    console.log("Current whyChooseUs:\n" + row.whyChooseUs);
    return;
  }

  await prisma.districtLandingPage.update({
    where: { district: "L1" },
    data: {
      whyChooseUs:   fixed,
      contentSource: "manual_override",
      adminNotes:    [
        row.adminNotes,
        `[${new Date().toISOString()}] Stripped LLM placeholder "[year implied by operation]" from whyChooseUs; set manual_override.`,
      ].filter(Boolean).join("\n"),
    },
  });

  console.log("✅ Patched L1.whyChooseUs and set contentSource=manual_override.\n");
  console.log("New whyChooseUs:\n" + fixed);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
