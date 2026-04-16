import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// GET /api/locksmiths/[id]/reviews - Get all reviews for a locksmith
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") || "recent"; // recent, highest, lowest

    const skip = (page - 1) * limit;

    // Build orderBy based on sortBy
    let orderBy: any = { createdAt: "desc" };
    if (sortBy === "highest") {
      orderBy = { rating: "desc" };
    } else if (sortBy === "lowest") {
      orderBy = { rating: "asc" };
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where: {
          locksmithId: id,
          isPublic: true,
        },
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
        orderBy,
        skip,
        take: limit,
      }),
      prisma.review.count({
        where: {
          locksmithId: id,
          isPublic: true,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      reviews: reviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        customerName: review.customer.name,
        jobType: review.job.problemType,
        location: review.job.postcode.split(" ")[0],
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}

// POST /api/locksmiths/[id]/reviews - Submit a review (called from job review page)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { jobId, customerId, rating, comment, isPublic = true } = body;

    if (!jobId || !customerId || !rating) {
      return NextResponse.json(
        { success: false, error: "jobId, customerId, and rating are required" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: { jobId },
    });

    if (existingReview) {
      return NextResponse.json(
        { success: false, error: "Review already exists for this job" },
        { status: 400 }
      );
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        jobId,
        customerId,
        locksmithId: id,
        rating,
        comment,
        isPublic,
      },
    });

    // Update locksmith rating
    const allReviews = await prisma.review.findMany({
      where: { locksmithId: id },
      select: { rating: true },
    });

    const avgRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;

    await prisma.locksmith.update({
      where: { id },
      data: { rating: Math.round(avgRating * 10) / 10 },
    });

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating review:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create review" },
      { status: 500 }
    );
  }
}
