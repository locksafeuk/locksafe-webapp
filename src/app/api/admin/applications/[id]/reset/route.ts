import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getAdmin } from "@/lib/admin-guard";

/**
 * POST /api/admin/applications/[id]/reset
 *
 * Admin-only. Resets a LocksmithApplication to an inactive status, regardless
 * of its current status. Exists because the locksmith `decline` endpoint only
 * works on `admin_assigned` applications, leaving no clean way to clear a stale
 * `accepted`/`pending` application (e.g. one orphaned by the old accept-assign
 * bug). Does NOT notify the customer and does NOT touch the Job — the admin
 * manages the job's status/assignment separately.
 *
 * Body (optional): { status?: "declined" | "withdrawn" | "expired" | "rejected", reason?: string }
 */
const ALLOWED_RESET_STATUSES = ["declined", "withdrawn", "expired", "rejected"];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getAdmin();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const targetStatus =
      typeof body.status === "string" && ALLOWED_RESET_STATUSES.includes(body.status)
        ? body.status
        : "declined";

    const application = await prisma.locksmithApplication.findUnique({
      where: { id },
      select: { id: true, status: true, jobId: true, locksmithId: true },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, error: "Application not found" },
        { status: 404 },
      );
    }

    const updated = await prisma.locksmithApplication.update({
      where: { id },
      data: {
        status: targetStatus,
        message: typeof body.reason === "string" ? body.reason : "Reset by admin",
      },
      select: { id: true, status: true, jobId: true, locksmithId: true },
    });

    console.log(
      `[Admin Application Reset] ${id} ${application.status} -> ${targetStatus} by admin (job ${application.jobId})`,
    );

    return NextResponse.json({
      success: true,
      message: `Application reset from "${application.status}" to "${targetStatus}".`,
      application: updated,
    });
  } catch (error) {
    console.error("[Admin Application Reset] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to reset application" },
      { status: 500 },
    );
  }
}
