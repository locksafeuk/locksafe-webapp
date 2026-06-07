/**
 * Branded short links — locksafe.uk/r/{code}
 *
 * Keeps SMS bodies inside one GSM-7 segment (a link costs a fixed ~21 chars)
 * and logs clicks on our own domain. UK carriers penalise generic shorteners
 * (bit.ly etc.); a branded domain avoids that and builds trust.
 */

import { randomBytes } from "node:crypto";
import prisma from "@/lib/db";

const SHORT_LINK_BASE = (process.env.SHORT_LINK_BASE || "https://locksafe.uk").replace(/\/$/, "");
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"; // no 0/O/1/l/I/i

function generateCode(length = 6): string {
  const bytes = randomBytes(length);
  let code = "";
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export interface ShortLinkInput {
  targetUrl: string;
  purpose?: string;
  locksmithId?: string;
  leadId?: string;
  jobId?: string;
}

/** Create (or reuse) a short link. Returns the full short URL, e.g. https://locksafe.uk/r/Ab3xYz */
export async function createShortLink(input: ShortLinkInput): Promise<string> {
  // Reuse an existing link for the same target+purpose+subject to avoid bloat
  const existing = await prisma.shortLink.findFirst({
    where: {
      targetUrl: input.targetUrl,
      purpose: input.purpose ?? null,
      locksmithId: input.locksmithId ?? null,
      leadId: input.leadId ?? null,
      jobId: input.jobId ?? null,
    },
    select: { code: true },
  });
  if (existing) return `${SHORT_LINK_BASE}/r/${existing.code}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCode();
    try {
      await prisma.shortLink.create({
        data: {
          code,
          targetUrl: input.targetUrl,
          purpose: input.purpose,
          locksmithId: input.locksmithId,
          leadId: input.leadId,
          jobId: input.jobId,
        },
      });
      return `${SHORT_LINK_BASE}/r/${code}`;
    } catch {
      // code collision — retry with a fresh code
    }
  }

  // Last resort: fall back to the raw target URL rather than failing the send
  return input.targetUrl;
}

/** Resolve a code → target URL, logging the click. Returns null when unknown. */
export async function resolveShortLink(code: string): Promise<string | null> {
  try {
    const link = await prisma.shortLink.update({
      where: { code },
      data: { clicks: { increment: 1 }, lastClickedAt: new Date() },
      select: { targetUrl: true },
    });
    return link.targetUrl;
  } catch {
    return null;
  }
}
