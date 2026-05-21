/**
 * GET /api/admin/google-ads/templates  — list reusable campaign templates
 *
 * Templates are the captured "extract" of any successful manual campaign and
 * are the seed dataset for future automated campaign creation.
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

export async function GET(_request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.googleAdsCampaignTemplate.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ count: templates.length, templates });
}
