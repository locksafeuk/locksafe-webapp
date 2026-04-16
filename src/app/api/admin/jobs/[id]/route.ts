import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";
import { verifyToken } from "@/lib/auth";

// Verify admin session
async function verifyAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;

  if (!token) {
    return null;
  }

  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") {
    return null;
  }

  return payload;
}

// GET /api/admin/jobs/[id] - Get a single job (admin)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        locksmith: true,
        quote: true,
        signature: true,
        payments: true,
        photos: true,
        review: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    });
  } catch (error) {
    console.error("Error fetching job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch job" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/jobs/[id] - Delete a job (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await verifyAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Find the job
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        payments: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    // Check if there are any successful payments - warn admin
    const successfulPayments = job.payments.filter(p => p.status === "succeeded");
    if (successfulPayments.length > 0) {
      console.warn(`[Admin Delete Job] Warning: Deleting job ${job.jobNumber} with ${successfulPayments.length} successful payment(s)`);
    }

    // Delete all related records in a transaction
    await prisma.$transaction([
      // Delete report
      prisma.report.deleteMany({
        where: { jobId: id },
      }),
      // Delete photos
      prisma.photo.deleteMany({
        where: { jobId: id },
      }),
      // Delete quote
      prisma.quote.deleteMany({
        where: { jobId: id },
      }),
      // Delete signature
      prisma.signature.deleteMany({
        where: { jobId: id },
      }),
      // Delete payments
      prisma.payment.deleteMany({
        where: { jobId: id },
      }),
      // Delete locksmith applications
      prisma.locksmithApplication.deleteMany({
        where: { jobId: id },
      }),
      // Delete review
      prisma.review.deleteMany({
        where: { jobId: id },
      }),
      // Delete notifications related to this job
      prisma.notification.deleteMany({
        where: { jobId: id },
      }),
      // Delete the job
      prisma.job.delete({
        where: { id },
      }),
    ]);

    console.log(`[Admin Delete Job] Job ${job.jobNumber} deleted by admin`);

    return NextResponse.json({
      success: true,
      message: `Job ${job.jobNumber} deleted successfully`,
    });
  } catch (error) {
    console.error("Error deleting job:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete job" },
      { status: 500 }
    );
  }
}
