/**
 * Agent API: Jobs Endpoint
 *
 * GET /api/agent/jobs - List jobs with filters
 *
 * Query params:
 * - status: Filter by status (PENDING, ACCEPTED, COMPLETED, etc.)
 * - date: Filter by date (today, yesterday, week, month)
 * - locksmithId: Filter by assigned locksmith
 * - customerId: Filter by customer
 * - limit: Number of results (default 20, max 100)
 * - skip: Pagination offset
 */

import { verifyApiKey } from "@/lib/agent-auth";
import prisma from "@/lib/db";
import { JobStatus } from "@prisma/client";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Verify authentication
  const auth = verifyApiKey(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const status = searchParams.get("status");
    const date = searchParams.get("date");
    const locksmithId = searchParams.get("locksmithId");
    const customerId = searchParams.get("customerId");
    const postcode = searchParams.get("postcode");
    const limit = Math.min(
      Number.parseInt(searchParams.get("limit") || "20"),
      100,
    );
    const skip = Number.parseInt(searchParams.get("skip") || "0");

    // Build where clause
    // biome-ignore lint/suspicious/noExplicitAny: dynamic query building
    const where: any = {};

    // Status filter
    if (status) {
      const validStatuses = Object.values(JobStatus);
      if (validStatuses.includes(status as JobStatus)) {
        where.status = status;
      } else if (status === "active") {
        // Active = not cancelled and not completed
        where.status = {
          notIn: [JobStatus.CANCELLED, JobStatus.SIGNED],
        };
      } else if (status === "urgent") {
        // Urgent = pending for more than 30 minutes
        where.status = JobStatus.PENDING;
        where.createdAt = {
          lte: new Date(Date.now() - 30 * 60 * 1000),
        };
      }
    }

    // Date filter
    if (date) {
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      );

      if (date === "today") {
        where.createdAt = { gte: startOfToday };
      } else if (date === "yesterday") {
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        where.createdAt = { gte: startOfYesterday, lt: startOfToday };
      } else if (date === "week") {
        const startOfWeek = new Date(startOfToday);
        startOfWeek.setDate(startOfWeek.getDate() - 7);
        where.createdAt = { gte: startOfWeek };
      } else if (date === "month") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        where.createdAt = { gte: startOfMonth };
      }
    }

    // Locksmith filter
    if (locksmithId) {
      where.locksmithId = locksmithId;
    }

    // Customer filter
    if (customerId) {
      where.customerId = customerId;
    }

    // Postcode filter (partial match)
    if (postcode) {
      where.postcode = {
        startsWith: postcode.toUpperCase().replace(/\s+/g, "").slice(0, 4),
        mode: "insensitive",
      };
    }

    // Fetch jobs with relations
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
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
              rating: true,
            },
          },
          quote: {
            select: {
              total: true,
              accepted: true,
              labourCost: true,
              partsTotal: true,
            },
          },
          applications: {
            select: {
              id: true,
              locksmithId: true,
              assessmentFee: true,
              eta: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip,
      }),
      prisma.job.count({ where }),
    ]);

    // Format response
    const formattedJobs = jobs.map((job) => ({
      id: job.id,
      jobNumber: job.jobNumber,
      status: job.status,
      createdVia: job.createdVia,
      problemType: job.problemType,
      propertyType: job.propertyType,
      description: job.description,
      postcode: job.postcode,
      address: job.address,
      latitude: job.latitude,
      longitude: job.longitude,
      assessmentFee: job.assessmentFee,
      assessmentPaid: job.assessmentPaid,
      customer: job.customer,
      locksmith: job.locksmith,
      quote: job.quote,
      applicationCount: job.applications.length,
      applications: job.applications,
      timestamps: {
        created: job.createdAt,
        accepted: job.acceptedAt,
        enRoute: job.enRouteAt,
        arrived: job.arrivedAt,
        diagnosed: job.diagnosedAt,
        workStarted: job.workStartedAt,
        workCompleted: job.workCompletedAt,
        signed: job.signedAt,
      },
    }));

    return NextResponse.json({
      success: true,
      jobs: formattedJobs,
      pagination: {
        total,
        limit,
        skip,
        hasMore: skip + limit < total,
      },
    });
  } catch (error) {
    console.error("[Agent API] Error fetching jobs:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch jobs" },
      { status: 500 },
    );
  }
}
