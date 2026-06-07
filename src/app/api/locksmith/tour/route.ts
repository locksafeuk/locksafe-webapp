/**
 * Locksmith onboarding-tour state.
 *
 *   GET  /api/locksmith/tour?locksmithId=…  -> { tourCompletedAt }
 *   POST /api/locksmith/tour { locksmithId } -> marks the walkthrough done/skipped
 *
 * tourCompletedAt = null → the web dashboard auto-starts the walkthrough.
 */

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isLocksmithAuthenticated } from "@/lib/auth";

// Boundary cast: tourCompletedAt isn't in the generated client until
// `prisma generate` runs after the schema change.
interface LocksmithTourDelegate {
  findUnique(args: { where: { id: string }; select: Record<string, boolean> }): Promise<Record<string, unknown> | null>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
}
const db = prisma as unknown as { locksmith: LocksmithTourDelegate };

async function authorise(request: NextRequest, locksmithId: string | null) {
  const session = await isLocksmithAuthenticated();
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  if (!locksmithId) return { error: NextResponse.json({ success: false, error: "Locksmith ID is required" }, { status: 400 }) };
  if (session.id !== locksmithId) return { error: NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 }) };
  return { session };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locksmithId = searchParams.get("locksmithId");
  const auth = await authorise(request, locksmithId);
  if ("error" in auth) return auth.error;

  const row = await db.locksmith.findUnique({
    where: { id: locksmithId as string },
    select: { tourCompletedAt: true },
  });
  return NextResponse.json({ success: true, tourCompletedAt: row?.tourCompletedAt ?? null });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const locksmithId = typeof body?.locksmithId === "string" ? body.locksmithId : null;
  const auth = await authorise(request, locksmithId);
  if ("error" in auth) return auth.error;

  await db.locksmith.update({
    where: { id: locksmithId as string },
    data: { tourCompletedAt: new Date(), onboardingLastInteractionAt: new Date() },
  });
  return NextResponse.json({ success: true });
}
