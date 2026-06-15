import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import { isUkMobileNumber } from "@/lib/phone";
import { sendLocksmithInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const SMS_TEXT = (firstName: string) =>
  `Hi ${firstName}, Alex from LockSafe UK. Paid locksmith jobs in your area, no monthly fees, set your own rates. Join free: https://locksafe.uk/join Reply STOP to opt out`;

function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  if (!(await getAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { batchId } = await params;
  const body = await req.json().catch(() => ({}));
  const action: string = body.action;
  const ids: string[] = Array.isArray(body.leadIds) ? body.leadIds : [];

  const where = ids.length ? { id: { in: ids }, scrapeBatchId: batchId } : { scrapeBatchId: batchId };
  const leads = await prisma.locksmithLead.findMany({
    where,
    select: { id: true, name: true, contactPerson: true, email: true, phone: true, website: true, city: true, address: true, rating: true, reviewCount: true, category: true, googleMapsUrl: true, status: true },
  });

  if (action === "export_csv") {
    const cols = ["name", "contactPerson", "email", "phone", "website", "city", "address", "category", "rating", "reviewCount", "googleMapsUrl", "status"];
    const rows = [cols.join(",")].concat(leads.map((l) => cols.map((c) => csvEscape((l as Record<string, unknown>)[c])).join(",")));
    return new NextResponse(rows.join("\n"), {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="leads-${batchId}.csv"` },
    });
  }

  if (action === "tag") {
    const tags: string[] = Array.isArray(body.tags) ? body.tags : [];
    await prisma.locksmithLead.updateMany({ where, data: { tags } });
    return NextResponse.json({ updated: leads.length, tags });
  }

  if (action === "assign") {
    await prisma.locksmithLead.updateMany({ where, data: { assignedTo: String(body.assignedTo || "") } });
    return NextResponse.json({ updated: leads.length, assignedTo: body.assignedTo });
  }

  if (action === "mark_contacted") {
    await prisma.locksmithLead.updateMany({ where, data: { status: "contacted", contactedAt: new Date(), contactedBy: "manual-wizard" } });
    return NextResponse.json({ updated: leads.length });
  }

  if (action === "sms") {
    let sent = 0, failed = 0, noPhone = 0, notMobile = 0;
    for (const l of leads) {
      if (!l.phone) { noPhone++; continue; }
      // SMS only sends to UK mobiles. Scraped Google Maps listings are mostly
      // business landlines / 0800 numbers / mis-parsed internationals — texting
      // those just burns spend and trips the messaging-health watchdog.
      if (!isUkMobileNumber(l.phone)) { notMobile++; continue; }
      const r = await sendSMS(l.phone, SMS_TEXT(l.name.split(/\s+/)[0] || "there"), { channel: "transactional", logContext: `manual-scrape-sms:${l.id}` }).catch(() => ({ success: false }));
      if (r.success) {
        sent++;
        await prisma.locksmithLead.update({ where: { id: l.id }, data: { status: "contacted", contactedAt: new Date(), contactedBy: "manual-wizard-sms" } }).catch(() => {});
      } else failed++;
      await new Promise((res) => setTimeout(res, 300));
    }
    await prisma.scrapeBatch.update({ where: { id: batchId }, data: { smsSent: { increment: sent } } }).catch(() => {});
    return NextResponse.json({ sent, failed, noPhone, notMobile });
  }

  if (action === "email") {
    let sent = 0, failed = 0, noEmail = 0;
    for (const l of leads) {
      if (!l.email) { noEmail++; continue; }
      // Use the same branded recruitment template as the main scraping outreach
      // (/admin/leads/send-invite) — full LockSafe partner invite, not plain text.
      const contactName = (l.contactPerson || l.name || "there").split(/\s+/)[0] || "there";
      const r = await sendLocksmithInviteEmail(
        l.email,
        { locksmithName: contactName, city: l.city || "your area" },
        {
          signupUrl: "https://locksafe.uk/for-locksmiths?utm_source=invite&utm_medium=email&utm_campaign=manual-scraper",
        },
      ).catch(() => ({ success: false }));
      if ((r as { success?: boolean }).success) {
        sent++;
        await prisma.locksmithLead.update({ where: { id: l.id }, data: { status: "contacted", contactedAt: new Date(), contactedBy: "manual-wizard-email" } }).catch(() => {});
      } else failed++;
    }
    await prisma.scrapeBatch.update({ where: { id: batchId }, data: { emailsSent: { increment: sent } } }).catch(() => {});
    return NextResponse.json({ sent, failed, noEmail });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
