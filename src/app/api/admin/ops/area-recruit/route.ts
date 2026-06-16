/**
 * Demand-driven recruitment: when a job lands in an area with no coverage, blast
 * that area's known leads with an urgent, local pitch — on the TWO-WAY number so
 * replies are captured and Lockie converts them.
 *
 *   GET  ?city=Milton+Keynes            → preview (who would be messaged)
 *   POST { city, dryRun?, message? }    → send (dryRun:true = preview only)
 *
 * Targets leads in the city that are NEW or already CONTACTED (the latter were
 * reached on the old one-way sender, so their replies were lost — worth a fresh
 * two-way touch). Skips onboarded / not_interested / junk numbers. Marks sent
 * leads contacted (contactedBy: "area-recruit") so the cron won't double up.
 *
 * Auth: admin JWT cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";
import { sendSMS } from "@/lib/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

async function verifyAdmin() {
  const token = (await cookies()).get("auth_token")?.value;
  if (!token) return null;
  const p = await verifyToken(token);
  if (!p || p.type !== "admin") return null;
  return p;
}

function normUkMobile(raw: string | null): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+44")) d = d.slice(1);
  else if (d.startsWith("44")) {/* ok */}
  else if (d.startsWith("0")) d = "44" + d.slice(1);
  else if (d.startsWith("7") && d.length === 10) d = "44" + d;
  else return null;
  if (!/^447\d{9}$/.test(d)) return null;
  return "+" + d;
}
const isJunk = (e164: string) => e164.startsWith("+447451");

// Business listings rarely have a real person's name — the "name" is usually the
// company ("The Key Co", "ACL Locks", "Mr Locksmith"). Greeting those with the
// first word reads like a bot ("Hi The,", "Hi Mr,"). So only use the first word
// when it's plausibly a personal name; otherwise fall back to a clean "there".
const NON_NAME_FIRST_WORDS = new Set([
  "the", "a", "mr", "mrs", "ms", "miss", "dr", "sir", "ltd", "limited", "co",
  "company", "uk", "local", "fast", "auto", "emergency", "services", "service",
  "solutions", "security", "secure", "247", "24",
]);
function friendlyFirstName(name?: string | null): string {
  const raw = (name || "").trim();
  if (!raw) return "there";
  const first = raw.split(/\s+/)[0].replace(/[^a-zA-Z]/g, "");
  if (first.length < 3) return "there";
  const lower = first.toLowerCase();
  if (NON_NAME_FIRST_WORDS.has(lower)) return "there";
  if (/lock|key|secur|smith/i.test(first)) return "there"; // business token
  if (first.length <= 3 && first === first.toUpperCase()) return "there"; // acronym (JIR, CSM, BW, ACL)
  return first;
}

function buildMsg(firstName: string, city: string): string {
  return (
    `Hi ${firstName}, Alex from LockSafe UK. We've got paid locksmith work in ${city} ` +
    `and no local to cover it. Join free (5 min) and it's yours: https://locksafe.uk/join Reply STOP to opt out`
  );
}

async function gather(city: string) {
  const leads = (await prisma.locksmithLead.findMany({
    where: {
      city: { contains: city, mode: "insensitive" },
      status: { in: ["new", "contacted"] },
      phone: { not: null },
    },
    select: { id: true, name: true, phone: true, city: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  })) as Array<{ id: string; name: string; phone: string | null; city: string }>;

  const seen = new Set<string>();
  const targets: { id: string; name: string; phone: string; city: string }[] = [];
  for (const l of leads) {
    const phone = normUkMobile(l.phone);
    if (!phone || isJunk(phone) || seen.has(phone)) continue;
    seen.add(phone);
    targets.push({ id: l.id, name: l.name, phone, city: l.city });
  }
  return targets;
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const city = request.nextUrl.searchParams.get("city")?.trim();
  if (!city) return NextResponse.json({ error: "city is required" }, { status: 400 });
  const targets = await gather(city);
  return NextResponse.json({
    city,
    count: targets.length,
    sampleMessage: buildMsg(friendlyFirstName(targets[0]?.name), city),
    targets: targets.map((t) => ({ name: t.name, phone: t.phone })),
  });
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { city?: string; dryRun?: boolean; message?: string };
  const city = body.city?.trim();
  if (!city) return NextResponse.json({ error: "city is required" }, { status: 400 });
  const dryRun = body.dryRun === true;

  const targets = await gather(city);
  if (dryRun) {
    return NextResponse.json({ dryRun: true, city, count: targets.length, targets: targets.map((t) => t.phone) });
  }

  let sent = 0;
  let failed = 0;
  for (const t of targets) {
    const firstName = friendlyFirstName(t.name);
    const text = body.message ? body.message : buildMsg(firstName, city);
    try {
      const r = await sendSMS(t.phone, text, { channel: "transactional", logContext: `area-recruit:${t.id}` });
      if (r.success) {
        sent++;
        await prisma.locksmithLead.update({
          where: { id: t.id },
          data: { status: "contacted", contactedAt: new Date(), contactedBy: "area-recruit" },
        }).catch(() => {});
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  return NextResponse.json({ dryRun: false, city, total: targets.length, sent, failed });
}
