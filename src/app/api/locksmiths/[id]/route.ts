import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendLocksmithVerifiedEmail } from "@/lib/email";
import { isInUkOrIreland } from "@/lib/geo-guard";
import {
  extractUkPostcode,
  isCoordinatePair,
  normalizeUkPostcode,
  reverseGeocodePostcodeFromCoords,
} from "@/lib/location-display";

// GET /api/locksmiths/[id] - Get locksmith public profile with reviews
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate MongoDB ObjectId format before querying
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return NextResponse.json(
        { success: false, error: "Locksmith not found" },
        { status: 404 }
      );
    }

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
    const allowedFields = ['name', 'companyName', 'phone', 'email', 'yearsExperience', 'coverageAreas', 'services', 'profileImage', 'coverageRadius', 'baseAddress', 'baseLat', 'baseLng'];
    const filteredData: Record<string, unknown> = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field];
      }
    }

    // If base location is being changed, enforce UK + Ireland restriction
    if (filteredData.baseLat !== undefined || filteredData.baseLng !== undefined) {
      const newLat = Number(filteredData.baseLat ?? updateData.baseLat);
      const newLng = Number(filteredData.baseLng ?? updateData.baseLng);
      if (Number.isFinite(newLat) && Number.isFinite(newLng)) {
        const geoCheck = await isInUkOrIreland(newLat, newLng);
        if (!geoCheck.ok) {
          return NextResponse.json(
            { success: false, error: geoCheck.reason ?? "Location not supported" },
            { status: 400 }
          );
        }
      }
    }

    if (filteredData.baseAddress !== undefined || filteredData.baseLat !== undefined || filteredData.baseLng !== undefined) {
      const rawBaseAddress = typeof filteredData.baseAddress === "string"
        ? filteredData.baseAddress
        : typeof updateData.baseAddress === "string"
          ? updateData.baseAddress
          : "";

      const lat = Number(filteredData.baseLat ?? updateData.baseLat ?? locksmith.baseLat);
      const lng = Number(filteredData.baseLng ?? updateData.baseLng ?? locksmith.baseLng);

      const extractedPostcode = normalizeUkPostcode(rawBaseAddress) ?? extractUkPostcode(rawBaseAddress);
      const reversePostcode = extractedPostcode
        ? extractedPostcode
        : await reverseGeocodePostcodeFromCoords(lat, lng);

      const cleanedBaseAddress = rawBaseAddress.trim();
      filteredData.baseAddress = reversePostcode
        ? reversePostcode
        : cleanedBaseAddress && !isCoordinatePair(cleanedBaseAddress)
          ? cleanedBaseAddress
          : null;
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

    // Some relations (team ownership/membership, reminder logs, auction acceptance)
    // are not tied directly to Job and must be cleaned up explicitly before deleting.
    const companyLinks = await prisma.locksmithCompanyMember.count({
      where: { locksmithId: id },
    });
    const ownedCompanies = await prisma.locksmithCompany.count({
      where: { ownerId: id },
    });
    const reminderLogs = await prisma.stripeReminderLog.count({
      where: { locksmithId: id },
    });

    // Delete all related records in a transaction with proper order
    await prisma.$transaction([
      // Detach optional ownership refs first so parent deletion cannot violate relations
      prisma.locksmithCompany.updateMany({
        where: { ownerId: id },
        data: { ownerId: null },
      }),
      prisma.jobAuction.updateMany({
        where: { acceptedByLocksmithId: id },
        data: { acceptedByLocksmithId: null },
      }),

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
      // Delete in-platform job chat messages
      prisma.jobMessage.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Delete auctions for locksmith-owned jobs
      prisma.jobAuction.deleteMany({
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
      // Delete email campaign recipient records scoped to this locksmith
      prisma.emailRecipient.deleteMany({
        where: { locksmithId: id },
      }),
      // Delete team memberships and reminder logs that reference this locksmith
      prisma.locksmithCompanyMember.deleteMany({
        where: { locksmithId: id },
      }),
      prisma.stripeReminderLog.deleteMany({
        where: { locksmithId: id },
      }),
      // Finally, delete the locksmith
      prisma.locksmith.delete({
        where: { id },
      }),
    ]);

    console.log(`[Admin Delete Locksmith] Successfully deleted locksmith ${locksmith.name} and ${jobIds.length} associated job(s)`, {
      companyLinks,
      ownedCompanies,
      reminderLogs,
    });

    return NextResponse.json({
      success: true,
      message: `Locksmith "${locksmith.name}" and ${locksmith._count.jobs} associated job(s) deleted successfully`,
      deletedJobs: locksmithJobs.map((j) => j.jobNumber),
    });
  } catch (error: any) {
    console.error("Error deleting locksmith:", {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete locksmith",
        ...(error?.code ? { code: error.code } : {}),
        ...(process.env.NODE_ENV !== "production"
          ? {
              detail: error?.message,
            }
          : {}),
      },
      { status: 500 }
    );
  }
}
