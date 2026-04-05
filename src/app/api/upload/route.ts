import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";

// POST /api/upload - Handle direct uploads for smaller files
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const jobId = formData.get("jobId") as string | null;
    const photoType = formData.get("type") as string | null;
    const uploadedBy = formData.get("uploadedBy") as string | null; // "customer" or "locksmith"

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type - allow images and PDFs
    const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"];
    const allowedDocTypes = ["application/pdf"];
    const allowedTypes = [...allowedImageTypes, ...allowedDocTypes];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: "Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed." },
        { status: 400 }
      );
    }

    // Check file size (max 10MB for documents, 4.5MB for images)
    const isDocument = allowedDocTypes.includes(file.type);
    const maxSize = isDocument ? 10 * 1024 * 1024 : 4.5 * 1024 * 1024;
    if (file.size > maxSize) {
      const maxSizeMB = isDocument ? "10MB" : "4.5MB";
      return NextResponse.json(
        { success: false, error: `File too large. Maximum size is ${maxSizeMB}.` },
        { status: 400 }
      );
    }

    // Generate unique filename with correct extension
    const timestamp = Date.now();
    let ext = "jpg";
    if (file.type === "image/png") ext = "png";
    else if (file.type === "image/webp") ext = "webp";
    else if (file.type === "application/pdf") ext = "pdf";

    const folder = jobId ? `jobs/${jobId}` : "uploads";
    const type = photoType || "photo";
    const by = uploadedBy || "unknown";
    const filename = `${folder}/${type}-${by}-${timestamp}.${ext}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      success: true,
      url: blob.url,
      pathname: blob.pathname,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Upload] Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}
