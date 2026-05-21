/**
 * POST /api/admin/google-ads/drafts/[id]/save-template
 *
 * Persists the draft's full configuration + most recent live snapshot into a
 * reusable `GoogleAdsCampaignTemplate`. This is the explicit "extract all data
 * for future automations" step requested by the admin.
 *
 * Body: { name: string; description?: string; tags?: string[] }
 *
 * If no snapshot exists yet, one will be attempted before saving (so the
 * template captures both the plan AND the live state).
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { captureAndStoreSnapshot } from "@/lib/google-ads-snapshot";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

interface SaveTemplateBody {
  name?: string;
  description?: string;
  tags?: string[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: SaveTemplateBody;
  try {
    body = (await request.json()) as SaveTemplateBody;
  } catch {
    body = {};
  }

  const draft = await prisma.googleAdsCampaignDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const name = body.name?.trim() || draft.name;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  // Best-effort: refresh snapshot if the draft is live but never snapshotted.
  if (draft.googleCampaignId && !draft.publishedSnapshot) {
    await captureAndStoreSnapshot(id).catch(() => {
      /* non-fatal — template is still useful without the live snapshot */
    });
  }
  const refreshed = await prisma.googleAdsCampaignDraft.findUnique({ where: { id } });
  if (!refreshed) return NextResponse.json({ error: "Draft vanished" }, { status: 500 });

  // Upsert by name so re-saving overwrites cleanly.
  const template = await prisma.googleAdsCampaignTemplate.upsert({
    where: { name },
    update: {
      description: body.description ?? undefined,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      sourceDraftId: refreshed.id,
      sourceGoogleCampaignId: refreshed.googleCampaignId,
      sourceAccountId: refreshed.accountId,
      channel: refreshed.channel,
      biddingStrategy: refreshed.biddingStrategy,
      targetCpa: refreshed.targetCpa,
      dailyBudget: refreshed.dailyBudget,
      geoTargets: refreshed.geoTargets,
      languageTargets: refreshed.languageTargets,
      headlines: refreshed.headlines,
      descriptions: refreshed.descriptions,
      finalUrl: refreshed.finalUrl,
      keywords: refreshed.keywords ?? undefined,
      negativeKeywords: refreshed.negativeKeywords,
      snapshot: (refreshed.publishedSnapshot ?? undefined) as unknown as object | undefined,
    },
    create: {
      name,
      description: body.description ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      sourceDraftId: refreshed.id,
      sourceGoogleCampaignId: refreshed.googleCampaignId,
      sourceAccountId: refreshed.accountId,
      channel: refreshed.channel,
      biddingStrategy: refreshed.biddingStrategy,
      targetCpa: refreshed.targetCpa,
      dailyBudget: refreshed.dailyBudget,
      geoTargets: refreshed.geoTargets,
      languageTargets: refreshed.languageTargets,
      headlines: refreshed.headlines,
      descriptions: refreshed.descriptions,
      finalUrl: refreshed.finalUrl,
      keywords: refreshed.keywords as unknown as object,
      negativeKeywords: refreshed.negativeKeywords,
      snapshot: (refreshed.publishedSnapshot ?? null) as unknown as object | null,
      createdBy: admin.id,
    },
  });

  // Link back from the draft so the UI knows it has been templated.
  await prisma.googleAdsCampaignDraft.update({
    where: { id: refreshed.id },
    data: { templateId: template.id },
  });

  return NextResponse.json({ success: true, templateId: template.id, name: template.name });
}
