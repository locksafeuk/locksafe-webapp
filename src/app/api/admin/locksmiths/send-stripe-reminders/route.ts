import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { sendStripeOnboardingReminderEmail } from "@/lib/email";
import { createAccountLink, createConnectAccount } from "@/lib/stripe";

async function verifyAdminAuth(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.type === "admin" ? payload : null;
}

function getBaseUrl(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    return process.env.NEXT_PUBLIC_BASE_URL;
  }

  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdminAuth(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const locksmiths = await prisma.locksmith.findMany({
      where: {
        stripeConnectOnboarded: false,
        email: { not: "" },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        stripeConnectId: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (locksmiths.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No eligible locksmiths found",
        totalEligible: 0,
        totalSent: 0,
        failed: 0,
        failedEmails: [],
      });
    }

    const baseUrl = getBaseUrl(request);
    const returnUrl = `${baseUrl}/locksmith/earnings?stripe_connect=success`;
    const refreshUrl = `${baseUrl}/locksmith/earnings?stripe_connect=refresh`;

    const results = await Promise.all(
      locksmiths.map(async (locksmith) => {
        try {
          let stripeConnectId = locksmith.stripeConnectId;
          if (!stripeConnectId) {
            const account = await createConnectAccount(locksmith.email, locksmith.id, {
              name: locksmith.name,
              phone: locksmith.phone || undefined,
              url: baseUrl,
            });

            stripeConnectId = account.id;
            await prisma.locksmith.update({
              where: { id: locksmith.id },
              data: {
                stripeConnectId,
                stripeConnectOnboarded: false,
                stripeConnectVerified: false,
              },
            });
          }

          const accountLink = await createAccountLink(stripeConnectId, returnUrl, refreshUrl);
          const emailResult = await sendStripeOnboardingReminderEmail(locksmith.email, {
            locksmithName: locksmith.name,
            stripeOnboardingUrl: accountLink.url,
          });

          if (!emailResult.success) {
            return { success: false, email: locksmith.email };
          }

          await prisma.stripeReminderLog.create({
            data: {
              locksmithId: locksmith.id,
              adminEmail: admin.email,
              sentAt: new Date(),
            },
          });

          return { success: true, email: locksmith.email };
        } catch (error) {
          console.error("Failed to send Stripe reminder:", locksmith.email, error);
          return { success: false, email: locksmith.email };
        }
      })
    );

    const totalSent = results.filter((result) => result.success).length;
    const failedEmails = results.filter((result) => !result.success).map((result) => result.email);

    return NextResponse.json({
      success: true,
      message: `Sent Stripe reminders to ${totalSent} locksmiths`,
      totalEligible: locksmiths.length,
      totalSent,
      failed: failedEmails.length,
      failedEmails,
    });
  } catch (error) {
    console.error("Error sending Stripe reminders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send Stripe reminders" },
      { status: 500 }
    );
  }
}