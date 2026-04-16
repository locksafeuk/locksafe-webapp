import { put, del, list } from "@vercel/blob";

// Max file size for free tier optimization (500KB after compression)
export const MAX_FILE_SIZE = 500 * 1024;

// Allowed image types
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Upload an image to Vercel Blob
 */
export async function uploadImage(
  file: Blob | Buffer,
  filename: string,
  options?: {
    folder?: string;
    jobId?: string;
    type?: string;
  }
): Promise<{ url: string; pathname: string }> {
  const folder = options?.folder || "photos";
  const jobId = options?.jobId || "general";
  const type = options?.type || "photo";
  const timestamp = Date.now();

  const pathname = `${folder}/${jobId}/${type}-${timestamp}-${filename}`;

  const blob = await put(pathname, file, {
    access: "public",
    addRandomSuffix: false,
  });

  return {
    url: blob.url,
    pathname: blob.pathname,
  };
}

/**
 * Delete an image from Vercel Blob
 */
export async function deleteImage(url: string): Promise<void> {
  await del(url);
}

/**
 * List images for a job
 */
export async function listJobImages(jobId: string): Promise<string[]> {
  const { blobs } = await list({
    prefix: `photos/${jobId}/`,
  });

  return blobs.map((blob) => blob.url);
}

/**
 * Client-side image compression configuration
 * Used in the browser before uploading
 */
export const compressionConfig = {
  maxWidth: 1200,
  maxHeight: 1200,
  quality: 0.7,
  mimeType: "image/jpeg",
};
