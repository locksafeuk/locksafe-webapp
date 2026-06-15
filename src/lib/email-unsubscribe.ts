/**
 * Email unsubscribe + suppression.
 *
 * - Each recipient gets a tokenized, tamper-proof unsubscribe link (HMAC of the
 *   email) so the link can't be guessed or used to unsubscribe someone else.
 * - One-click support per RFC 8058 (List-Unsubscribe / List-Unsubscribe-Post).
 * - A suppression list that every outreach send checks first, so anyone who
 *   unsubscribes (or is spam-reported / bounces) is never emailed again.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import prisma from "@/lib/db";
import { SITE_URL } from "@/lib/config";

const SITE = (SITE_URL || "https://www.locksafe.uk").replace(/\/$/, "");
const SECRET = process.env.JWT_SECRET || "locksafe-unsubscribe-fallback";

function norm(email: string): string {
  return email.trim().toLowerCase();
}

/** Stable per-email token (HMAC, truncated). */
export function signEmail(email: string): string {
  return createHmac("sha256", SECRET).update(norm(email)).digest("hex").slice(0, 32);
}

export function verifyEmailToken(email: string, token: string): boolean {
  if (!email || !token) return false;
  const expected = signEmail(email);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Human-facing confirmation page link (used in the email footer). */
export function buildUnsubscribePageUrl(email: string): string {
  return `${SITE}/unsubscribe?e=${encodeURIComponent(norm(email))}&t=${signEmail(email)}`;
}

/** Machine endpoint for mail-client one-click unsubscribe. */
export function buildUnsubscribeApiUrl(email: string): string {
  return `${SITE}/api/email/unsubscribe?e=${encodeURIComponent(norm(email))}&t=${signEmail(email)}`;
}

/** RFC 8058 headers — enables the native "Unsubscribe" button in Gmail/Outlook. */
export function unsubscribeHeaders(email: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${buildUnsubscribeApiUrl(email)}>, <mailto:contact@locksafe.uk?subject=Unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  if (!email) return false;
  const hit = await prisma.emailSuppression
    .findUnique({ where: { email: norm(email) }, select: { email: true } })
    .catch(() => null);
  return Boolean(hit);
}

export async function suppressEmail(
  email: string,
  opts?: { reason?: string; source?: string },
): Promise<void> {
  const e = norm(email);
  if (!e || !e.includes("@")) return;
  await prisma.emailSuppression
    .upsert({
      where: { email: e },
      update: { reason: opts?.reason, source: opts?.source },
      create: { email: e, reason: opts?.reason ?? "unsubscribe", source: opts?.source ?? "email_link" },
    })
    .catch(() => {});
}
