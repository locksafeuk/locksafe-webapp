import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveSmsProvider, isSmsProviderConfigured, sendSMS } from "@/lib/sms";

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

function buildSms(name: string, city: string): string {
  const firstName = name.split(/\s+/)[0];
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.locksafe.uk";
  const signupUrl = `${baseUrl}/for-locksmiths?utm_source=sms&utm_medium=outreach&utm_campaign=locksmith-invite`;
  return (
    `Hi ${firstName}, I'm Alex from LockSafe UK. ` +
    `We're looking for trusted locksmiths in ${city} — we send you paid jobs, you keep 100% of the call-out fee. ` +
    `Join free here: ${signupUrl}\n\nReply STOP to opt out.`
  );
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const provider = getActiveSmsProvider();

  if (!isSmsProviderConfigured(provider)) {
    return NextResponse.json(
      { error: `SMS provider (${provider}) not configured` },
      { status: 503 }
    );
  }

  const body = await req.json();

  // Single send: { id: string }
  if (body.id) {
    const lead = await prisma.locksmithLead.findUnique({ where: { id: body.id } });
    if (!lead || !lead.phone || !isUKMobile(lead.phone)) {
      return NextResponse.json({ error: "Lead has no mobile number" }, { status: 400 });
    }
    const sendResult = await sendSMS(lead.phone, buildSms(lead.name, lead.city), {
      logContext: `admin-leads-single:${lead.id}`,
    });

    if (!sendResult.success) {
      return NextResponse.json(
        { error: sendResult.error || "Failed to send SMS" },
        { status: 500 }
      );
    }

    try {
      await prisma.locksmithLead.update({
        where: { id: lead.id },
        data: {
          status: "contacted",
          contactedAt: new Date(),
          contactedBy: "sms",
        },
      });
      return NextResponse.json({ sent: 1, failed: 0, provider });
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
        const sendResult = await sendSMS(lead.phone, buildSms(lead.name, lead.city), {
          logContext: `admin-leads-bulk:${lead.id}`,
        });

        if (!sendResult.success) {
          results.push({
            id: lead.id,
            name: lead.name,
            success: false,
            error: sendResult.error || "Failed to send SMS",
          });
          failed++;
          continue;
        }

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

    return NextResponse.json({ sent, failed, results, provider });
  }

  return NextResponse.json({ error: "Provide id or ids" }, { status: 400 });
}
