import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET - Get all applications for a locksmith
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locksmithId = searchParams.get("locksmithId");
    const status = searchParams.get("status");

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

    // Default: get pending applications
    whereClause.status = "pending";

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

    return NextResponse.json({
      success: true,
      applications: applications.map((app) => ({
        id: app.id,
        jobId: app.jobId,
        assessmentFee: app.assessmentFee,
        eta: app.eta,
        status: app.status,
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
      })),
    });
  } catch (error) {
    console.error("Error fetching locksmith applications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}
