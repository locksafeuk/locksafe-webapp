/**
 * POST /api/admin/meta-catalog/upload
 *
 * Multipart form with `file` (image) and `slug` (ServiceSlug). Uploads the
 * image to Vercel Blob and writes the URL to the matching
 * `ServiceCatalogItem.imageUrl` override.
 *
 * Meta requires square images >= 500x500 for dynamic ads. We don't enforce
 * dimensions server-side (admin already sees a preview), but cap size.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { put } from "@vercel/blob";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isServiceSlug } from "@/lib/services-catalog";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload || payload.type !== "admin") return null;
  return payload;
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const slug = formData.get("slug");

  if (typeof slug !== "string" || !isServiceSlug(slug)) {
    return NextResponse.json({ error: "Invalid or missing slug" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, or WebP images are allowed" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be <= 4MB" }, { status: 400 });
  }

  const ext =
    file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const filename = `meta-catalog/${slug}-${Date.now()}.${ext}`;

  const blob = await put(filename, file, {
    access: "public",
    addRandomSuffix: true,
    contentType: file.type,
  });

  const row = await prisma.serviceCatalogItem.upsert({
    where: { slug },
    create: { slug, imageUrl: blob.url },
    update: { imageUrl: blob.url },
  });

  return NextResponse.json({ success: true, url: blob.url, item: row });
}
