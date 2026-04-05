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

    return NextResponse.json({
      authenticated: true,
      user: {
        id: session.id,
        email: session.email,
        name: session.name,
        type: session.type,
        onboardingCompleted,
        ...(session.type === "admin" && { role: (session as { role: string }).role }),
        ...(session.type === "locksmith" && { companyName: (session as { companyName: string | null }).companyName }),
        ...(session.type === "customer" && { phone: (session as { phone: string }).phone }),
      },
      redirectTo: getRedirectPath(session.type),
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
