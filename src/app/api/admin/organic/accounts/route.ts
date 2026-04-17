/**
 * API Route: /api/admin/organic/accounts
 *
 * Manages social media account connections for organic posting
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";

async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_token")?.value || cookieStore.get("auth_token")?.value;

  if (!token) return null;

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

// GET - Retrieve all social accounts
export async function GET() {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const accounts = await prisma.socialAccount.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      accounts: accounts.map(acc => ({
        id: acc.id,
        platform: acc.platform,
        accountId: acc.accountId,
        accountName: acc.accountName,
        accountHandle: acc.accountHandle,
        profileImage: acc.profileImage,
        isActive: acc.isActive,
        lastSyncAt: acc.lastSyncAt,
        createdAt: acc.createdAt,
        // Don't expose tokens in the response
      })),
    });
  } catch (error) {
    console.error("Error fetching social accounts:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// POST - Add or update a social account
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      platform,
      accountId,
      accountName,
      accountHandle,
      profileImage,
      accessToken,
      pageId,
      pageAccessToken,
    } = body;

    // Validate required fields
    if (!platform || !accountId || !accountName || !accessToken) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check if account already exists
    const existing = await prisma.socialAccount.findUnique({
      where: {
        platform_accountId: {
          platform,
          accountId,
        },
      },
    });

    let account;
    if (existing) {
      // Update existing account
      account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          accountName,
          accountHandle,
          profileImage,
          accessToken,
          pageId,
          pageAccessToken,
          isActive: true,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new account
      account = await prisma.socialAccount.create({
        data: {
          platform,
          accountId,
          accountName,
          accountHandle,
          profileImage,
          accessToken,
          pageId,
          pageAccessToken,
          isActive: true,
          lastSyncAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        platform: account.platform,
        accountId: account.accountId,
        accountName: account.accountName,
        accountHandle: account.accountHandle,
        isActive: account.isActive,
      },
      message: existing ? "Account updated successfully" : "Account connected successfully",
    });
  } catch (error) {
    console.error("Error managing social account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to manage account" },
      { status: 500 }
    );
  }
}

// DELETE - Remove a social account
export async function DELETE(request: NextRequest) {
  const admin = await verifyAdmin();
  if (!admin) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("id");

    if (!accountId) {
      return NextResponse.json(
        { success: false, error: "Account ID required" },
        { status: 400 }
      );
    }

    await prisma.socialAccount.delete({
      where: { id: accountId },
    });

    return NextResponse.json({
      success: true,
      message: "Account disconnected successfully",
    });
  } catch (error) {
    console.error("Error deleting social account:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete account" },
      { status: 500 }
    );
  }
}
