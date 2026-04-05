"use client";

import { useState, useCallback } from "react";

interface UploadedImage {
  url: string;
  pathname: string;
  uploadedAt: string;
  type?: string;
  localPreview?: string;
}

interface UseImageUploadOptions {
  jobId?: string;
  photoType?: string;
  uploadedBy?: "customer" | "locksmith";
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  onUploadComplete?: (image: UploadedImage) => void;
  onError?: (error: string) => void;
}

/**
 * Compress an image using canvas
 */
async function compressImage(
  file: File,
  maxWidth: number = 1200,
  maxHeight: number = 1200,
  quality: number = 0.7
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions
        let { width, height } = img;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }

        // Create canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        // Draw image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Could not compress image"));
            }
          },
          "image/jpeg",
          quality
        );
      };

      img.onerror = () => reject(new Error("Could not load image"));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Create a local preview URL for an image
 */
function createLocalPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = () => reject(new Error("Could not create preview"));
    reader.readAsDataURL(file);
  });
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  const {
    jobId,
    photoType = "photo",
    uploadedBy = "customer",
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.7,
    onUploadComplete,
    onError,
  } = options;

  const uploadImage = useCallback(async (file: File): Promise<UploadedImage | null> => {
    setIsUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      // Validate file type
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        throw new Error("Invalid file type. Only JPEG, PNG, and WebP are allowed.");
      }

      // Create local preview immediately
      const localPreview = await createLocalPreview(file);
      setUploadProgress(10);

      // Compress the image
      const compressedBlob = await compressImage(file, maxWidth, maxHeight, quality);
      setUploadProgress(50);

      // Log compression stats
      const originalSize = (file.size / 1024).toFixed(2);
      const compressedSize = (compressedBlob.size / 1024).toFixed(2);
      console.log(`[Upload] Compressed: ${originalSize}KB -> ${compressedSize}KB`);

      // Create form data
      const formData = new FormData();
      formData.append("file", compressedBlob, file.name.replace(/\.[^.]+$/, ".jpg"));
      if (jobId) formData.append("jobId", jobId);
      formData.append("type", photoType);
      formData.append("uploadedBy", uploadedBy);

      setUploadProgress(60);

      // Upload
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(90);

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Upload failed");
      }

      const uploadedImage: UploadedImage = {
        url: data.url,
        pathname: data.pathname,
        uploadedAt: data.uploadedAt,
        type: photoType,
        localPreview,
      };

      setUploadedImages((prev) => [...prev, uploadedImage]);
      setUploadProgress(100);

      onUploadComplete?.(uploadedImage);

      return uploadedImage;
    } catch (err: any) {
      const errorMessage = err.message || "Upload failed";
      setError(errorMessage);
      onError?.(errorMessage);
      return null;
    } finally {
      setIsUploading(false);
      // Reset progress after a delay
      setTimeout(() => setUploadProgress(0), 1000);
    }
  }, [jobId, photoType, uploadedBy, maxWidth, maxHeight, quality, onUploadComplete, onError]);

  const uploadMultiple = useCallback(async (files: FileList | File[]): Promise<UploadedImage[]> => {
    const results: UploadedImage[] = [];

    for (const file of Array.from(files)) {
      const result = await uploadImage(file);
      if (result) {
        results.push(result);
      }
    }

    return results;
  }, [uploadImage]);

  const removeImage = useCallback((url: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.url !== url));
  }, []);

  const clearAll = useCallback(() => {
    setUploadedImages([]);
    setError(null);
  }, []);

  return {
    uploadImage,
    uploadMultiple,
    removeImage,
    clearAll,
    isUploading,
    uploadProgress,
    error,
    uploadedImages,
  };
}
