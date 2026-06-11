import { NextResponse } from "next/server";
import { getServerSession, getRedirectPath } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await getServerSession();

    if (!session) {
      return NextResponse.json({ authenticated: false });
    }

    // Fetch profile data from database
    let onboardingCompleted = true; // Default to true for admins
    let locksmithProfile: Record<string, unknown> | null = null;

    if (session.type === "customer") {
      const customer = await prisma.customer.findUnique({
        where: { id: session.id },
        select: { onboardingCompleted: true, termsAcceptedAt: true },
      });
      onboardingCompleted = customer?.onboardingCompleted ?? false;
    } else if (session.type === "locksmith") {
      // Fetch the full locksmith profile so the mobile app's authStore stays
      // up to date after app restarts — phone, Stripe status, isVerified, etc.
      // Without this, checkSession() would overwrite the cached user with a
      // bare skeleton (id/name/email only), stripping all profile fields.
      const locksmith = await prisma.locksmith.findUnique({
        where: { id: session.id },
        select: {
          onboardingCompleted: true,
          termsAcceptedAt: true,
          phone: true,
          companyName: true,
          isVerified: true,
          isActive: true,
          isAvailable: true,
          rating: true,
          totalJobs: true,
          totalEarnings: true,
          stripeConnectOnboarded: true,
          stripeConnectVerified: true,
          stripeConnectId: true,
          coverageAreas: true,
          coverageRadius: true,
          services: true,
          yearsExperience: true,
          baseLat: true,
          baseLng: true,
          baseAddress: true,
          defaultAssessmentFee: true,
          licenseNumber: true,
          insuranceNumber: true,
          profileImage: true,
          smsNotifications: true,
          emailNotifications: true,
          pushNotifications: true,
          scheduleEnabled: true,
          scheduleTimezone: true,
          scheduleStartTime: true,
          scheduleEndTime: true,
          scheduleDays: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      onboardingCompleted = locksmith?.onboardingCompleted ?? false;
      if (locksmith) {
        locksmithProfile = locksmith as unknown as Record<string, unknown>;
      }
    }

    // Sanitize string fields (trim whitespace) for extra safety
    // This handles edge cases like old tokens created before sanitization was added
    const sanitizedName = session.name?.trim() || "";
    const sanitizedEmail = session.email?.trim().toLowerCase() || "";

    // Build the user payload. For locksmiths, merge the full DB profile so that
    // the mobile authStore stays complete after app-restart session revalidation.
    // name/email/type come from the JWT session (already sanitized above).
    const locksmithExtra =
      session.type === "locksmith" && locksmithProfile
        ? {
            ...locksmithProfile,
            companyName: (locksmithProfile.companyName as string | null)?.trim() || null,
            phone: (locksmithProfile.phone as string | null)?.trim() || null,
          }
        : session.type === "locksmith"
        ? { companyName: (session as { companyName: string | null }).companyName?.trim() || null }
        : {};

    return NextResponse.json({
      authenticated: true,
      user: {
        // Core fields from JWT (always present, always sanitized)
        id: session.id,
        email: sanitizedEmail,
        name: sanitizedName,
        type: session.type,
        onboardingCompleted,
        // Role-specific extras
        ...(session.type === "admin" && { role: (session as { role: string }).role }),
        ...locksmithExtra,
        ...(session.type === "customer" && { phone: (session as { phone: string }).phone?.trim() || "" }),
      },
      redirectTo: getRedirectPath(session.type),
    });
  } catch (error) {
    console.error("Session check error:", error);
    return NextResponse.json({ authenticated: false });
  }
}
