import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

export interface WhatsAppConversationFilters {
  unreadOnly?: boolean;
  urgentOnly?: boolean;
  assignedToAdminId?: string;
  unassignedOnly?: boolean;
  search?: string;
}

function normalizePhone(phone: string): string {
  let normalized = (phone || "").replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (normalized.startsWith("+")) normalized = normalized.slice(1);
  if (normalized.startsWith("07") && normalized.length === 11) {
    normalized = `44${normalized.slice(1)}`;
  }
  return normalized;
}

function toPreview(content: string | null | undefined): string | null {
  if (!content) return null;
  const trimmed = content.trim();
  if (!trimmed) return null;
  return trimmed.length <= 180 ? trimmed : `${trimmed.slice(0, 177)}...`;
}

export async function upsertConversationByPhone(input: {
  phone: string;
  waId?: string | null;
  contactName?: string | null;
}) {
  const phone = normalizePhone(input.phone);
  const waId = input.waId ? normalizePhone(input.waId) : null;

  if (waId) {
    const byWaId = await prisma.whatsAppConversation.findUnique({ where: { waId } });
    if (byWaId) {
      return prisma.whatsAppConversation.update({
        where: { id: byWaId.id },
        data: {
          phone,
          contactName: input.contactName ?? byWaId.contactName,
          waId,
        },
      });
    }
  }

  const byPhone = await prisma.whatsAppConversation.findFirst({ where: { phone } });
  if (byPhone) {
    return prisma.whatsAppConversation.update({
      where: { id: byPhone.id },
      data: {
        waId: waId ?? byPhone.waId,
        contactName: input.contactName ?? byPhone.contactName,
      },
    });
  }

  return prisma.whatsAppConversation.create({
    data: {
      phone,
      waId,
      contactName: input.contactName ?? null,
      unreadCount: 0,
    },
  });
}

/**
 * For the SMS→WhatsApp hand-off: how many inbound SMS this phone has sent, and
 * whether we've already offered them the WhatsApp link (so we only offer once).
 */
export async function smsHandoffState(
  phone: string,
): Promise<{ inboundSms: number; alreadyOffered: boolean }> {
  const norm = normalizePhone(phone);
  const convo = await prisma.whatsAppConversation.findFirst({
    where: { phone: norm },
    select: { id: true },
  });
  if (!convo) return { inboundSms: 0, alreadyOffered: false };
  const msgs = await prisma.whatsAppConversationMessage.findMany({
    where: { conversationId: convo.id },
    select: { direction: true, messageType: true, content: true },
  });
  const inboundSms = msgs.filter((m) => m.direction === "inbound" && m.messageType === "sms").length;
  const alreadyOffered = msgs.some(
    (m) => m.direction === "outbound" && (m.content || "").includes("wa.me"),
  );
  return { inboundSms, alreadyOffered };
}

/**
 * WhatsApp 24h session window: returns true if there is a real INBOUND WhatsApp
 * message (i.e. NOT an SMS) from this phone within the last 24 hours. Outside
 * this window WhatsApp only permits template messages, so free-form sends must
 * fall back to SMS.
 */
export async function isWhatsAppWindowOpen(phone: string): Promise<boolean> {
  const norm = normalizePhone(phone);
  const convo = await prisma.whatsAppConversation.findFirst({
    where: { phone: norm },
    select: { id: true },
  });
  if (!convo) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentInbound = await prisma.whatsAppConversationMessage.findFirst({
    where: {
      conversationId: convo.id,
      direction: "inbound",
      messageType: { not: "sms" },
      createdAt: { gte: since },
    },
    select: { id: true },
  });
  return recentInbound !== null;
}

export async function recordIncomingWhatsAppMessage(input: {
  phone: string;
  waId?: string | null;
  contactName?: string | null;
  messageType: string;
  content?: string | null;
  providerMessageId?: string | null;
  rawPayload?: unknown;
  channel?: string;
}) {
  const conversation = await upsertConversationByPhone({
    phone: input.phone,
    waId: input.waId ?? null,
    contactName: input.contactName ?? null,
  });

  await prisma.whatsAppConversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "inbound",
      messageType: input.messageType,
      content: input.content ?? null,
      providerMessageId: input.providerMessageId ?? null,
      rawPayload: (input.rawPayload as Prisma.InputJsonValue | null) ?? null,
    },
  });

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: toPreview(input.content),
      unreadCount: { increment: 1 },
      ...(input.channel ? { channel: input.channel } : {}),
    },
  });

  return conversation.id;
}

