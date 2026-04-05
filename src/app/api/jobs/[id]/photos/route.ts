import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

// POST /api/jobs/[id]/photos - Add a photo to a job
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { url, type, caption, gpsLat, gpsLng } = body;

    if (!url) {
      return NextResponse.json(
        { success: false, error: "Photo URL is required" },
        { status: 400 }
      );
    }

    // Validate photo type
    const validTypes = ["BEFORE", "DURING", "AFTER", "LOCK_SERIAL", "DAMAGE", "OTHER"];
    const photoType = validTypes.includes(type) ? type : "OTHER";

    // Create photo record
    const photo = await prisma.photo.create({
      data: {
        jobId: id,
        url,
        type: photoType,
        caption: caption || null,
        gpsLat: gpsLat || null,
        gpsLng: gpsLng || null,
      },
    });

    return NextResponse.json({
      success: true,
      photo: {
        id: photo.id,
        url: photo.url,
        type: photo.type,
        caption: photo.caption,
        takenAt: photo.takenAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Photos] Error adding photo:", error);
    return NextResponse.json(
      { success: false, error: "Failed to add photo" },
      { status: 500 }
    );
  }
}

// GET /api/jobs/[id]/photos - Get all photos for a job
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const photos = await prisma.photo.findMany({
      where: { jobId: id },
      orderBy: { takenAt: "asc" },
    });

    return NextResponse.json({
      success: true,
      photos: photos.map((p) => ({
        id: p.id,
        url: p.url,
        type: p.type,
        caption: p.caption,
        takenAt: p.takenAt.toISOString(),
        gpsLat: p.gpsLat,
        gpsLng: p.gpsLng,
      })),
    });
  } catch (error) {
    console.error("[Photos] Error fetching photos:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
