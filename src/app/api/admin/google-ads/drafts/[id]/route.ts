/**
 * GET    /api/admin/google-ads/drafts/[id]   — fetch full draft
 * DELETE /api/admin/google-ads/drafts/[id]   — soft-delete (only if not PUBLISHED)
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { buildResourceName, getGoogleAdsClientForAccount } from "@/lib/google-ads";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await prisma.googleAdsCampaignDraft.findUnique({
    where: { id },
    include: { account: { select: { id: true, name: true, customerId: true } } },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  let approval = null;
  if (draft.approvalId) {
    approval = await prisma.agentApproval.findUnique({ where: { id: draft.approvalId } });
  }

  return NextResponse.json({ draft, approval });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const draft = await prisma.googleAdsCampaignDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  if (draft.googleCampaignId) {
    const client = await getGoogleAdsClientForAccount(draft.accountId);
    if (!client) {
      return NextResponse.json(
        {
          error:
            "Cannot delete because no active Google Ads account is connected for this draft.",
        },
        { status: 400 },
      );
    }

    const campaignResourceName = buildResourceName(
      client.customerIdPlain,
      "campaigns",
      draft.googleCampaignId,
    );

    try {
      // Best effort check: if campaign is already removed/missing, we skip mutate.
      const rows = await client.query<{ campaign: { id: string; status: string } }>(`
        SELECT campaign.id, campaign.status
        FROM campaign
        WHERE campaign.id = ${draft.googleCampaignId}
      `);

      const live = rows[0]?.campaign;
      if (live && live.status !== "REMOVED") {
        await client.mutate("campaigns", [{ remove: campaignResourceName }]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const missing = /NOT_FOUND|RESOURCE_NOT_FOUND|not\s+found/i.test(message);
      if (!missing) {
        return NextResponse.json(
          {
            error: "Failed to remove linked Google Ads campaign before delete.",
            details: message,
          },
          { status: 500 },
        );
      }
    }
  }

  await prisma.googleAdsCampaignDraft.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
