/**
 * GET /api/admin/social/accounts
 *
 * Returns all SocialAccount records (active + inactive) for the admin dashboard.
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

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.socialAccount.findMany({
    select: {
      id: true,
      platform: true,
      accountId: true,
      accountName: true,
      accountHandle: true,
      isActive: true,
      tokenExpiresAt: true,
      lastSyncAt: true,
    },
    orderBy: [{ isActive: "desc" }, { platform: "asc" }],
  });

  return NextResponse.json({ accounts });
}
