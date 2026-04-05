import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { sendNewReviewEmail } from "@/lib/email";
import { notifyReviewSubmitted } from "@/lib/telegram";

// POST /api/jobs/[id]/review - Submit a review for a completed job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { rating, comment, feedback, wouldRecommend } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    // Get job with customer and locksmith
    const job = await prisma.job.findUnique({
      where: { id },
      include: {
        customer: true,
        locksmith: true,
        review: true,
      },
    });

    if (!job) {
      return NextResponse.json(
        { success: false, error: "Job not found" },
        { status: 404 }
      );
    }

    if (!["COMPLETED", "SIGNED"].includes(job.status)) {
      return NextResponse.json(
        { success: false, error: "Can only review completed jobs" },
        { status: 400 }
      );
    }

    if (job.review) {
      return NextResponse.json(
        { success: false, error: "Review already exists for this job" },
        { status: 400 }
      );
    }

    if (!job.locksmithId) {
      return NextResponse.json(
        { success: false, error: "No locksmith assigned to this job" },
        { status: 400 }
      );
    }

    // Build comment with feedback tags if provided
    let fullComment = comment || "";
    if (feedback && feedback.length > 0) {
      const feedbackLabels: Record<string, string> = {
        punctual: "Punctual",
        professional: "Professional",
        skilled: "Skilled Work",
        "fair-price": "Fair Price",
        friendly: "Friendly",
      };
      const feedbackText = feedback.map((f: string) => feedbackLabels[f] || f).join(", ");
      if (fullComment) {
        fullComment += `\n\nHighlights: ${feedbackText}`;
      } else {
        fullComment = `Highlights: ${feedbackText}`;
      }
      if (wouldRecommend !== null) {
        fullComment += wouldRecommend ? "\n\nWould recommend!" : "\n\nWould not recommend.";
      }
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        jobId: id,
        customerId: job.customerId,
        locksmithId: job.locksmithId,
        rating,
        comment: fullComment || null,
        isPublic: true,
      },
    });

    // Update locksmith rating
    const allReviews = await prisma.review.findMany({
      where: { locksmithId: job.locksmithId },
      select: { rating: true },
    });

    const avgRating = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;

    await prisma.locksmith.update({
      where: { id: job.locksmithId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
      },
    });

    // Send review notification email to locksmith (non-blocking)
    if (job.locksmith?.email && job.customer) {
      sendNewReviewEmail(job.locksmith.email, {
        locksmithName: job.locksmith.name,
        jobNumber: job.jobNumber,
        customerName: job.customer.name,
        rating,
        comment: fullComment || null,
      }).catch((err) => console.error("[Email] Failed to send review notification:", err));
    }

    // Send Telegram notification (non-blocking)
    if (job.locksmith && job.customer) {
      notifyReviewSubmitted({
        jobNumber: job.jobNumber,
        locksmithName: job.locksmith.name,
        customerName: job.customer.name,
        rating,
        comment: fullComment || null,
      }).catch((err) => console.error("[Telegram] Failed to send review notification:", err));
    }

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

// GET /api/jobs/[id]/review - Get review for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const review = await prisma.review.findUnique({
      where: { jobId: id },
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
      },
    });

    if (!review) {
      return NextResponse.json(
        { success: false, error: "Review not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      review: {
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        customerName: review.customer.name,
      },
    });
  } catch (error) {
    console.error("Error fetching review:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch review" },
      { status: 500 }
    );
  }
}
