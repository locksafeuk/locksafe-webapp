import { NextRequest, NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin-guard";
import prisma from "@/lib/db";
import { sendSMS } from "@/lib/sms";
import { sendEmail } from "@/lib/email";

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
    let sent = 0, failed = 0, noPhone = 0;
    for (const l of leads) {
      if (!l.phone) { noPhone++; continue; }
      const r = await sendSMS(l.phone, SMS_TEXT(l.name.split(/\s+/)[0] || "there"), { channel: "transactional", logContext: `manual-scrape-sms:${l.id}` }).catch(() => ({ success: false }));
      if (r.success) {
        sent++;
        await prisma.locksmithLead.update({ where: { id: l.id }, data: { status: "contacted", contactedAt: new Date(), contactedBy: "manual-wizard-sms" } }).catch(() => {});
      } else failed++;
      await new Promise((res) => setTimeout(res, 300));
    }
    await prisma.scrapeBatch.update({ where: { id: batchId }, data: { smsSent: { increment: sent } } }).catch(() => {});
    return NextResponse.json({ sent, failed, noPhone });
  }

  if (action === "email") {
    let sent = 0, failed = 0, noEmail = 0;
    for (const l of leads) {
      if (!l.email) { noEmail++; continue; }
      const r = await sendEmail({
        to: l.email,
        subject: "Paid locksmith jobs near you — join LockSafe UK (free)",
        html: `<p>Hi ${l.name.split(/\\s+/)[0] || "there"},</p><p>It's Alex from LockSafe UK. We send local emergency/planned locksmith jobs straight to vetted locksmiths — free to join, no monthly fees, you set your own rates and keep the lion's share.</p><p><a href="https://locksafe.uk/join">Join free (about 5 minutes)</a></p><p>— Alex, LockSafe UK</p>`,
      }).catch(() => ({ success: false }));
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