export async function recordOutgoingWhatsAppMessage(input: {
  phone: string;
  messageType: string;
  content?: string | null;
  providerMessageId?: string | null;
  rawPayload?: unknown;
  channel?: string;
}) {
  const conversation = await upsertConversationByPhone({
    phone: input.phone,
  });

  await prisma.whatsAppConversationMessage.create({
    data: {
      conversationId: conversation.id,
      direction: "outbound",
      messageType: input.messageType,
      content: input.content ?? null,
      providerMessageId: input.providerMessageId ?? null,
      status: input.providerMessageId ? "sent" : "failed",
      rawPayload: (input.rawPayload as Prisma.InputJsonValue | null) ?? null,
    },
  });

  await prisma.whatsAppConversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: new Date(),
      lastMessagePreview: toPreview(input.content),
      ...(input.channel ? { channel: input.channel } : {}),
    },
  });

  return conversation.id;
}

export async function updateWhatsAppMessageStatus(input: {
  providerMessageId: string;
  status: string;
}) {
  const message = await prisma.whatsAppConversationMessage.findFirst({
    where: { providerMessageId: input.providerMessageId },
    select: { id: true },
  });

  if (!message) return;

  await prisma.whatsAppConversationMessage.update({
    where: { id: message.id },
    data: { status: input.status },
  });
}

export async function listWhatsAppConversations() {
  return listWhatsAppConversationsWithFilters();
}

export async function listWhatsAppConversationsWithFilters(filters: WhatsAppConversationFilters = {}) {
  const and: Prisma.WhatsAppConversationWhereInput[] = [{ archived: false }];

  if (filters.unreadOnly) {
    and.push({ unreadCount: { gt: 0 } });
  }

  if (filters.urgentOnly) {
    and.push({ isUrgent: true });
  }

  if (filters.assignedToAdminId) {
    and.push({ assignedAdminId: filters.assignedToAdminId });
  }

  if (filters.unassignedOnly) {
    and.push({ assignedAdminId: null });
  }

  const query = filters.search?.trim();
  if (query) {
    and.push({
      OR: [
        { phone: { contains: query } },
        { waId: { contains: query } },
        { contactName: { contains: query } },
      ],
    });
  }

  return prisma.whatsAppConversation.findMany({
    where: { AND: and },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      phone: true,
      waId: true,
      channel: true,
      contactName: true,
      assignedAdminId: true,
      assignedAdminEmail: true,
      assignedAdminName: true,
      assignedAt: true,
      isUrgent: true,
      lastMessageAt: true,
      lastMessagePreview: true,
      unreadCount: true,
      createdAt: true,
      _count: { select: { messages: true } },
    },
  });
}

export async function getWhatsAppConversationMessages(conversationId: string) {
  return prisma.whatsAppConversationMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      direction: true,
      messageType: true,
      content: true,
      providerMessageId: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function getWhatsAppConversation(conversationId: string) {
  return prisma.whatsAppConversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      phone: true,
      waId: true,
      contactName: true,
      assignedAdminId: true,
      assignedAdminEmail: true,
      assignedAdminName: true,
      assignedAt: true,
      isUrgent: true,
      unreadCount: true,
      lastMessageAt: true,
    },
  });
}

export async function markWhatsAppConversationRead(conversationId: string) {
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { unreadCount: 0 },
  });
}

export async function listWhatsAppInboxAssignees() {
  return prisma.admin.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });
}

export async function assignWhatsAppConversation(
  conversationId: string,
  assignee: { id: string; email: string; name: string } | null,
) {
  return prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: assignee
      ? {
          assignedAdminId: assignee.id,
          assignedAdminEmail: assignee.email,
          assignedAdminName: assignee.name,
          assignedAt: new Date(),
        }
      : {
          assignedAdminId: null,
          assignedAdminEmail: null,
          assignedAdminName: null,
          assignedAt: null,
        },
    select: {
      id: true,
      assignedAdminId: true,
      assignedAdminEmail: true,
      assignedAdminName: true,
      assignedAt: true,
    },
  });
}

export async function setWhatsAppConversationUrgent(conversationId: string, isUrgent: boolean) {
  return prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { isUrgent },
    select: { id: true, isUrgent: true },
  });
}
