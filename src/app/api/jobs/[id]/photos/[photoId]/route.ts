import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { del } from "@vercel/blob";

// DELETE /api/jobs/[id]/photos/[photoId] - Delete a photo
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const { id, photoId } = await params;

    // Get photo first to get the URL for blob deletion
    const photo = await prisma.photo.findUnique({
      where: { id: photoId },
    });

    if (!photo) {
      return NextResponse.json(
        { success: false, error: "Photo not found" },
        { status: 404 }
      );
    }

    // Verify photo belongs to the job
    if (photo.jobId !== id) {
      return NextResponse.json(
        { success: false, error: "Photo does not belong to this job" },
        { status: 403 }
      );
    }

    // Delete from database
    await prisma.photo.delete({
      where: { id: photoId },
    });

    // Try to delete from Vercel Blob (don't fail if this errors)
    try {
      if (photo.url.includes("blob.vercel-storage.com") || photo.url.includes("vercel-blob")) {
        await del(photo.url);
      }
    } catch (blobError) {
      console.warn("[Photos] Could not delete blob:", blobError);
      // Continue anyway - database record is deleted
    }

    return NextResponse.json({
      success: true,
      message: "Photo deleted successfully",
    });
  } catch (error) {
    console.error("[Photos] Error deleting photo:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete photo" },
      { status: 500 }
    );
  }
}
