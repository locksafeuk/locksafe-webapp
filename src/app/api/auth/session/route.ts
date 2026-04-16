import { NextResponse } from "next/server";
import { getServerSession, getRedirectPath } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    // Fetch onboarding status from database
    let onboardingCompleted = true; // Default to true for admins

    if (session.type === "customer") {
      const customer = await prisma.customer.findUnique({
        where: { id: session.id },
        select: { onboardingCompleted: true, termsAcceptedAt: true },
      });
      onboardingCompleted = customer?.onboardingCompleted ?? false;
    } else if (session.type === "locksmith") {
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: session.id },
        select: { onboardingCompleted: true, termsAcceptedAt: true },
      });
      onboardingCompleted = locksmith?.onboardingCompleted ?? false;
    }

    // Sanitize string fields (trim whitespace) for extra safety
    // This handles edge cases like old tokens created before sanitization was added
    const sanitizedName = session.name?.trim() || "";
    const sanitizedEmail = session.email?.trim().toLowerCase() || "";

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        email: sanitizedEmail,
        name: sanitizedName,
        type: session.type,
        onboardingCompleted,
        ...(session.type === "admin" && { role: (session as { role: string }).role }),
        ...(session.type === "locksmith" && { companyName: (session as { companyName: string | null }).companyName?.trim() || null }),
        ...(session.type === "customer" && { phone: (session as { phone: string }).phone?.trim() || "" }),
      },
      redirectTo: getRedirectPath(session.type),
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
