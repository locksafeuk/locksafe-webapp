import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import twilio from "twilio";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

/** Returns true for UK mobile numbers (07xxx or +447xxx or 00447xxx) */
function isUKMobile(phone: string): boolean {
  const clean = phone.replace(/[\s\-().]/g, "");
  return (
    /^07\d{9}$/.test(clean) ||
    /^\+447\d{9}$/.test(clean) ||
    /^00447\d{9}$/.test(clean)
  );
}

/** Normalise UK mobile to E.164 format for Twilio */
function toE164(phone: string): string {
  const clean = phone.replace(/[\s\-().]/g, "");
  if (clean.startsWith("07")) return "+44" + clean.slice(1);
  if (clean.startsWith("00447")) return "+" + clean.slice(2);
  return clean; // already +447...
}

function buildSms(name: string, city: string): string {
  const firstName = name.split(/\s+/)[0];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.locksafe.uk";
  const signupUrl = `${baseUrl}/locksmith-signup?utm_source=sms&utm_medium=outreach&utm_campaign=locksmith-invite`;
  return (
    `Hi ${firstName}, I'm Alex from LockSafe UK. ` +
    `We're looking for trusted locksmiths in ${city} — we send you paid jobs, you keep 100% of the call-out fee. ` +
    `Join free here: ${signupUrl}\n\nReply STOP to opt out.`
  );
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    return NextResponse.json(
      { error: "Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER env vars." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const client = twilio(accountSid, authToken);

  // Single send: { id: string }
  if (body.id) {
    const lead = await prisma.locksmithLead.findUnique({ where: { id: body.id } });
    if (!lead || !lead.phone || !isUKMobile(lead.phone)) {
      return NextResponse.json({ error: "Lead has no mobile number" }, { status: 400 });
    }
    try {
      await client.messages.create({
        body: buildSms(lead.name, lead.city),
        from: fromNumber,
        to: toE164(lead.phone),
      });
      await prisma.locksmithLead.update({
        where: { id: lead.id },
        data: {
          status: "contacted",
          contactedAt: new Date(),
          contactedBy: "sms",
        },
      });
      return NextResponse.json({ sent: 1, failed: 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // Bulk send: { ids: string[] }
  if (body.ids && Array.isArray(body.ids)) {
    const leads = await prisma.locksmithLead.findMany({
      where: { id: { in: body.ids } },
    });
    let sent = 0;
    let failed = 0;
    const results: { id: string; name: string; success: boolean; error?: string }[] = [];

    for (const lead of leads) {
      if (!lead.phone || !isUKMobile(lead.phone)) {
        results.push({ id: lead.id, name: lead.name, success: false, error: "Not a mobile" });
        failed++;
        continue;
      }
      try {
        await client.messages.create({
          body: buildSms(lead.name, lead.city),
          from: fromNumber,
          to: toE164(lead.phone),
        });
        await prisma.locksmithLead.update({
          where: { id: lead.id },
          data: { status: "contacted", contactedAt: new Date(), contactedBy: "sms" },
        });
        results.push({ id: lead.id, name: lead.name, success: true });
        sent++;
        // 300ms delay between sends to avoid rate limits
        await new Promise(r => setTimeout(r, 300));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.push({ id: lead.id, name: lead.name, success: false, error: msg });
        failed++;
      }
    }

    return NextResponse.json({ sent, failed, results });
  }

  return NextResponse.json({ error: "Provide id or ids" }, { status: 400 });
}
