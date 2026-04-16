import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { sendLocksmithWelcomeEmail } from "@/lib/email";

// Helper to verify admin auth
async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload?.type === "admin";
}

// POST - Send welcome emails to all locksmiths
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const isAdmin = await verifyAdminAuth(request);
    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get all locksmiths
    const locksmiths = await prisma.locksmith.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        companyName: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (locksmiths.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No locksmiths found to send emails to",
        totalSent: 0,
        failed: 0,
      });
    }

    // Send welcome emails to all locksmiths
    const results = await Promise.allSettled(
      locksmiths.map((locksmith) =>
        sendLocksmithWelcomeEmail(locksmith.email, {
          locksmithName: locksmith.name,
          companyName: locksmith.companyName,
        })
      )
    );

    // Count successes and failures
    const totalSent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    const failedEmails = locksmiths
      .filter((_, index) => results[index].status === "rejected")
      .map((l) => l.email);

    console.log(`Successfully sent ${totalSent} welcome emails to locksmiths`);
    if (failed > 0) {
      console.error(`Failed to send ${failed} emails:`, failedEmails);
    }

    return NextResponse.json({
      success: true,
      message: `Sent welcome emails to ${totalSent} locksmiths`,
      totalLocksmiths: locksmiths.length,
      totalSent,
      failed,
      failedEmails: failed > 0 ? failedEmails : [],
    });
  } catch (error) {
    console.error("Error sending welcome emails:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send welcome emails",
      },
      { status: 500 }
    );
  }
}
