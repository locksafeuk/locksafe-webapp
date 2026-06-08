/**
 * Cron: /api/cron/indexnow
 *
 * Daily IndexNow submission of the competitor-alternatives surface (hub +
 * national + localized city pages) to Bing/Yandex/etc., so newly added
 * competitors or covered cities get crawled within ~24h instead of waiting
 * for an organic crawl. Runs after generate-district-landings (02:00).
 *
 * Note: IndexNow is ignored by Google — for Google use the sitemap + Search
 * Console. This only accelerates the participating engines.
 */
import { verifyCronAuth } from "@/lib/cron-auth";
import { alternativeUrls, submitToIndexNow } from "@/lib/indexnow";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }
  try {
    const result = await submitToIndexNow(alternativeUrls());
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "failed" },
      { status: 500 },
    );
  }
}
