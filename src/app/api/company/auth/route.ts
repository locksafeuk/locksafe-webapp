import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "locksafe-secret-key-change-in-production";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    let decoded: { id: string; type: string };
    try {
      decoded = jwt.verify(token, JWT_SECRET) as { id: string; type: string };
    } catch {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Admin impersonating a company — companyId comes from query param
    if (decoded.type === "admin") {
      const { searchParams } = new URL(request.url);
      const companyId = searchParams.get("companyId");
      if (!companyId) {
        return NextResponse.json({ authenticated: false, error: "companyId required for admin access" }, { status: 400 });
      }
      const company = await prisma.locksmithCompany.findUnique({
        where: { id: companyId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          memberships: {
            where: { isActive: true },
            include: { locksmith: { select: { id: true, name: true, email: true } } },
          },
        },
      });
      if (!company) return NextResponse.json({ authenticated: false }, { status: 404 });
      return NextResponse.json({
        authenticated: true,
        role: "admin",
        company,
        isAdminImpersonating: true,
      });
    }

    // Locksmith manager / member
    if (decoded.type === "locksmith") {
      // First: are they the owner of a company?
      const ownedCompany = await prisma.locksmithCompany.findFirst({
        where: { ownerId: decoded.id, isActive: true },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          memberships: {
            where: { isActive: true },
            include: { locksmith: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      if (ownedCompany) {
        return NextResponse.json({
          authenticated: true,
          role: "owner",
          company: ownedCompany,
          isAdminImpersonating: false,
        });
      }

      return NextResponse.json({
        authenticated: false,
        error: "No company found for this account",
      }, { status: 403 });
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch (error) {
    console.error("GET /api/company/auth error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
