import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendLocksmithVerifiedEmail } from "@/lib/email";

// GET /api/locksmiths/[id] - Get locksmith public profile with reviews
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const locksmith = await prisma.locksmith.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        companyName: true,
        profileImage: true,
        rating: true,
        totalJobs: true,
        isVerified: true,
        yearsExperience: true,
        services: true,
        coverageAreas: true,
        createdAt: true,
        reviews: {
          where: { isPublic: true },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            customer: {
              select: {
                name: true,
              },
            },
            job: {
              select: {
                jobNumber: true,
                problemType: true,
                postcode: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Calculate rating breakdown
    const allReviews = await prisma.review.findMany({
      where: { locksmithId: id, isPublic: true },
      select: { rating: true },
    });

    const ratingBreakdown = {
      5: 0,
      4: 0,
      3: 0,
      2: 0,
      1: 0,
    };

    for (const review of allReviews) {
      if (review.rating >= 1 && review.rating <= 5) {
        ratingBreakdown[review.rating as keyof typeof ratingBreakdown]++;
      }
    }

    // Get response time stats (average ETA from accepted applications)
    const applications = await prisma.locksmithApplication.findMany({
      where: {
        locksmithId: id,
        status: "accepted",
      },
      select: {
        eta: true,
      },
    });

    const avgResponseTime = applications.length > 0
      ? Math.round(applications.reduce((acc, app) => acc + app.eta, 0) / applications.length)
      : 30;

    // Format response
    const profile = {
      id: locksmith.id,
      name: locksmith.name,
      company: locksmith.companyName,
      avatar: locksmith.profileImage || locksmith.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2),
      rating: locksmith.rating,
      reviewCount: locksmith._count.reviews,
      totalJobs: locksmith.totalJobs,
      verified: locksmith.isVerified,
      yearsExperience: locksmith.yearsExperience,
      services: locksmith.services,
      coverageAreas: locksmith.coverageAreas.slice(0, 10), // First 10 postcodes
      memberSince: locksmith.createdAt,
      avgResponseTime,
      ratingBreakdown,
      reviews: locksmith.reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        customerName: review.customer.name,
        jobType: review.job.problemType,
        location: review.job.postcode.split(" ")[0], // First part of postcode
      })),
    };

    return NextResponse.json({
      success: true,
      profile,
    });
  } catch (error) {
    console.error("Error fetching locksmith profile:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

// PATCH /api/locksmiths/[id] - Update locksmith (admin actions)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, ...updateData } = body;

    // Find the locksmith
    const locksmith = await prisma.locksmith.findUnique({
      where: { id },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Handle different admin actions
    if (action === "verify") {
      const updated = await prisma.locksmith.update({
        where: { id },
        data: { isVerified: true },
      });

      // Send verification email to locksmith (non-blocking)
      sendLocksmithVerifiedEmail(updated.email, {
        locksmithName: updated.name,
        companyName: updated.companyName,
      }).catch((err) => {
        console.error("Failed to send verification email:", err);
      });

      return NextResponse.json({
        success: true,
        message: "Locksmith verified successfully",
        locksmith: {
          id: updated.id,
          name: updated.name,
          isVerified: updated.isVerified,
        },
      });
    }

    if (action === "unverify") {
      const updated = await prisma.locksmith.update({
        where: { id },
        data: { isVerified: false },
      });

      return NextResponse.json({
        success: true,
        message: "Locksmith verification removed",
        locksmith: {
          id: updated.id,
          name: updated.name,
          isVerified: updated.isVerified,
        },
      });
    }

    if (action === "suspend") {
      const updated = await prisma.locksmith.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        message: "Locksmith suspended",
        locksmith: {
          id: updated.id,
          name: updated.name,
          isActive: updated.isActive,
        },
      });
    }

    if (action === "activate") {
      const updated = await prisma.locksmith.update({
        where: { id },
        data: { isActive: true },
      });

      return NextResponse.json({
        success: true,
        message: "Locksmith activated",
        locksmith: {
          id: updated.id,
          name: updated.name,
          isActive: updated.isActive,
        },
      });
    }

    // General update (for other fields)
    const allowedFields = ['name', 'companyName', 'phone', 'email', 'yearsExperience', 'coverageAreas', 'services', 'profileImage'];
    const filteredData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    if (Object.keys(filteredData).length > 0) {
      const updated = await prisma.locksmith.update({
        where: { id },
        data: filteredData,
      });

      return NextResponse.json({
        success: true,
        message: "Locksmith updated successfully",
        locksmith: updated,
      });
    }

    return NextResponse.json(
      { success: false, error: "No valid action or update data provided" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error updating locksmith:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update locksmith" },
      { status: 500 }
    );
  }
}

// DELETE /api/locksmiths/[id] - Delete a locksmith (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Find the locksmith with related data counts
    const locksmith = await prisma.locksmith.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            jobs: true,
            quotes: true,
            applications: true,
            payouts: true,
            reviews: true,
          },
        },
      },
    });

    if (!locksmith) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

    // Log deletion info for audit
    console.log(`[Admin Delete Locksmith] Deleting locksmith ${locksmith.name} (${locksmith.id}) with:`, {
      jobs: locksmith._count.jobs,
      quotes: locksmith._count.quotes,
      applications: locksmith._count.applications,
      payouts: locksmith._count.payouts,
      reviews: locksmith._count.reviews,
    });

    // Get all job IDs for this locksmith to cascade delete job-related records
    const locksmithJobs = await prisma.job.findMany({
      where: { locksmithId: id },
      select: { id: true, jobNumber: true },
    });
    const jobIds = locksmithJobs.map((j) => j.id);

    // Delete all related records in a transaction with proper order
    await prisma.$transaction([
      // First, delete job-related records for all jobs assigned to this locksmith
      // Delete reports
      prisma.report.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Delete photos
      prisma.photo.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Delete signatures
      prisma.signature.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Delete payments
      prisma.payment.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Delete reviews for these jobs
      prisma.review.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Delete all locksmith applications for these jobs (from any locksmith)
      prisma.locksmithApplication.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Delete quotes for these jobs
      prisma.quote.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Now delete the jobs themselves
      prisma.job.deleteMany({
        where: { locksmithId: id },
      }),
      // Delete locksmith's own applications (to other jobs)
      prisma.locksmithApplication.deleteMany({
        where: { locksmithId: id },
      }),
      // Delete locksmith's quotes (already deleted above if job was theirs, but this catches any orphaned)
      prisma.quote.deleteMany({
        where: { locksmithId: id },
      }),
      // Delete payout records
      prisma.payout.deleteMany({
        where: { locksmithId: id },
      }),
      // Delete reviews written about this locksmith
      prisma.review.deleteMany({
        where: { locksmithId: id },
      }),
      // Delete notifications for this locksmith
      prisma.notification.deleteMany({
        where: { locksmithId: id },
      }),
      // Finally, delete the locksmith
      prisma.locksmith.delete({
        where: { id },
      }),
    ]);

    console.log(`[Admin Delete Locksmith] Successfully deleted locksmith ${locksmith.name} and ${jobIds.length} associated job(s)`);

    return NextResponse.json({
      success: true,
      message: `Locksmith "${locksmith.name}" and ${locksmith._count.jobs} associated job(s) deleted successfully`,
      deletedJobs: locksmithJobs.map((j) => j.jobNumber),
    });
  } catch (error) {
    console.error("Error deleting locksmith:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete locksmith" },
      { status: 500 }
    );
  }
}
