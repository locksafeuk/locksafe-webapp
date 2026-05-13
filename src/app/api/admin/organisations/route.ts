import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin-secret";

function verifyAdminAuth(request: NextRequest): boolean {
  const auth = request.headers.get("authorization");
  const token = auth?.replace("Bearer ", "");
  return token === ADMIN_SECRET;
}

/**
 * GET /api/admin/organisations
 * Lists all organisations with member + job counts.
 *
 * POST /api/admin/organisations
 * Creates a new organisation.
 */

export async function GET(request: NextRequest) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgs = await prisma.organisation.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { members: true, properties: true, jobs: true },
      },
    },
  });

  return NextResponse.json({ organisations: orgs });
}

export async function POST(request: NextRequest) {
  if (!verifyAdminAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, type, contactName, contactEmail, contactPhone, contractedRate, paymentTerms, vatNumber, billingEmail } = body;

  if (!name || !contactEmail || !contactPhone) {
    return NextResponse.json({ error: "name, contactEmail and contactPhone are required" }, { status: 400 });
  }

  const org = await prisma.organisation.create({
    data: {
      name,
      type: type ?? "landlord",
      contactName: contactName ?? name,
      contactEmail,
      contactPhone,
      contractedRate: contractedRate ? Number(contractedRate) : null,
      paymentTerms: paymentTerms ? Number(paymentTerms) : 30,
      vatNumber: vatNumber ?? null,
      billingEmail: billingEmail ?? null,
    },
  });

  return NextResponse.json({ organisation: org }, { status: 201 });
}
