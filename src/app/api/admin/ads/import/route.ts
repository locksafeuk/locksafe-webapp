/**
 * Admin Ads Import API
 *
 * Endpoints:
 * GET /api/admin/ads/import - Preview what would be imported
 * POST /api/admin/ads/import - Run the import
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import {
  importFromMeta,
  testMetaConnection,
  previewImport,
  type ImportOptions,
} from "@/lib/meta-import";

// Verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

/**
 * GET - Preview import or test connection
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || "preview";

    if (action === "test") {
      // Test the Meta API connection
      const testResult = await testMetaConnection();
      return NextResponse.json(testResult);
    }

    // Preview what would be imported
    const preview = await previewImport();
    return NextResponse.json({
      success: preview.success,
      preview,
    });
  } catch (error) {
    console.error("Error in import preview:", error);
    return NextResponse.json(
      { error: "Failed to preview import" },
      { status: 500 }
    );
  }
}

/**
 * POST - Run the import
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse options
    const body = await request.json().catch(() => ({}));
    const options: ImportOptions = {
      status: body.status || "ALL",
      includePaused: body.includePaused !== false,
      updateExisting: body.updateExisting || false,
    };

    console.log(`[Admin Import] Import triggered by admin, options:`, options);

    const result = await importFromMeta(options);

    return NextResponse.json({
      success: result.success,
      result,
      message: result.success
        ? `Successfully imported ${result.campaignsImported} campaigns, ${result.adSetsImported} ad sets, ${result.adsImported} ads`
        : `Import completed with ${result.errors.length} errors`,
    });
  } catch (error) {
    console.error("Error running import:", error);
    return NextResponse.json(
      {
        error: "Failed to run import",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
