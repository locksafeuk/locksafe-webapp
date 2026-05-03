import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import {
  type NotifyChannel,
  notifyNoLocksmithAvailable,
} from "@/lib/notify-no-locksmith";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

/**
 * POST /api/admin/jobs/[id]/notify-no-locksmith
 *
 * Body: { channels: ("sms"|"email")[], customSmsMessage?: string }
 *
 * Sends an SMS (via Zadarma) and/or email (via Resend) to the customer
 * letting them know no locksmith is currently available in their coverage
 * area, and offering the priority phone line + radius widening as next steps.
 *
 * Records the outcome on the Job (`noLocksmithNotifiedAt`,
 * `noLocksmithNotifiedChannels`, `noLocksmithNotifiedBy`).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: jobId } = await params;
    const body = await request.json().catch(() => ({}));
    const channelsInput = Array.isArray(body?.channels) ? body.channels : [];
    const customSmsMessage =
      typeof body?.customSmsMessage === "string"
        ? body.customSmsMessage
        : undefined;

    const channels: NotifyChannel[] = channelsInput.filter(
      (c: unknown): c is NotifyChannel => c === "sms" || c === "email",
    );

    if (channels.length === 0) {
      return NextResponse.json(
        { success: false, error: "Pick at least one channel (sms or email)" },
        { status: 400 },
      );
    }

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { customer: true },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 },
      );
    }
    if (!job.customer) {
      return NextResponse.json(
        { success: false, error: "Job has no customer on file" },
        { status: 409 },
      );
    }

    // Validate the chosen channels have the required contact info.
    if (channels.includes("sms") && !job.customer.phone) {
      return NextResponse.json(
        { success: false, error: "Customer has no phone — cannot send SMS" },
        { status: 409 },
      );
    }
    if (channels.includes("email") && !job.customer.email) {
      return NextResponse.json(
        { success: false, error: "Customer has no email — cannot send email" },
        { status: 409 },
      );
    }

    const result = await notifyNoLocksmithAvailable({
      job: {
        id: job.id,
        jobNumber: job.jobNumber,
        postcode: job.postcode,
        problemType: job.problemType,
      },
      customer: {
        name: job.customer.name,
        phone: job.customer.phone,
        email: job.customer.email,
      },
      channels,
      customSmsMessage,
    });

    // Persist the audit trail if at least one channel landed.
    if (result.channelsSent.length > 0) {
      const adminId =
        (typeof admin === "object" && admin && "userId" in admin
          ? (admin as { userId?: string }).userId
          : undefined) ||
        (typeof admin === "object" && admin && "email" in admin
          ? (admin as { email?: string }).email
          : undefined) ||
        "admin";

      await prisma.job.update({
        where: { id: job.id },
        data: {
          noLocksmithNotifiedAt: new Date(),
          noLocksmithNotifiedChannels: result.channelsSent,
          noLocksmithNotifiedBy: String(adminId),
        },
      });
    }

    return NextResponse.json({
      success: result.channelsSent.length > 0,
      channelsAttempted: result.channelsAttempted,
      channelsSent: result.channelsSent,
      smsResult: result.smsResult,
      emailResult: result.emailResult,
    });
  } catch (error) {
    console.error("[notify-no-locksmith] error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send notification" },
      { status: 500 },
    );
  }
}
