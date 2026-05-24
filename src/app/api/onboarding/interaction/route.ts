import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

function isAllowedNextUrl(value: string): boolean {
  return value.startsWith("https://connect.stripe.com/") || value.startsWith("https://dashboard.stripe.com/");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const locksmithId = searchParams.get("locksmithId")?.trim();
  const next = searchParams.get("next")?.trim();

  if (!locksmithId || !next || !isAllowedNextUrl(next)) {
    return NextResponse.redirect(new URL("/locksmith/login", request.url));
  }

  try {
    await prisma.locksmith.update({
      where: { id: locksmithId },
      data: { onboardingLastInteractionAt: new Date() },
      select: { id: true },
    });
  } catch {
    // Non-blocking: we still redirect to Stripe onboarding flow.
  }

  return NextResponse.redirect(next);
}
