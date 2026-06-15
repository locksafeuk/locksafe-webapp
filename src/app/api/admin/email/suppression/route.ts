import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";
import { suppressEmail } from "@/lib/email-unsubscribe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET — list suppressed addresses (most recent first).
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const items = await prisma.emailSuppression.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ count: items.length, items });
}

// POST { email, reason? } — manually suppress (e.g. acting on an abuse report).
export async function POST(req: NextRequest) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { email, reason } = await req.json().catch(() => ({}));
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  await suppressEmail(email, { reason: reason || "manual", source: "admin" });
  return NextResponse.json({ ok: true, email, suppressed: true });
}

// DELETE ?email= — remove from suppression (re-allow sending).
export async function DELETE(req: NextRequest) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const email = (new URL(req.url).searchParams.get("email") || "").trim().toLowerCase();
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 });
  await prisma.emailSuppression.deleteMany({ where: { email } });
  return NextResponse.json({ ok: true, email, removed: true });
}
