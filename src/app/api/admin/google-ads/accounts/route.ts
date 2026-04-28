/**
 * GET    /api/admin/google-ads/accounts — list connected accounts
 * DELETE /api/admin/google-ads/accounts?id=<accountId> — disconnect
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import prisma from "@/lib/db";

async function verifyAdmin(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return !!(payload && payload.type === "admin");
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.googleAdsAccount.findMany({
    orderBy: { createdAt: "desc" },
    // Don't leak the refresh token to the client.
    select: {
      id: true,
      customerId: true,
      loginCustomerId: true,
      name: true,
      currency: true,
      timezone: true,
      isActive: true,
      lastSyncAt: true,
      tokenExpiresAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ accounts });
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  // Soft disconnect: flip isActive off and wipe the refresh token. We keep
  // the row so historical AdPerformanceSnapshot rows still join correctly.
  await prisma.googleAdsAccount.update({
    where: { id },
    data: { isActive: false, refreshToken: "", accessToken: null, tokenExpiresAt: null },
  });
  return NextResponse.json({ success: true });
}
