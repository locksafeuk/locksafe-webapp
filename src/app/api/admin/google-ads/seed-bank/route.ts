/**
 * GET    /api/admin/google-ads/seed-bank   — list all keyword seeds
 * POST   /api/admin/google-ads/seed-bank   — add a new seed { keyword, category? }
 * PATCH  /api/admin/google-ads/seed-bank   — update seed { id, isActive?, category? }
 * DELETE /api/admin/google-ads/seed-bank   — permanently delete a seed { id }
 */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { addSeed } from "@/agents/core/seed-bank";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const seeds = await prisma.keywordSeed.findMany({
    orderBy: [{ isActive: "desc" }, { score: "desc" }, { usageCount: "asc" }],
    take: 500,
  });
  return NextResponse.json({ seeds, total: seeds.length });
}

export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    keyword?: string;
    category?: string;
    notes?: string;
  };
  if (!body.keyword || typeof body.keyword !== "string") {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }

  const ALLOWED_CATEGORIES = ["baseline", "learned", "competitor", "experimental", "negative"] as const;
  type Category = (typeof ALLOWED_CATEGORIES)[number];
  const category: Category = ALLOWED_CATEGORIES.includes(body.category as Category)
    ? (body.category as Category)
    : "experimental";

  const seed = await addSeed(body.keyword, {
    category,
    notes: body.notes,
    source: "admin:manual",
  });

  return NextResponse.json({ seed });
}

export async function PATCH(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ALLOWED_CATEGORIES = ["baseline", "learned", "competitor", "experimental", "negative"] as const;
  type Category = (typeof ALLOWED_CATEGORIES)[number];

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    isActive?: boolean;
    category?: string;
  };
  if (!body.id || (typeof body.isActive !== "boolean" && !body.category)) {
    return NextResponse.json({ error: "id + (isActive or category) required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (body.category && ALLOWED_CATEGORIES.includes(body.category as Category)) {
    data.category = body.category as Category;
  }

  const seed = await prisma.keywordSeed.update({ where: { id: body.id }, data });
  return NextResponse.json({ seed });
}

export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.keywordSeed.delete({ where: { id: body.id } });
  return NextResponse.json({ ok: true });
}
