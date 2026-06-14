import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES = ["new", "contacted", "replied", "onboarded", "not_interested"] as const;

async function funnel(where: Record<string, unknown>) {
  const counts = await Promise.all(STATUSES.map((s) => prisma.locksmithLead.count({ where: { ...where, status: s } })));
  const total = await prisma.locksmithLead.count({ where });
  return { total, byStatus: Object.fromEntries(STATUSES.map((s, i) => [s, counts[i]])) };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { batchId } = await params;
  const batch = await prisma.scrapeBatch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [thisBatch, allManual, allAuto] = await Promise.all([
    funnel({ scrapeBatchId: batchId }),
    funnel({ source: "manual" }),
    funnel({ source: "auto" }),
  ]);

  return NextResponse.json({
    batch: { name: batch.name, status: batch.status, emailsSent: batch.emailsSent, smsSent: batch.smsSent, discovered: batch.discovered, extracted: batch.extracted, skipped: batch.skipped },
    thisBatch,
    compare: { manual: allManual, auto: allAuto },
  });
}
