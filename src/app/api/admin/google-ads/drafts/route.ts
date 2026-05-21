/**
 * GET  /api/admin/google-ads/drafts          — list (filter by ?status=)
 * POST /api/admin/google-ads/drafts          — manually create a custom draft
 *
 * Admin-only. Manual create lets the admin build a campaign from scratch via
 * the UI form (bypassing the AI / coverage helpers). The resulting draft goes
 * through the same APPROVE → PUBLISH lifecycle as any AI-generated one, so the
 * spend-guard still applies.
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.toUpperCase();

  const drafts = await prisma.googleAdsCampaignDraft.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ count: drafts.length, drafts });
}

interface KeywordIn {
  text: string;
  matchType: "EXACT" | "PHRASE" | "BROAD";
}

interface ManualDraftBody {
  accountId?: string;
  name?: string;
  dailyBudget?: number;
  biddingStrategy?: string;
  targetCpa?: number | null;
  channel?: string;
  geoTargets?: string[];
  languageTargets?: string[];
  headlines?: string[];
  descriptions?: string[];
  finalUrl?: string;
  keywords?: KeywordIn[];
  negativeKeywords?: string[];
  approveImmediately?: boolean; // skip the PENDING_APPROVAL stage
  notes?: string;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return bad("Unauthorized", 401);

  let body: ManualDraftBody;
  try {
    body = (await request.json()) as ManualDraftBody;
  } catch {
    return bad("Invalid JSON body");
  }

  // ── Required fields ────────────────────────────────────────────────────────
  const name = body.name?.trim();
  if (!name) return bad("name is required");
  const dailyBudget = Number(body.dailyBudget);
  if (!Number.isFinite(dailyBudget) || dailyBudget <= 0) {
    return bad("dailyBudget must be a positive number (GBP)");
  }
  const finalUrl = body.finalUrl?.trim();
  if (!finalUrl || !/^https?:\/\//i.test(finalUrl)) {
    return bad("finalUrl must be a valid http(s) URL");
  }
  const headlines = (body.headlines ?? []).map((h) => h.trim()).filter(Boolean);
  if (headlines.length < 3) return bad("At least 3 headlines are required (Google Ads RSA minimum)");
  if (headlines.some((h) => h.length > 30)) return bad("Every headline must be 30 chars or less");
  const descriptions = (body.descriptions ?? []).map((d) => d.trim()).filter(Boolean);
  if (descriptions.length < 2) return bad("At least 2 descriptions are required");
  if (descriptions.some((d) => d.length > 90)) return bad("Every description must be 90 chars or less");

  const keywords: KeywordIn[] = Array.isArray(body.keywords)
    ? body.keywords
        .map((k) => ({
          text: String(k?.text ?? "").trim().toLowerCase(),
          matchType: (["EXACT", "PHRASE", "BROAD"] as const).includes(
            String(k?.matchType ?? "").toUpperCase() as KeywordIn["matchType"],
          )
            ? (String(k.matchType).toUpperCase() as KeywordIn["matchType"])
            : "PHRASE",
        }))
        .filter((k) => k.text.length > 0)
    : [];
  if (keywords.length === 0) return bad("At least 1 keyword is required");

  const negativeKeywords = Array.isArray(body.negativeKeywords)
    ? body.negativeKeywords.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
    : [];

  const geoTargets = Array.isArray(body.geoTargets) && body.geoTargets.length > 0
    ? body.geoTargets.map(String)
    : ["2826"]; // UK
  const languageTargets = Array.isArray(body.languageTargets) && body.languageTargets.length > 0
    ? body.languageTargets.map(String)
    : ["1000"]; // English

  const channel = (body.channel ?? "SEARCH").toUpperCase();
  const biddingStrategy = (body.biddingStrategy ?? "MAXIMIZE_CONVERSIONS").toUpperCase();
  const targetCpa = body.targetCpa != null ? Number(body.targetCpa) : null;

  // ── Resolve account: explicit accountId or fall back to the first active. ──
  let accountId = body.accountId?.trim() || null;
  if (!accountId) {
    const acc = await prisma.googleAdsAccount.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (!acc) {
      return bad("No active GoogleAdsAccount found. Connect one via OAuth first.", 409);
    }
    accountId = acc.id;
  } else {
    const exists = await prisma.googleAdsAccount.findUnique({ where: { id: accountId } });
    if (!exists) return bad("accountId does not exist");
  }

  const status = body.approveImmediately ? "APPROVED" : "PENDING_APPROVAL";

  const draft = await prisma.googleAdsCampaignDraft.create({
    data: {
      accountId,
      status,
      name,
      dailyBudget,
      biddingStrategy,
      targetCpa,
      channel,
      geoTargets,
      languageTargets,
      headlines,
      descriptions,
      finalUrl,
      keywords: keywords as unknown as object,
      negativeKeywords,
      aiGenerated: false,
      aiPrompt: body.notes ?? null,
      aiReasoning: "Manually authored via admin UI.",
      createdBy: "admin",
      createdByAdminId: admin.id,
      approvedBy: body.approveImmediately ? admin.id : null,
      approvedAt: body.approveImmediately ? new Date() : null,
    },
  });

  return NextResponse.json({ success: true, draftId: draft.id, status: draft.status }, { status: 201 });
}
