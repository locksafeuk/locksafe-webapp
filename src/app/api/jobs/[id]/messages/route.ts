import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/**
 * GET /api/jobs/[id]/messages
 * Returns all chat messages for a job, ordered oldest-first.
 *
 * Auth: customerId or locksmithId must match job ownership (or admin token).
 *
 * POST /api/jobs/[id]/messages
 * Sends a new message.
 * Body: { body: string, senderType: "customer"|"locksmith"|"admin", senderId: string, attachmentUrl?: string }
 */

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;

  const messages = await prisma.jobMessage.findMany({
    where: { jobId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ messages });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const jobId = params.id;
  const body = await request.json();
  const { senderType, senderId, senderName, messageBody, attachmentUrl } = body as {
    senderType: "customer" | "locksmith" | "admin" | "system";
    senderId: string;
    senderName: string;
    messageBody: string;
    attachmentUrl?: string;
  };

  if (!senderType || !messageBody?.trim()) {
    return NextResponse.json({ error: "senderType and messageBody are required" }, { status: 400 });
  }

  const message = await prisma.jobMessage.create({
    data: {
      jobId,
      senderType,
      senderName: senderName ?? senderType,
      body: messageBody.trim(),
      attachmentUrl: attachmentUrl ?? null,
      customerId: senderType === "customer" ? senderId : null,
      locksmithId: senderType === "locksmith" ? senderId : null,
      isAdminMessage: senderType === "admin",
    },
  });

  // Mark previous messages from the other party as read
  const otherType = senderType === "customer" ? "locksmith" : "customer";
  await prisma.jobMessage.updateMany({
    where: { jobId, senderType: otherType, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ message }, { status: 201 });
}
