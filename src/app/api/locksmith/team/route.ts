import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";
import { getJwtSecret } from "@/lib/auth";


async function requireLocksmith(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ["HS256"] }) as { id: string; type: string };
    if (decoded.type !== "locksmith") return null;
    return decoded;
  } catch {
    return null;
  }
}

// GET /api/locksmith/team — get the team this locksmith owns (or is a member of)
export async function GET(request: NextRequest) {
  try {
    const auth = await requireLocksmith(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // First check if they own a company
    const ownedCompany = await prisma.locksmithCompany.findFirst({
      where: { ownerId: auth.id, isActive: true },
      include: {
        memberships: {
          where: { isActive: true },
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
        },
      },
    });

    if (ownedCompany) {
      return NextResponse.json({ success: true, role: "owner", company: ownedCompany });
    }

    // Otherwise check if they're a member of a team
    const membership = await prisma.locksmithCompanyMember.findFirst({
      where: { locksmithId: auth.id, isActive: true },
      include: {
        company: {
          include: {
            owner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (membership) {
      return NextResponse.json({
        success: true,
        role: membership.role,
        company: membership.company,
        myMembership: {
          locksmithSplit: membership.locksmithSplit,
          platformCommissionOverride: membership.platformCommissionOverride,
        },
      });
    }

    return NextResponse.json({ success: true, role: "solo", company: null });
  } catch (error) {
    console.error("GET /api/locksmith/team error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/locksmith/team — create a new team (locksmith becomes owner)
export async function POST(request: NextRequest) {
  try {
    const auth = await requireLocksmith(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Check they don't already own a team
    const existing = await prisma.locksmithCompany.findFirst({
      where: { ownerId: auth.id, isActive: true },
    });
    if (existing) {
      return NextResponse.json({ error: "You already own a team" }, { status: 409 });
    }

    const locksmith = await prisma.locksmith.findUnique({ where: { id: auth.id } });
    if (!locksmith) return NextResponse.json({ error: "Locksmith not found" }, { status: 404 });

    const body = await request.json();
    const { name, contactPhone, billingEmail, vatNumber, registrationNumber } = body;

    if (!name || !contactPhone) {
      return NextResponse.json({ error: "name and contactPhone are required" }, { status: 400 });
    }

    const company = await prisma.locksmithCompany.create({
      data: {
        name,
        contactEmail: locksmith.email,
        contactPhone,
        ownerId: auth.id,
        billingEmail: billingEmail || locksmith.email,
        vatNumber: vatNumber || null,
        registrationNumber: registrationNumber || null,
        memberships: {
          create: {
            locksmithId: auth.id,
            role: "owner",
            locksmithSplit: 100,
            acceptedAt: new Date(),
          },
        },
      },
      include: {
        memberships: {
          include: { locksmith: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    await prisma.locksmith.update({
      where: { id: auth.id },
      data: { teamRole: "owner" },
    });

    return NextResponse.json({ success: true, company }, { status: 201 });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A team with that email already exists" }, { status: 409 });
    }
    console.error("POST /api/locksmith/team error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/locksmith/team — update own team (owner only)
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireLocksmith(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const company = await prisma.locksmithCompany.findFirst({
      where: { ownerId: auth.id, isActive: true },
    });
    if (!company) return NextResponse.json({ error: "No team found or not the owner" }, { status: 403 });

    const body = await request.json();
    const { name, contactPhone, billingEmail, vatNumber, registrationNumber, notes } = body;

    const updated = await prisma.locksmithCompany.update({
      where: { id: company.id },
      data: {
        ...(name !== undefined && { name }),
        ...(contactPhone !== undefined && { contactPhone }),
        ...(billingEmail !== undefined && { billingEmail }),
        ...(vatNumber !== undefined && { vatNumber }),
        ...(registrationNumber !== undefined && { registrationNumber }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ success: true, company: updated });
  } catch (error) {
    console.error("PATCH /api/locksmith/team error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
