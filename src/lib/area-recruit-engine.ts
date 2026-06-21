/**
 * Demand-triggered local recruitment.
 *
 * When a job can't be covered in an area, we turn that gap into a targeted
 * recruitment push: SMS every local locksmith LEAD we've scraped for that town,
 * inviting them to join. Safety rails: UK reasonable-hours only, a per-lead
 * cooldown so an area is never re-spammed, and a per-event cap.
 */

import prisma from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import { toUkMobile } from "@/lib/web-email-scrape";

const isJunkMobile = (e164: string) => e164.startsWith("+447451");

const NON_NAME_FIRST_WORDS = new Set([
  "the", "a", "mr", "mrs", "ms", "miss", "dr", "sir", "ltd", "limited", "co",
  "company", "uk", "local", "fast", "auto", "emergency", "services", "service",
  "solutions", "security", "secure", "247", "24",
]);

export function friendlyFirstName(name?: string | null): string {
  const raw = (name || "").trim();
  if (!raw) return "there";
  const first = raw.split(/\s+/)[0].replace(/[^a-zA-Z]/g, "");
  if (first.length < 3) return "there";
  const lower = first.toLowerCase();
  if (NON_NAME_FIRST_WORDS.has(lower)) return "there";
  if (/lock|key|secur|smith/i.test(first)) return "there";
  if (first.length <= 3 && first === first.toUpperCase()) return "there";
  return first;
}

export function buildRecruitMsg(firstName: string, city: string): string {
  return (
    `Hi ${firstName}, Alex from LockSafe UK. We've got paid locksmith work in ${city} ` +
    `and no local to cover it. Join free (5 min) and it's yours: https://locksafe.uk/join Reply STOP to opt out`
  );
}

/** True only inside ~09:00–20:00 Europe/London (reasonable contact hours). */
export function withinUkHours(d = new Date()): boolean {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Europe/London" }).format(d),
  );
  return h >= 9 && h < 20;
}

/** Resolve a UK postcode to a town/district name (for matching scraped leads). */
export async function postcodeToTown(postcode: string): Promise<string | null> {
  try {
    const clean = postcode.trim().replace(/\s+/g, " ");
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
    const data = await res.json();
    if (data.status === 200 && data.result) {
      return (
        data.result.admin_district ||
        data.result.parish ||
        data.result.admin_ward ||
        data.result.region ||
        null
      );
    }
  } catch {
    /* ignore */
  }
  return null;
}

export interface RecruitResult {
  city: string;
  targeted: number;
  sent: number;
  failed: number;
  skippedCooldown: number;
  skippedHours: boolean;
}

/**
 * Recruit local locksmith leads for a town.
 * @param cooldownDays leads contacted within this many days are skipped (0 = no cooldown, e.g. manual admin send).
 */
export async function recruitArea(
  city: string,
  opts?: { cooldownDays?: number; cap?: number; contactedBy?: string; message?: string; enforceHours?: boolean },
): Promise<RecruitResult> {
  const cap = opts?.cap ?? 40;
  const cooldownDays = opts?.cooldownDays ?? 0;
  const contactedBy = opts?.contactedBy ?? "area-recruit";
  const cooldownDate = cooldownDays > 0 ? new Date(Date.now() - cooldownDays * 86_400_000) : null;

  if (opts?.enforceHours && !withinUkHours()) {
    return { city, targeted: 0, sent: 0, failed: 0, skippedCooldown: 0, skippedHours: true };
  }

  const leads = await prisma.locksmithLead.findMany({
    where: {
      city: { contains: city, mode: "insensitive" },
      phone: { not: null },
      status: { in: ["new", "contacted"] },
    },
    select: { id: true, name: true, phone: true, contactedAt: true },
    take: 250,
  });

  let skippedCooldown = 0;
  const targets: { id: string; name: string; mobile: string }[] = [];
  for (const l of leads) {
    const mobile = toUkMobile(l.phone);
    if (!mobile || isJunkMobile(mobile)) continue;
    if (cooldownDate && l.contactedAt && new Date(l.contactedAt) > cooldownDate) {
      skippedCooldown++;
      continue;
    }
    targets.push({ id: l.id, name: l.name, mobile });
    if (targets.length >= cap) break;
  }

  let sent = 0, failed = 0;
  for (const t of targets) {
    const text = opts?.message || buildRecruitMsg(friendlyFirstName(t.name), city);
    try {
      const r = await sendSMS(t.mobile, text, { channel: "transactional", logContext: `${contactedBy}:${t.id}` });
      if (r.success) {
        sent++;
        await prisma.locksmithLead
          .update({ where: { id: t.id }, data: { status: "contacted", contactedAt: new Date(), contactedBy } })
          .catch(() => {});
      } else failed++;
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return { city, targeted: targets.length, sent, failed, skippedCooldown, skippedHours: false };
}
