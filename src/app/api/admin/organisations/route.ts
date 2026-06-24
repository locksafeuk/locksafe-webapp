import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

// Cookie-based admin auth (matches the rest of the admin API + the dashboard's
// httpOnly cookie). Previously this route only accepted a `Bearer ADMIN_SECRET`
// header that the dashboard never sent, so the org page silently 401'd.
async function verifyAdminAuth(): Promise<boolean> {
  return (await isAdminAuthenticated()) !== null;
}

/**
 * GET /api/admin/organisations
 * Lists all organisations with member + job counts.
 *
 * POST /api/admin/organisations
 * Creates a new organisation.
 */

export async function GET() {
  if (!(await verifyAdminAuth())) {
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
  if (!(await verifyAdminAuth())) {
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
