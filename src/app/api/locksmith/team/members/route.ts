import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";


async function requireOwner(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as { id: string; type: string };
    if (decoded.type !== "locksmith") return null;

    const company = await prisma.locksmithCompany.findFirst({
      where: { ownerId: decoded.id, isActive: true },
    });
    if (!company) return null;
    return { locksmithId: decoded.id, company };
  } catch {
    return null;
  }
}

// GET /api/locksmith/team/members — list team members (owner only)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized or not a team owner" }, { status: 401 });

    const members = await prisma.locksmithCompanyMember.findMany({
      where: { companyId: auth.company.id, isActive: true },
      include: {
        locksmith: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            totalJobs: true,
            totalEarnings: true,
            rating: true,
            performanceScore: true,
          },
        },
      },
      orderBy: { invitedAt: "asc" },
    });

    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error("GET /api/locksmith/team/members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/locksmith/team/members — invite a locksmith to the team
export async function POST(request: NextRequest) {
  try {
    const auth = await requireOwner(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized or not a team owner" }, { status: 401 });

    const body = await request.json();
    const { locksmithEmail, locksmithSplit, platformCommissionOverride } = body;

    if (!locksmithEmail) {
      return NextResponse.json({ error: "locksmithEmail is required" }, { status: 400 });
    }

    const split = locksmithSplit ?? 70;
    if (split < 0 || split > 100) {
      return NextResponse.json({ error: "locksmithSplit must be between 0 and 100" }, { status: 400 });
    }

    const locksmith = await prisma.locksmith.findUnique({ where: { email: locksmithEmail } });
    if (!locksmith) {
      return NextResponse.json({ error: "No locksmith found with that email" }, { status: 404 });
    }

    // Don't allow owner to add themselves again
    if (locksmith.id === auth.locksmithId) {
      return NextResponse.json({ error: "You are already in this team as owner" }, { status: 409 });
    }

    // Check if already a member
    const existing = await prisma.locksmithCompanyMember.findUnique({
      where: {
        companyId_locksmithId: {
          companyId: auth.company.id,
          locksmithId: locksmith.id,
        },
      },
    });
    if (existing?.isActive) {
      return NextResponse.json({ error: "Locksmith is already a member of this team" }, { status: 409 });
    }

    // Re-activate if previously removed
    let membership;
    if (existing) {
      membership = await prisma.locksmithCompanyMember.update({
        where: { id: existing.id },
        data: {
          isActive: true,
          locksmithSplit: split,
          platformCommissionOverride: platformCommissionOverride ?? null,
          invitedAt: new Date(),
          acceptedAt: null, // Requires acceptance (or set to new Date() for instant)
        },
        include: { locksmith: { select: { id: true, name: true, email: true } } },
      });
    } else {
      membership = await prisma.locksmithCompanyMember.create({
        data: {
          companyId: auth.company.id,
          locksmithId: locksmith.id,
          locksmithSplit: split,
          platformCommissionOverride: platformCommissionOverride ?? null,
          role: "member",
          isActive: true,
          acceptedAt: new Date(),
        },
        include: { locksmith: { select: { id: true, name: true, email: true } } },
      });
    }

    // Update locksmith teamRole
    if (locksmith.teamRole === "solo") {
      await prisma.locksmith.update({
        where: { id: locksmith.id },
        data: { teamRole: "member" },
      });
    }

    return NextResponse.json({ success: true, membership }, { status: 201 });
  } catch (error) {
    console.error("POST /api/locksmith/team/members error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
