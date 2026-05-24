import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { verifyToken } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { extractUkPostcode, isCoordinatePair } from "@/lib/location-display";

async function verifyAdminAuth(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  return payload?.type === "admin" ? payload : null;
}

function needsBaseLocationReminder(locksmith: {
  baseLat: number | null;
  baseLng: number | null;
  baseAddress: string | null;
  coverageAreas: string[];
}) {
  const hasCoords = locksmith.baseLat != null && locksmith.baseLng != null;
  const address = locksmith.baseAddress?.trim() || "";
  const postcodeFromAddress = extractUkPostcode(address);
  const postcodeFromCoverage = locksmith.coverageAreas.find((area) => Boolean(extractUkPostcode(area))) || null;
  const hasPostcode = Boolean(postcodeFromAddress || postcodeFromCoverage);

  return !hasCoords || !address || isCoordinatePair(address) || !hasPostcode;
}

async function sendBaseLocationReminderEmail(locksmithEmail: string, locksmithName: string) {
  return sendEmail({
    to: locksmithEmail,
    subject: "Action needed: Set your LockSafe base location postcode",
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Set Your Base Location</title>
      </head>
      <body style="font-family: Arial, sans-serif; background:#f8fafc; margin:0; padding:0; color:#0f172a;">
        <div style="max-width:560px; margin:32px auto; background:#ffffff; border-radius:12px; padding:28px; border:1px solid #e2e8f0;">
          <h1 style="margin:0 0 14px 0; font-size:22px; color:#b45309;">Please update your base location</h1>
          <p style="margin:0 0 12px 0;">Hi ${locksmithName},</p>
          <p style="margin:0 0 12px 0; line-height:1.6;">
            Your LockSafe account needs a valid postcode-based base location to receive nearby job requests accurately.
          </p>
          <p style="margin:0 0 12px 0; line-height:1.6;">
            Please open your locksmith settings and set your base location using a UK postcode (for example: <strong>SW1A 1AA</strong>), not map coordinates.
          </p>
          <p style="margin:20px 0 0 0; color:#475569;">LockSafe UK Operations</p>
        </div>
      </body>
      </html>
    `,
  });
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
      baseLat: true,
      baseLng: true,
      baseAddress: true,
      coverageAreas: true,
    },
  });

  if (!locksmith || !locksmith.email) {
    return NextResponse.json({ error: "Locksmith not eligible for reminder" }, { status: 400 });
  }

  if (!needsBaseLocationReminder(locksmith)) {
    return NextResponse.json({ error: "Base location is already complete" }, { status: 400 });
  }

  const emailResult = await sendBaseLocationReminderEmail(locksmith.email, locksmith.name);
  if (!emailResult.success) {
    return NextResponse.json({ error: "Failed to send reminder email" }, { status: 500 });
  }

  await prisma.baseLocationReminderLog.create({
    data: {
      locksmithId: locksmith.id,
      adminEmail: admin.email,
      sentAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
