/**
 * GET  /api/admin/meta-catalog/catalogs
 *   Lists catalogs owned by the configured Meta business so the admin can
 *   pick which one to sync into.
 *
 * POST /api/admin/meta-catalog/catalogs
 *   Body: { name }
 *   Creates a new catalog under the configured business and returns it.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { listCatalogs, createCatalog } from "@/lib/meta-catalog-api";

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const catalogs = await listCatalogs();
    return NextResponse.json({ success: true, catalogs });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const name = body?.name;
  if (typeof name !== "string" || name.trim().length < 3) {
    return NextResponse.json({ error: "Catalog name required (>=3 chars)" }, { status: 400 });
  }
  try {
    const catalog = await createCatalog(name.trim());
    return NextResponse.json({ success: true, catalog });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 502 },
    );
  }
}
