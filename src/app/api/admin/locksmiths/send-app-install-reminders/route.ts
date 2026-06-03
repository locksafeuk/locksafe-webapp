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

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const locksmiths = await prisma.locksmith.findMany({
      where: {
        email: { not: "" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        nativeTokenPlatform: true,
        webPushRegisteredAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const eligible = locksmiths.filter((locksmith) => needsAppInstallReminder(locksmith));

    if (eligible.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible locksmiths found",
        totalEligible: 0,
        totalSent: 0,
        failed: 0,
        failedEmails: [],
      });
    }

    const results = await Promise.all(
      eligible.map(async (locksmith) => {
        try {
          const emailResult = await sendAppInstallReminderEmail(locksmith.email, {
            locksmithName: locksmith.name,
          });

          if (!emailResult.success) {
            return { success: false, email: locksmith.email };
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

          return { success: true, email: locksmith.email };
        } catch (error) {
          console.error("Failed to send app install reminder:", locksmith.email, error);
          return { success: false, email: locksmith.email };
        }
      })
    );

    const totalSent = results.filter((result) => result.success).length;
    const failedEmails = results.filter((result) => !result.success).map((result) => result.email);

    return NextResponse.json({
      success: true,
      message: `Sent app install reminders to ${totalSent} locksmiths`,
      totalEligible: eligible.length,
      totalSent,
      failed: failedEmails.length,
      failedEmails,
    });
  } catch (error) {
    console.error("Error sending app install reminders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send app install reminders" },
      { status: 500 }
    );
  }
}
