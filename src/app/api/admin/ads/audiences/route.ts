/**
 * Admin Ads Audiences API
 *
 * Endpoints:
 * GET /api/admin/ads/audiences - List all audiences
 * POST /api/admin/ads/audiences - Create a new audience (custom, website, lookalike)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createMetaClient } from "@/lib/meta-marketing";

// Verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

/**
 * GET - List all audiences
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // SAVED, CUSTOM, LOOKALIKE
    const refresh = searchParams.get("refresh") === "true";

    // Get audiences from database
    const audiences = await prisma.adAudience.findMany({
      where: type ? { type: type as "SAVED" | "CUSTOM" | "LOOKALIKE" } : undefined,
      orderBy: { createdAt: "desc" },
    });

    // Optionally refresh from Meta
    let metaAudiences: Array<{ id: string; name: string; subtype: string; approximate_count: number }> = [];
    if (refresh) {
      const metaClient = createMetaClient();
      if (metaClient) {
        try {
          const response = await metaClient.getCustomAudiences();
          metaAudiences = response.data || [];
        } catch (e) {
          console.error("Error fetching Meta audiences:", e);
        }
      }
    }

    return NextResponse.json({
      success: true,
      audiences,
      metaAudiences: refresh ? metaAudiences : undefined,
    });
  } catch (error) {
    console.error("Error fetching audiences:", error);
    return NextResponse.json(
      { error: "Failed to fetch audiences" },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new audience
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      type, // "website", "customer_list", "lookalike", "saved"
      sourceAudienceId, // For lookalikes
      retentionDays, // For website audiences
      country, // For lookalikes
      lookalikeRatio, // 0.01-0.20 for lookalikes
      targeting, // For saved audiences
      includeAllVisitors, // For website audiences
      includeConversions, // For website audiences
      includePageViewers, // For website audiences
      pageViewUrl, // Specific URL for page viewers
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: "Name and type are required" },
        { status: 400 }
      );
    }

    const metaClient = createMetaClient();
    if (!metaClient) {
      return NextResponse.json(
        { error: "Meta client not configured" },
        { status: 400 }
      );
    }

    // Get account for database reference
    const account = await prisma.metaAdAccount.findFirst({
      where: { isActive: true },
    });

    if (!account) {
      return NextResponse.json(
        { error: "No active Meta ad account found. Please complete setup first." },
        { status: 400 }
      );
    }

    let metaAudienceId: string | null = null;
    let estimatedSize: number | undefined;

    switch (type) {
      case "website": {
        // Create website custom audience from pixel visitors
        const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
        if (!pixelId) {
          return NextResponse.json(
            { error: "Meta Pixel ID not configured" },
            { status: 400 }
          );
        }

        // Build rule based on options
        const rules: Array<Record<string, unknown>> = [];

        if (includeAllVisitors) {
          rules.push({
            event_sources: [{ type: "pixel", id: pixelId }],
            retention_seconds: (retentionDays || 30) * 86400,
          });
        }

        if (includeConversions) {
          rules.push({
            event_sources: [{ type: "pixel", id: pixelId }],
            retention_seconds: (retentionDays || 30) * 86400,
            filter: {
              operator: "or",
              filters: [
                { field: "event", operator: "eq", value: "Lead" },
                { field: "event", operator: "eq", value: "Purchase" },
                { field: "event", operator: "eq", value: "CompleteRegistration" },
              ],
            },
          });
        }

        if (includePageViewers && pageViewUrl) {
          rules.push({
            event_sources: [{ type: "pixel", id: pixelId }],
            retention_seconds: (retentionDays || 30) * 86400,
            filter: {
              operator: "and",
              filters: [
                { field: "event", operator: "eq", value: "PageView" },
                { field: "url", operator: "i_contains", value: pageViewUrl },
              ],
            },
          });
        }

        // Default rule if no specific options selected
        if (rules.length === 0) {
          rules.push({
            event_sources: [{ type: "pixel", id: pixelId }],
            retention_seconds: (retentionDays || 30) * 86400,
          });
        }

        const result = await metaClient.createCustomAudience({
          name,
          description: description || `Website visitors - ${retentionDays || 30} day retention`,
          subtype: "WEBSITE",
          pixelId,
          retentionDays: retentionDays || 30,
          rule: {
            inclusions: {
              operator: "or",
              rules,
            },
          },
        });

        metaAudienceId = result.id;
        break;
      }

      case "lookalike": {
        if (!sourceAudienceId) {
          return NextResponse.json(
            { error: "Source audience ID required for lookalike" },
            { status: 400 }
          );
        }

        const result = await metaClient.createLookalikeAudience({
          name,
          sourceAudienceId,
          country: country || "GB",
          ratio: lookalikeRatio || 0.01, // Default to 1%
        });

        metaAudienceId = result.id;
        break;
      }

      case "saved": {
        // Saved audiences are just targeting specs, not created in Meta
        // They're stored locally and used when creating ad sets
        break;
      }

      default:
        return NextResponse.json(
          { error: `Invalid audience type: ${type}` },
          { status: 400 }
        );
    }

    // Get estimated size if we created in Meta
    if (metaAudienceId) {
      try {
        const audiences = await metaClient.getCustomAudiences();
        const created = audiences.data?.find((a) => a.id === metaAudienceId);
        estimatedSize = created?.approximate_count;
      } catch (e) {
        console.warn("Could not fetch audience size:", e);
      }
    }

    // Save to database
    const audience = await prisma.adAudience.create({
      data: {
        metaAudienceId,
        accountId: account.id,
        name,
        description: description || null,
        type: type === "website" ? "CUSTOM" : type === "lookalike" ? "LOOKALIKE" : "SAVED",
        targeting: targeting || {},
        estimatedSize,
        aiGenerated: false,
      },
    });

    return NextResponse.json({
      success: true,
      audience,
      metaAudienceId,
      message: `Audience "${name}" created successfully`,
    });
  } catch (error) {
    console.error("Error creating audience:", error);
    return NextResponse.json(
      {
        error: "Failed to create audience",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
