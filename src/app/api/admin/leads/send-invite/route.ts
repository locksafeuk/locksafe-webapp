import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendLocksmithInviteEmail } from "@/lib/email";

// POST /api/admin/leads/send-invite
// Body: { id: string }  — single lead
// Body: { ids: string[] } — bulk send
export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  if (!payload || payload.type !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const ids: string[] = body.ids ?? (body.id ? [body.id] : []);

  if (ids.length === 0) {
    return NextResponse.json({ error: "No lead IDs provided" }, { status: 400 });
  }

  const results: { id: string; success: boolean; error?: string }[] = [];

  for (const id of ids) {
    try {
      const lead = await (prisma as any).locksmithLead.findUnique({ where: { id } });
      if (!lead) {
        results.push({ id, success: false, error: "Lead not found" });
        continue;
      }
      if (!lead.email) {
        results.push({ id, success: false, error: "No email address" });
        continue;
      }

      const emailResult = await sendLocksmithInviteEmail(lead.email, {
        locksmithName: lead.name,
        city: lead.city,
      });

      if (emailResult.success) {
        // Update status to contacted
        await (prisma as any).locksmithLead.update({
          where: { id },
          data: {
            status: "contacted",
            contactedAt: new Date(),
            contactedBy: "invite-email",
          },
        });
        results.push({ id, success: true });
      } else {
        results.push({ id, success: false, error: "Email send failed" });
      }
    } catch (err) {
      results.push({ id, success: false, error: err instanceof Error ? err.message : "Unknown error" });
    }

    // Small delay between sends to stay within rate limits
    if (ids.length > 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const sent = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  return NextResponse.json({ sent, failed, results });
}
