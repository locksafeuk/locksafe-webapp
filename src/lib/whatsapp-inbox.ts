import prisma from "@/lib/db";
import { Prisma } from "@prisma/client";

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

export async function recordIncomingWhatsAppMessage(input: {
  phone: string;
  waId?: string | null;
  contactName?: string | null;
  messageType: string;
  content?: string | null;
  providerMessageId?: string | null;
  rawPayload?: unknown;
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
  return prisma.whatsAppConversation.findMany({
    where: { archived: false },
    orderBy: { lastMessageAt: "desc" },
    select: {
      id: true,
      phone: true,
      waId: true,
      contactName: true,
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
