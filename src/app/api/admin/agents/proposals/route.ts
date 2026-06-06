/**
 * Admin API for control-plane alert proposals (the human "noise" signal).
 *
 *   GET  /api/admin/agents/proposals   -> recent alert.raise proposals + noise rate
 *   POST /api/admin/agents/proposals   -> { proposalId, dismissedAsNoise: boolean }
 *
 * Marking an alert as noise feeds the alert_noise_rate self-improvement metric.
 * Admin-authed.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

interface ProposalRow {
  id: string;
  agent: string;
  actionType: string;
  decision: string;
  validationCode: string | null;
  args: string;
  shadow: boolean;
  dismissedAsNoise: boolean;
  proposedAt: Date;
}
interface ProposalDelegate {
  findMany(args: unknown): Promise<ProposalRow[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
}
const db = prisma as unknown as { agentProposal: ProposalDelegate };

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

  const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const recent = await db.agentProposal.findMany({
    where: { actionType: "alert.raise", proposedAt: { gte: since } },
    orderBy: { proposedAt: "desc" },
    take: 100,
  });

  // Noise rate over the window: dismissed / sent (sent = not rejected by the gate).
  const sent = recent.filter((p) => p.decision !== "reject").length;
  const dismissed = recent.filter((p) => p.dismissedAsNoise).length;

  return NextResponse.json({
    success: true,
    windowHours: 48,
    sent,
    dismissed,
    noiseRate: sent > 0 ? dismissed / sent : null,
    alerts: recent.map((p) => {
      let title = p.actionType;
      try {
        title = String((JSON.parse(p.args) as { title?: string })?.title ?? p.actionType);
      } catch {
        /* keep actionType */
      }
      return {
        id: p.id,
        agent: p.agent,
        title,
        decision: p.decision,
        validationCode: p.validationCode,
        shadow: p.shadow,
        dismissedAsNoise: p.dismissedAsNoise,
        proposedAt: p.proposedAt,
      };
    }),
  });
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const proposalId = String(body?.proposalId || "").trim();
  const dismissedAsNoise = body?.dismissedAsNoise !== false; // default true

  if (!proposalId) return NextResponse.json({ error: "proposalId is required" }, { status: 400 });

  const adminId = (admin as { sub?: string; id?: string }).sub || (admin as { id?: string }).id || "admin";
  await db.agentProposal.update({
    where: { id: proposalId },
    data: {
      dismissedAsNoise,
      dismissedAt: dismissedAsNoise ? new Date() : null,
      dismissedBy: dismissedAsNoise ? adminId : null,
    },
  });

  return NextResponse.json({ success: true, proposalId, dismissedAsNoise });
}
