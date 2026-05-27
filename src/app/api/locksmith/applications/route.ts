import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getApplicationSourceType, getJobSourceLabel, sourceMatchesFilter, type JobSourceFilter } from "@/lib/job-source";

const ACTIVE_APPLICATION_JOB_STATUSES = ["PENDING", "PHONE_INITIATED"] as const;

// GET - Get all applications for a locksmith
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locksmithId = searchParams.get("locksmithId");
    const status = searchParams.get("status");
    const sourceTypeParam = searchParams.get("sourceType");

    const sourceFilter: JobSourceFilter =
      sourceTypeParam === "auto" || sourceTypeParam === "normal"
        ? sourceTypeParam
        : "all";

    if (!locksmithId) {
      return NextResponse.json(
        { success: false, error: "locksmithId is required" },
        { status: 400 }
      );
    }

    // Build where clause based on status
    const whereClause: any = {
      locksmithId,
    };

    if (status === "accepted") {
      // For notifications - get recently accepted applications (last 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      whereClause.status = "accepted";
      whereClause.updatedAt = { gte: fiveMinutesAgo };

      const acceptedApplications = await prisma.locksmithApplication.findMany({
        where: whereClause,
        include: {
          job: {
            include: {
              customer: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      return NextResponse.json({
        success: true,
        acceptedApplications: acceptedApplications.map((app) => ({
          id: app.id,
          jobId: app.jobId,
          assessmentFee: app.assessmentFee,
          eta: app.eta,
          status: app.status,
          acceptedAt: app.updatedAt.toISOString(),
          job: {
            jobNumber: app.job.jobNumber,
            problemType: app.job.problemType,
            postcode: app.job.postcode,
            address: app.job.address,
            customer: {
              name: app.job.customer.name,
            },
          },
        })),
      });
    }

    // Default: get pending and admin-assigned applications for jobs that are still open.
    // This prevents stale cards from showing after a job is cancelled or moved forward.
    whereClause.status = { in: ["pending", "admin_assigned"] };
    whereClause.job = {
      status: { in: [...ACTIVE_APPLICATION_JOB_STATUSES] },
    };

    const applications = await prisma.locksmithApplication.findMany({
      where: whereClause,
      include: {
        job: {
          include: {
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const filteredApplications = applications.filter((app) => {
      const sourceType = getApplicationSourceType({
        status: app.status,
        message: app.message,
        jobCreatedVia: app.job.createdVia,
      });
      return sourceMatchesFilter(sourceType, sourceFilter);
    });

    return NextResponse.json({
      success: true,
      applications: filteredApplications.map((app) => {
        const sourceType = getApplicationSourceType({
          status: app.status,
          message: app.message,
          jobCreatedVia: app.job.createdVia,
        });

        return {
          id: app.id,
          jobId: app.jobId,
          assessmentFee: app.assessmentFee,
          eta: app.eta,
          status: app.status,
          sourceType,
          sourceLabel: getJobSourceLabel(sourceType),
          appliedAt: app.createdAt.toISOString(),
          job: {
            jobNumber: app.job.jobNumber,
            problemType: app.job.problemType,
            postcode: app.job.postcode,
            address: app.job.address,
            customer: {
              name: app.job.customer.name,
            },
          },
        };
      }),
    });
  } catch (error) {
    console.error("Error fetching locksmith applications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}
