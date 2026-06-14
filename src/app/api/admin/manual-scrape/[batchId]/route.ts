import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { batchId } = await params;
  const batch = await prisma.scrapeBatch.findUnique({ where: { id: batchId } });
  if (!batch) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ batch });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { batchId } = await params;
  const { action } = await req.json().catch(() => ({}));
  const status = action === "pause" ? "paused" : action === "resume" ? "running" : null;
  if (!status) return NextResponse.json({ error: "action must be pause|resume" }, { status: 400 });
  const batch = await prisma.scrapeBatch.update({ where: { id: batchId }, data: { status } });
  return NextResponse.json({ status: batch.status });
}
