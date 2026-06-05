import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { extractUkPostcode, isCoordinatePair, normalizeUkPostcode } from "@/lib/location-display";

// GET /api/admin/jobs - Get all jobs with filtering for admin
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const awaitingSignature = searchParams.get("awaitingSignature");
    const limit = parseInt(searchParams.get("limit") || "100");
    const page = parseInt(searchParams.get("page") || "1");
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (status && status !== "all") {
      if (status === "NO_LOCKSMITH_AVAILABLE") {
        where.status = JobStatus.CANCELLED;
        where.noLocksmithNotifiedAt = { not: null };
      } else {
        where.status = status as JobStatus;
      }
    }

    // Filter for jobs awaiting signature
    if (awaitingSignature === "true") {
      where.status = JobStatus.PENDING_CUSTOMER_CONFIRMATION;
    }

    if (search) {
      where.OR = [
        { jobNumber: { contains: search, mode: "insensitive" } },
        { postcode: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Fetch jobs with relations
    const [jobs, totalCount] = await Promise.all([
      prisma.job.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
            },
          },
          locksmith: {
            select: {
              id: true,
              name: true,
              companyName: true,
              phone: true,
              email: true,
            },
          },
          quote: {
            select: {
              id: true,
              total: true,
              accepted: true,
              acceptedAt: true,
            },
          },
          signature: {
            select: {
              id: true,
              signedAt: true,
              signerName: true,
            },
          },
          payments: {
            select: {
              id: true,
              type: true,
              amount: true,
              status: true,
            },
          },
        },
      }),
      prisma.job.count({ where }),
    ]);

    // Get counts by status for summary
    const statusCounts = await prisma.job.groupBy({
      by: ["status"],
      _count: true,
    });

    // Get jobs awaiting signature count specifically
    const awaitingSignatureCount = await prisma.job.count({
      where: { status: JobStatus.PENDING_CUSTOMER_CONFIRMATION },
    });

    // Get overdue signature jobs (deadline passed)
    const overdueJobs = await prisma.job.count({
      where: {
        status: JobStatus.PENDING_CUSTOMER_CONFIRMATION,
        confirmationDeadline: { lt: new Date() },
      },
    });

    // Jobs where admin/customer was explicitly notified no locksmith is available
    const noLocksmithAvailableCount = await prisma.job.count({
      where: {
        status: JobStatus.CANCELLED,
        noLocksmithNotifiedAt: { not: null },
      },
    });

    return NextResponse.json({
      success: true,
      jobs: jobs.map((job) => ({
        // Always emit postcode-like values; hide any legacy coordinate-string pollution.
        _displayPostcode:
          (job.postcode && !isCoordinatePair(job.postcode)
            ? normalizeUkPostcode(job.postcode)
            : null) ||
          extractUkPostcode(job.address) ||
          "Postcode missing",
        id: job.id,
        jobNumber: job.jobNumber,
        status: job.status,
        problemType: job.problemType,
        propertyType: job.propertyType,
        address: job.address,
        postcode:
          (job.postcode && !isCoordinatePair(job.postcode)
            ? normalizeUkPostcode(job.postcode)
            : null) ||
          extractUkPostcode(job.address) ||
          "Postcode missing",
        assessmentFee: job.assessmentFee,
        assessmentPaid: job.assessmentPaid,
        createdAt: job.createdAt,
        acceptedAt: job.acceptedAt,
        arrivedAt: job.arrivedAt,
        workCompletedAt: job.workCompletedAt,
        signedAt: job.signedAt,
        confirmationDeadline: job.confirmationDeadline,
        confirmationRemindersSent: job.confirmationRemindersSent,
        autoCompletedAt: job.autoCompletedAt,
        noLocksmithNotifiedAt: job.noLocksmithNotifiedAt,
        noLocksmithNotifiedChannels: job.noLocksmithNotifiedChannels,
        customer: job.customer,
        locksmith: job.locksmith,
        quote: job.quote,
        signature: job.signature,
        payments: job.payments,
        totalPaid: job.payments
          .filter((p) => p.status === "succeeded")
          .reduce((sum, p) => sum + p.amount, 0),
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        statusCounts: statusCounts.reduce(
          (acc, s) => ({ ...acc, [s.status]: s._count }),
          {} as Record<string, number>
        ),
        awaitingSignature: awaitingSignatureCount,
        overdueSignature: overdueJobs,
        noLocksmithAvailable: noLocksmithAvailableCount,
      },
    });
  } catch (error) {
    console.error("Error fetching admin jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs" },
      { status: 500 }
    );
  }
}
