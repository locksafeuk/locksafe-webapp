import prisma from "@/lib/db";

interface JobActivityInput {
  jobId: string;
  message: string;
  senderType?: "admin" | "system";
  senderName?: string;
}

/**
 * Append a system/admin activity row for a job so report timelines can show
 * important operational events to all admins.
 */
export async function appendJobActivity({
  jobId,
  message,
  senderType = "system",
  senderName = senderType === "admin" ? "Admin" : "System",
}: JobActivityInput): Promise<void> {
  const body = message.trim();
  if (!jobId || !body) return;

  await prisma.jobMessage.create({
    data: {
      jobId,
      senderType,
      senderName,
      body,
      isAdminMessage: true,
      customerId: null,
      locksmithId: null,
      attachmentUrl: null,
    },
  });
}
