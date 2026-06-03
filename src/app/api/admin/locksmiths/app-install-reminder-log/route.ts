import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";

async function verifyAdminAuth(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.type === "admin";
}

export async function GET(req: NextRequest) {
  const isAdmin = await verifyAdminAuth(req);
  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const locksmithId = searchParams.get("locksmithId");
  if (!locksmithId) {
    return NextResponse.json({ error: "Missing locksmithId" }, { status: 400 });
  }

  const log = await prisma.appInstallReminderLog.findMany({
    where: { locksmithId },
    orderBy: { sentAt: "desc" },
    select: {
      sentAt: true,
      adminEmail: true,
      status: true,
      deliveredAt: true,
      openedAt: true,
      openCount: true,
      clickedAt: true,
      clickCount: true,
      bouncedAt: true,
      bounceReason: true,
      complainedAt: true,
    },
  });

  return NextResponse.json({ success: true, log });
}
