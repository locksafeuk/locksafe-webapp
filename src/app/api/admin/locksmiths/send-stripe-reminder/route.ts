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
      phone: true,
      stripeConnectOnboarded: true,
      stripeConnectId: true,
    },
  });

  if (!locksmith || locksmith.stripeConnectOnboarded || !locksmith.email) {
    return NextResponse.json({ error: "Locksmith not eligible for reminder" }, { status: 400 });
  }

  const baseUrl = getBaseUrl(req);
  const returnUrl = `${baseUrl}/locksmith/earnings?stripe_connect=success`;
  const refreshUrl = `${baseUrl}/locksmith/earnings?stripe_connect=refresh`;

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

  await sendStripeOnboardingReminderEmail(locksmith.email, {
    locksmithName: locksmith.name,
    stripeOnboardingUrl: accountLink.url,
  });

  await prisma.stripeReminderLog.create({
    data: {
      locksmithId: locksmith.id,
      adminEmail: admin.email,
      sentAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
