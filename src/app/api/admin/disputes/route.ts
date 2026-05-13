import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { submitDisputeEvidenceToStripe, buildDisputeEvidence } from "@/lib/disputes";

async function verifyAdminAuth(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (payload?.type !== "admin") return null;
  return (payload as { name?: string }).name ?? "Admin";
}

export async function GET(request: NextRequest) {
  const adminName = await verifyAdminAuth(request);
  if (!adminName) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const disputes = await prisma.dispute.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  // Enrich with job info
  const jobIds = disputes.map((d) => d.jobId).filter(Boolean);
  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds } },
    select: {
      id: true,
      jobNumber: true,
      customer: { select: { name: true } },
      locksmith: { select: { name: true } },
    },
  });
  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  const enriched = disputes.map((d) => ({
    ...d,
    job: jobMap.get(d.jobId) ?? null,
  }));

  const stats = {
    total: disputes.length,
    needsResponse: disputes.filter((d) =>
      ["needs_response", "warning_needs_response"].includes(d.status)
    ).length,
    underReview: disputes.filter((d) =>
      ["under_review", "warning_under_review"].includes(d.status)
    ).length,
    won: disputes.filter((d) => d.status === "won").length,
    lost: disputes.filter((d) => d.status === "lost").length,
    totalExposed: disputes
      .filter((d) => !["won", "withdrawn"].includes(d.status))
      .reduce((s, d) => s + d.amount, 0),
  };

  return NextResponse.json({ disputes: enriched, stats });
}

export async function POST(request: NextRequest) {
  const adminName = await verifyAdminAuth(request);
  if (!adminName) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  const { action, disputeId, notes } = await request.json();

  if (action === "submit_evidence") {
    await submitDisputeEvidenceToStripe(disputeId, adminName);
    return NextResponse.json({ success: true, message: "Evidence submitted to Stripe" });
  }

  if (action === "preview_evidence") {
    const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
    if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    const evidence = await buildDisputeEvidence(dispute.jobId);
    return NextResponse.json({ evidence });
  }

  if (action === "add_notes") {
    await prisma.dispute.update({ where: { id: disputeId }, data: { notes } });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
