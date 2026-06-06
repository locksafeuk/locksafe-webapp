/**
 * Admin API for the control-plane approval queue.
 *
 *   GET  /api/admin/agents/approvals          -> list pending approvals
 *   POST /api/admin/agents/approvals          -> { approvalId, decision: "approved"|"rejected" }
 *
 * Admin-authed (auth_token cookie, payload.type === "admin").
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { resolveApproval } from "@/agents/control-plane/approvals/resolve";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pending = await prisma.agentApproval.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ success: true, count: pending.length, approvals: pending });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const approvalId = String(body?.approvalId || "").trim();
  const decision = String(body?.decision || "").trim();

  if (!approvalId) return NextResponse.json({ error: "approvalId is required" }, { status: 400 });
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision must be 'approved' or 'rejected'" }, { status: 400 });
  }

  const adminId = (admin as { sub?: string; id?: string }).sub || (admin as { id?: string }).id || "admin";
  const result = await resolveApproval(approvalId, decision, adminId);

  return NextResponse.json({ success: result.ok, ...result }, { status: result.status === "error" ? 409 : 200 });
}
