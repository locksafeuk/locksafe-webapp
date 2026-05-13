import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

async function requireOwner(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; type: string };
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

// PATCH /api/locksmith/team/members/[memberId] — update commission split for a member
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireOwner(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized or not a team owner" }, { status: 401 });

    const { memberId } = await params;
    const body = await request.json();
    const { locksmithSplit, platformCommissionOverride } = body;

    if (locksmithSplit !== undefined && (locksmithSplit < 0 || locksmithSplit > 100)) {
      return NextResponse.json({ error: "locksmithSplit must be between 0 and 100" }, { status: 400 });
    }

    // Verify the membership belongs to the owner's company
    const existing = await prisma.locksmithCompanyMember.findUnique({ where: { id: memberId } });
    if (!existing || existing.companyId !== auth.company.id) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    // Prevent changing own (owner) split to < 100 via this endpoint
    if (existing.locksmithId === auth.locksmithId && locksmithSplit !== undefined && locksmithSplit < 100) {
      return NextResponse.json(
        { error: "Owner's own split is always 100%. Manage your team members instead." },
        { status: 400 }
      );
    }

    const membership = await prisma.locksmithCompanyMember.update({
      where: { id: memberId },
      data: {
        ...(locksmithSplit !== undefined && { locksmithSplit }),
        ...(platformCommissionOverride !== undefined && { platformCommissionOverride }),
      },
      include: {
        locksmith: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ success: true, membership });
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    console.error("PATCH /api/locksmith/team/members/[memberId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/locksmith/team/members/[memberId] — remove a member from the team
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ memberId: string }> }
) {
  try {
    const auth = await requireOwner(request);
    if (!auth) return NextResponse.json({ error: "Unauthorized or not a team owner" }, { status: 401 });

    const { memberId } = await params;
    const existing = await prisma.locksmithCompanyMember.findUnique({ where: { id: memberId } });

    if (!existing || existing.companyId !== auth.company.id) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }

    if (existing.locksmithId === auth.locksmithId) {
      return NextResponse.json({ error: "Owner cannot remove themselves" }, { status: 400 });
    }

    await prisma.locksmithCompanyMember.update({
      where: { id: memberId },
      data: { isActive: false },
    });

    // Reset teamRole if no other active memberships
    const remaining = await prisma.locksmithCompanyMember.count({
      where: { locksmithId: existing.locksmithId, isActive: true },
    });
    if (remaining === 0) {
      await prisma.locksmith.update({
        where: { id: existing.locksmithId },
        data: { teamRole: "solo" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/locksmith/team/members/[memberId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
