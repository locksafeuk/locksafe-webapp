import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { sendAppInstallReminderEmail } from "@/lib/email";

type LocksmithReminderCandidate = {
  id: string;
  name: string;
  email: string;
  nativeTokenPlatform: string | null;
  webPushRegisteredAt: Date | null;
};

async function verifyAdminAuth(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.type === "admin" ? payload : null;
}

function needsAppInstallReminder(locksmith: LocksmithReminderCandidate) {
  const hasNative = locksmith.nativeTokenPlatform === "ios" || locksmith.nativeTokenPlatform === "android";
  const hasPwa = Boolean(locksmith.webPushRegisteredAt);
  return !hasNative && !hasPwa;
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdminAuth(req);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { locksmithId } = await req.json();
  if (!locksmithId) {
    return NextResponse.json({ error: "Missing locksmithId" }, { status: 400 });
  }

  const locksmith = await prisma.locksmith.findUnique({
    where: { id: locksmithId },
    select: {
      id: true,
      name: true,
      email: true,
      nativeTokenPlatform: true,
      webPushRegisteredAt: true,
    },
  });

  if (!locksmith || !locksmith.email) {
    return NextResponse.json({ error: "Locksmith not eligible for reminder" }, { status: 400 });
  }

  if (!needsAppInstallReminder(locksmith)) {
    return NextResponse.json({ error: "Locksmith already has an app channel" }, { status: 400 });
  }

  const emailResult = await sendAppInstallReminderEmail(locksmith.email, {
    locksmithName: locksmith.name,
  });

  if (!emailResult.success) {
    return NextResponse.json({ error: "Failed to send reminder email" }, { status: 500 });
  }

  await prisma.appInstallReminderLog.create({
    data: {
      locksmithId: locksmith.id,
      adminEmail: admin.email,
      resendEmailId: typeof emailResult.id === "string" ? emailResult.id : null,
      status: "sent",
      sentAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
