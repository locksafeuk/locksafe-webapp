import { alternativeUrls, submitToIndexNow } from "@/lib/indexnow";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

async function requireAdmin(): Promise<boolean> {
  const authToken = (await cookies()).get("auth_token");
  if (!authToken) return false;
  const { verifyToken } = await import("@/lib/auth");
  const payload = await verifyToken(authToken.value);
  return Boolean(payload && payload.type === "admin");
}

/**
 * GET /api/indexnow — submit the full competitor-alternatives surface
 * (hub + national + localized city pages) to IndexNow (Bing/Yandex/etc.).
 * Admin only. Hit this after a deploy to nudge fast crawling.
 */
export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const urls = alternativeUrls();
    const result = await submitToIndexNow(urls);
    return NextResponse.json({ success: true, ...result, urls: urls.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "submission failed" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/indexnow { urls?: string[] } — submit arbitrary URLs to IndexNow.
 * Falls back to the alternatives surface if no urls are provided. Admin only.
 * Call this from publish flows when new content goes live.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const urls = Array.isArray(body.urls)
      ? (body.urls as string[])
      : alternativeUrls();
    const result = await submitToIndexNow(urls);
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "submission failed" },
      { status: 500 },
    );
  }
}
