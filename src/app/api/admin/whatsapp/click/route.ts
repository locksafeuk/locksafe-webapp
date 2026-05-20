import { type NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

const VALID_TARGET_TYPES = new Set(["locksmith", "lead", "customer"]);

async function getAdminPayload(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

/**
 * POST /api/admin/whatsapp/click
 *
 * Fire-and-forget audit log for `<WhatsAppButton>` clicks.
 * Body: { targetType, targetId, jobId?, phone }
 * Returns 204 on success. The button ignores any response.
 */
export async function POST(request: NextRequest) {
  const payload = await getAdminPayload(request);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { targetType, targetId, jobId, phone } = body as {
    targetType?: unknown;
    targetId?: unknown;
    jobId?: unknown;
    phone?: unknown;
  };

  if (
    typeof targetType !== "string" ||
    !VALID_TARGET_TYPES.has(targetType) ||
    typeof targetId !== "string" ||
    !targetId ||
    typeof phone !== "string" ||
    !phone
  ) {
    return NextResponse.json({ error: "Invalid fields" }, { status: 400 });
  }

  if (jobId != null && typeof jobId !== "string") {
    return NextResponse.json({ error: "Invalid jobId" }, { status: 400 });
  }

  try {
    await prisma.whatsAppClickLog.create({
      data: {
        actorId: payload.id,
        actorEmail: payload.email,
        targetType,
        targetId,
        jobId: jobId || null,
        phone,
      },
    });
  } catch (err) {
    // Log but don't expose details — this is fire-and-forget for the client.
    console.error("[whatsapp/click] log insert failed", err);
    return NextResponse.json({ error: "Log failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
