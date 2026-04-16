import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import prisma from "@/lib/db";

// GET: Get a specific customer with full details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        jobs: {
          orderBy: { createdAt: "desc" },
          include: {
            locksmith: {
              select: {
                id: true,
                name: true,
              },
            },
            quote: {
              select: {
                total: true,
                accepted: true,
              },
            },
          },
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          include: {
            locksmith: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Calculate customer stats
    const totalSpent = customer.jobs.reduce((sum, job) => {
      if (job.quote?.accepted) {
        return sum + (job.quote.total || 0);
      }
      return sum;
    }, 0);

    const completedJobs = customer.jobs.filter(
      (job) => job.status === "COMPLETED" || job.status === "SIGNED"
    ).length;

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        emailVerified: customer.emailVerified,
        hasAccount: !!customer.passwordHash,
        hasStripe: !!customer.stripeCustomerId,
        stripeCustomerId: customer.stripeCustomerId,
        createdVia: customer.createdVia,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        jobs: customer.jobs.map((job) => ({
          id: job.id,
          jobNumber: job.jobNumber,
          status: job.status,
          problemType: job.problemType,
          propertyType: job.propertyType,
          address: job.address,
          postcode: job.postcode,
          assessmentFee: job.assessmentFee,
          quoteTotal: job.quote?.total || null,
          quoteAccepted: job.quote?.accepted || false,
          locksmith: job.locksmith,
          createdAt: job.createdAt,
        })),
        reviews: customer.reviews.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          locksmith: review.locksmith,
          createdAt: review.createdAt,
        })),
        stats: {
          totalJobs: customer.jobs.length,
          completedJobs,
          totalSpent,
          totalReviews: customer.reviews.length,
          avgRating:
            customer.reviews.length > 0
              ? customer.reviews.reduce((sum, r) => sum + r.rating, 0) /
                customer.reviews.length
              : null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Failed to fetch customer" },
      { status: 500 }
    );
  }
}

// PATCH: Update customer details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const { name, email, phone, emailVerified } = body;

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(phone && { phone }),
        ...(typeof emailVerified === "boolean" && { emailVerified }),
      },
    });

    return NextResponse.json({
      success: true,
      customer,
      message: "Customer updated successfully",
    });
  } catch (error) {
    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Failed to update customer" },
      { status: 500 }
    );
  }
}

// DELETE: Delete a customer and all related data (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const authToken = cookieStore.get("auth_token");

    if (!authToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get customer with counts
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            jobs: true,
            reviews: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Log deletion info for audit
    console.log(`[Admin Delete Customer] Deleting customer ${customer.name} (${customer.id}) with:`, {
      jobs: customer._count.jobs,
      reviews: customer._count.reviews,
    });

    // Get all job IDs for this customer to cascade delete job-related records
    const customerJobs = await prisma.job.findMany({
      where: { customerId: id },
      select: { id: true, jobNumber: true },
    });
    const jobIds = customerJobs.map((j) => j.id);

    // Delete all related records in a transaction with proper order
    await prisma.$transaction([
      // First, delete job-related records for all jobs belonging to this customer
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
      // Delete locksmith applications for these jobs
      prisma.locksmithApplication.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Delete quotes for these jobs
      prisma.quote.deleteMany({
        where: { jobId: { in: jobIds } },
      }),
      // Now delete the jobs themselves
      prisma.job.deleteMany({
        where: { customerId: id },
      }),
      // Delete reviews written by this customer
      prisma.review.deleteMany({
        where: { customerId: id },
      }),
      // Delete notifications for this customer
      prisma.notification.deleteMany({
        where: { customerId: id },
      }),
      // Finally, delete the customer
      prisma.customer.delete({
        where: { id },
      }),
    ]);

    console.log(`[Admin Delete Customer] Successfully deleted customer ${customer.name} and ${jobIds.length} associated job(s)`);

    return NextResponse.json({
      success: true,
      message: `Customer "${customer.name}" and ${customer._count.jobs} associated job(s) deleted successfully`,
      deletedJobs: customerJobs.map((j) => j.jobNumber),
    });
  } catch (error) {
    console.error("Error deleting customer:", error);
    return NextResponse.json(
      { error: "Failed to delete customer" },
      { status: 500 }
    );
  }
}
