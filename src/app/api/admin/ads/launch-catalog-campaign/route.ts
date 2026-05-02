/**
 * Launch Catalog Campaign — CMO acquisition engine entry point
 *
 * POST /api/admin/ads/launch-catalog-campaign
 *
 * Builds a complete Meta campaign tree backed by the service catalog:
 *   1. Resolves the active MetaCatalogConfig and an existing or new
 *      ServiceCatalogProductSet covering the requested slugs.
 *   2. Generates 4 DR ad variants per slug via `generateServiceAdCreatives`.
 *   3. Persists Campaign + 2 AdSets (prospecting + retargeting) + AdCreatives
 *      + Ads in the DB as DRAFT/PAUSED.
 *   4. Files an AgentApproval (Phase 2 gate). Actual publish to Meta
 *      happens through the existing /api/admin/ads/[id]/publish route once
 *      approved.
 *
 * The route NEVER creates entities in Meta directly — it only produces a
 * fully-formed draft. This keeps the publish/approval/spend-guard flow
 * single-source-of-truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { generateServiceAdCreatives } from "@/lib/openai-ads";
import {
  isServiceSlug,
  getServiceBySlug,
  type ServiceSlug,
} from "@/lib/services-catalog";
import { AdObjective, AdStatus, CreativeType } from "@prisma/client";

const RETARGET_WINDOW_DAYS = 180;

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

interface LaunchBody {
  slugs: string[];
  dailyBudget: number;
  durationDays?: number;
  city?: string;
  /** When true, fires the agent approval row alongside the draft. */
  requestApproval?: boolean;
  /** Initiator marker — defaults to "admin"; agent flows pass "agent". */
  initiator?: "admin" | "agent";
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as Partial<LaunchBody>;

    // ---- Validate input ----
    const slugs = Array.isArray(body.slugs) ? body.slugs.filter(isServiceSlug) : [];
    if (slugs.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one valid service slug." },
        { status: 400 },
      );
    }
    const dailyBudget = Number(body.dailyBudget);
    if (!Number.isFinite(dailyBudget) || dailyBudget < 1) {
      return NextResponse.json(
        { error: "dailyBudget must be a number ≥ £1." },
        { status: 400 },
      );
    }
    const durationDays = Number.isFinite(body.durationDays as number)
      ? Math.min(Math.max(Number(body.durationDays), 1), 90)
      : 14;
    const city = typeof body.city === "string" && body.city.trim() ? body.city.trim() : undefined;
    const initiator = body.initiator === "agent" ? "agent" : "admin";

    // ---- Resolve catalog + product set ----
    const catalogConfig = await prisma.metaCatalogConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!catalogConfig) {
      return NextResponse.json(
        {
          error:
            "No active Meta catalog connected. Configure one at /admin/marketing/meta-catalog before launching catalog campaigns.",
        },
        { status: 400 },
      );
    }

    const slugsKey = [...slugs].sort().join(",");
    let productSetRow = await prisma.serviceCatalogProductSet.findUnique({
      where: { slugsKey },
    });

    // Note: actual product_set creation against Graph API happens at publish time.
    // Here we just upsert the DB shell; productSetId stays null until publish.
    if (!productSetRow) {
      productSetRow = await prisma.serviceCatalogProductSet.create({
        data: {
          catalogId: catalogConfig.catalogId,
          // Placeholder — real id populated by publish route.
          productSetId: `pending:${slugsKey}`,
          name: `LockSafe – ${slugs.join(" / ")}`,
          slugsKey,
          slugs: [...slugs],
        },
      });
    }

    // ---- Resolve MetaAdAccount row ----
    let metaAccount = await prisma.metaAdAccount.findFirst({
      where: { isActive: true },
    });
    if (!metaAccount && process.env.META_AD_ACCOUNT_ID) {
      metaAccount = await prisma.metaAdAccount.create({
        data: {
          accountId: process.env.META_AD_ACCOUNT_ID,
          businessId: process.env.META_BUSINESS_ID,
          name: "Primary Ad Account",
          accessToken: process.env.META_ACCESS_TOKEN || "",
          pixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
        },
      });
    }
    if (!metaAccount) {
      return NextResponse.json(
        { error: "No Meta ad account configured (META_AD_ACCOUNT_ID missing)." },
        { status: 400 },
      );
    }

    // ---- Generate DR variants per slug ----
    const variantsPerSlug: Record<string, Awaited<ReturnType<typeof generateServiceAdCreatives>>> = {};
    for (const slug of slugs) {
      // sequential — keeps OpenAI bill predictable and avoids rate-limit surprises
      variantsPerSlug[slug] = await generateServiceAdCreatives({ slug, city });
      if (variantsPerSlug[slug].variants.length === 0) {
        return NextResponse.json(
          {
            error: `Copywriter failed validation for slug "${slug}".`,
            rejected: variantsPerSlug[slug].rejected,
          },
          { status: 502 },
        );
      }
    }

    // ---- Build campaign tree in DB ----
    const campaignName = `[CMO] LockSafe – ${slugs
      .map((s) => getServiceBySlug(s)?.title ?? s)
      .join(" / ")} – ${new Date().toISOString().slice(0, 10)}`;

    // Pre-load admin-overridden catalog images so each creative's `imageUrl`
    // matches the actual image Meta serves from the catalog feed (instead of
    // the auto-generated OG card).
    const catalogOverrides = await prisma.serviceCatalogItem.findMany({
      where: { slug: { in: slugs } },
      select: { slug: true, imageUrl: true },
    });
    const overrideImageBySlug = new Map<string, string>(
      catalogOverrides
        .filter((r): r is { slug: string; imageUrl: string } => Boolean(r.imageUrl))
        .map((r) => [r.slug, r.imageUrl]),
    );

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    const campaign = await prisma.adCampaign.create({
      data: {
        accountId: metaAccount.id,
        name: campaignName,
        objective: AdObjective.SALES,
        status: AdStatus.DRAFT,
        dailyBudget,
        startDate,
        endDate,
        aiGenerated: true,
        aiPrompt: `launchAcquisitionEngine: slugs=${slugs.join(",")}, daily=£${dailyBudget}`,
      },
    });

    // Common UK targeting baseline
    const baseTargeting = {
      geo_locations: { countries: ["GB"] },
      age_min: 25,
      age_max: 65,
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed", "story", "marketplace"],
      instagram_positions: ["stream", "story", "reels"],
    };

    const adsetsCreated: Array<{ id: string; mode: string }> = [];

    for (const mode of ["prospecting", "retargeting"] as const) {
      const adsetTargeting =
        mode === "retargeting"
          ? {
              ...baseTargeting,
              custom_audiences: [], // populated at publish time after audience materialisation
            }
          : baseTargeting;

      const adset = await prisma.adSet.create({
        data: {
          campaignId: campaign.id,
          name: `${mode === "prospecting" ? "Prospecting" : `Retargeting ${RETARGET_WINDOW_DAYS}d ViewContent`} – ${slugs.length} services`,
          status: AdStatus.DRAFT,
          dailyBudget: dailyBudget / 2, // split evenly
          startDate,
          endDate,
          optimizationGoal: "OFFSITE_CONVERSIONS",
          billingEvent: "IMPRESSIONS",
          targeting: adsetTargeting,
          placements: [],
          productSetId: productSetRow.productSetId,
          serviceSlugs: [...slugs],
          isCatalogAdset: true,
          catalogMode: mode,
        },
      });

      // For each slug, create one ad with one creative per angle. Creative
      // text is stored verbatim — at publish time the catalog ad creative
      // wraps these as template_data (so {{product.name}} etc. still expand).
      for (const slug of slugs) {
        const service = getServiceBySlug(slug as ServiceSlug);
        if (!service) continue;
        const result = variantsPerSlug[slug];
        for (const variant of result.variants) {
          const creative = await prisma.adCreative.create({
            data: {
              type: CreativeType.IMAGE,
              primaryText: variant.primaryText,
              headline: variant.headline,
              description: variant.description,
              callToAction: variant.cta,
              // Use the admin-managed catalog image override when set
              // (same image Meta serves from the catalog feed); fall back to
              // the auto OG image. At publish time, catalog adsets route
              // through DPA which ignores this field anyway.
              imageUrl: overrideImageBySlug.get(slug) || service.image_link,
              destinationUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "https://locksafe.uk"}/services/${slug}`,
              aiGenerated: true,
              emotionalAngle: variant.angle,
              aiPrompt: `service=${slug} framework=${variant.framework} angle=${variant.angle}`,
            },
          });

          await prisma.ad.create({
            data: {
              adSetId: adset.id,
              creativeId: creative.id,
              name: `${service.title} – ${variant.angle} (${mode})`,
              status: AdStatus.DRAFT,
              utmCampaign: campaign.id,
              utmContent: `${slug}-${variant.angle}`,
              pixelEventType: "Purchase",
              aiGenerated: true,
              aiVariation: variant.angle,
            },
          });
        }
      }
      adsetsCreated.push({ id: adset.id, mode });
    }

    // ---- File approval row (Phase 2) ----
    let approvalId: string | null = null;
    if (body.requestApproval !== false) {
      const cmoAgent = await prisma.agent.findFirst({
        where: { name: { in: ["cmo", "ads-specialist"] } },
        orderBy: { createdAt: "asc" },
      });
      if (cmoAgent) {
        const approval = await prisma.agentApproval.create({
          data: {
            agentId: cmoAgent.id,
            executionId: cmoAgent.id, // placeholder — real exec id when called from a heartbeat
            actionType: "publish_catalog_campaign",
            actionDetails: JSON.stringify({
              campaignId: campaign.id,
              slugs,
              dailyBudget,
              durationDays,
              adsetsCreated,
            }),
            reason: `Launch DR catalog campaign for ${slugs.length} service(s) at £${dailyBudget}/day for ${durationDays} days`,
            targetType: "ad_campaign",
            targetId: campaign.id,
            status: "pending",
            notifiedVia: ["dashboard"],
          },
        });
        approvalId = approval.id;
      }
    }

    return NextResponse.json({
      success: true,
      initiator,
      campaignId: campaign.id,
      adsets: adsetsCreated,
      productSetSlugsKey: slugsKey,
      approvalId,
      summary: {
        slugs,
        dailyBudget,
        durationDays,
        totalAds: adsetsCreated.length * slugs.length * 4,
      },
    });
  } catch (error) {
    console.error("[launch-catalog-campaign] error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to launch catalog campaign.",
      },
      { status: 500 },
    );
  }
}
