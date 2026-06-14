import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";
import { DEFAULT_CALLOUT_FEE } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One-off (idempotent) backfill: give every locksmith with a blank/zero
// call-out fee the sensible default, so a missing fee never blocks "Available".
// GET = dry-run preview (who'd change). POST = apply.
async function findBlank() {
  return prisma.locksmith.findMany({
    where: { OR: [{ defaultAssessmentFee: null }, { defaultAssessmentFee: { lte: 0 } }] },
    select: { id: true, name: true, email: true, defaultAssessmentFee: true },
  });
}

export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const affected = await findBlank();
  return NextResponse.json({ dryRun: true, defaultFee: DEFAULT_CALLOUT_FEE, count: affected.length, affected });
}

export async function POST() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const affected = await findBlank();
  const result = await prisma.locksmith.updateMany({
    where: { OR: [{ defaultAssessmentFee: null }, { defaultAssessmentFee: { lte: 0 } }] },
    data: { defaultAssessmentFee: DEFAULT_CALLOUT_FEE },
  });
  return NextResponse.json({ applied: true, defaultFee: DEFAULT_CALLOUT_FEE, updated: result.count, affected });
}
