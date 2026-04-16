"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, X, Loader2, Upload, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";

interface ImageUploaderProps {
  jobId?: string;
  photoType?: string;
  uploadedBy?: "customer" | "locksmith";
  maxImages?: number;
  onImagesChange?: (urls: string[]) => void;
  className?: string;
  label?: string;
  helpText?: string;
  showGallery?: boolean;
  compact?: boolean;
}

export function ImageUploader({
  jobId,
  photoType = "photo",
  uploadedBy = "customer",
  maxImages = 5,
  onImagesChange,
  className = "",
  label = "Add Photos",
  helpText = "Photos help the locksmith prepare",
  showGallery = true,
  compact = false,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([]);

  const {
    uploadImage,
    isUploading,
    uploadProgress,
    error,
    uploadedImages,
    removeImage,
  } = useImageUpload({
    jobId,
    photoType,
    uploadedBy,
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.7,
    onUploadComplete: (image) => {
      // Remove pending preview when upload completes
      if (image.localPreview) {
        setPendingPreviews((prev) => prev.filter((p) => p !== image.localPreview));
      }
      // Notify parent
      const allUrls = [...uploadedImages.map((i) => i.url), image.url];
      onImagesChange?.(allUrls);
    },
  });

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = maxImages - uploadedImages.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    for (const file of filesToUpload) {
      // Create and show preview immediately
      const reader = new FileReader();
      reader.onload = (event) => {
        const preview = event.target?.result as string;
        setPendingPreviews((prev) => [...prev, preview]);
      };
      reader.readAsDataURL(file);

      // Then upload
      await uploadImage(file);
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [maxImages, uploadedImages.length, uploadImage]);

  const handleRemove = useCallback((url: string) => {
    removeImage(url);
    const remainingUrls = uploadedImages.filter((i) => i.url !== url).map((i) => i.url);
    onImagesChange?.(remainingUrls);
  }, [removeImage, uploadedImages, onImagesChange]);

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const canAddMore = uploadedImages.length + pendingPreviews.length < maxImages;

  if (compact) {
    return (
      <div className={className}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileChange}
          multiple
          className="hidden"
        />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerFileInput}
            disabled={!canAddMore || isUploading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed transition-colors ${
              canAddMore
                ? "border-slate-300 hover:border-orange-400 hover:bg-orange-50"
                : "border-slate-200 bg-slate-50 cursor-not-allowed"
            }`}
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
            ) : (
              <Camera className="w-4 h-4 text-slate-500" />
            )}
            <span className="text-sm text-slate-600">
              {isUploading ? "Uploading..." : `Add Photo (${uploadedImages.length}/${maxImages})`}
            </span>
          </button>

          {uploadedImages.length > 0 && (
            <div className="flex -space-x-2">
              {uploadedImages.slice(0, 3).map((img, i) => (
                <div
                  key={img.url}
                  className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden"
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
              {uploadedImages.length > 3 && (
                <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-700 flex items-center justify-center">
                  <span className="text-xs text-white font-medium">+{uploadedImages.length - 3}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <p className="text-red-500 text-xs mt-1">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        multiple
        className="hidden"
      />

      {/* Upload Area */}
      <button
        type="button"
        onClick={triggerFileInput}
        disabled={!canAddMore || isUploading}
        className={`w-full border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
          canAddMore
            ? "border-slate-300 hover:border-orange-400 cursor-pointer hover:bg-orange-50/50"
            : "border-slate-200 bg-slate-50 cursor-not-allowed"
        }`}
      >
        {isUploading ? (
          <>
            <div className="relative w-12 h-12 mx-auto mb-3">
              <Loader2 className="w-12 h-12 text-orange-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-semibold text-orange-600">{Math.round(uploadProgress)}%</span>
              </div>
            </div>
            <p className="text-slate-600 font-medium">Compressing & uploading...</p>
          </>
        ) : canAddMore ? (
          <>
            <Camera className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-slate-600 font-medium">{label}</p>
            <p className="text-sm text-slate-500">{helpText}</p>
            <p className="text-xs text-slate-400 mt-2">
              {uploadedImages.length}/{maxImages} photos
            </p>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-slate-600 font-medium">Maximum photos reached</p>
            <p className="text-xs text-slate-400">Remove a photo to add more</p>
          </>
        )}
      </button>

      {/* Error Display */}
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Image Gallery */}
      {showGallery && (uploadedImages.length > 0 || pendingPreviews.length > 0) && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          {/* Pending previews (uploading) */}
          {pendingPreviews.map((preview, index) => (
            <div
              key={`pending-${index}`}
              className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden"
            >
              <img
                src={preview}
                alt="Uploading..."
                className="w-full h-full object-cover opacity-50"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
              </div>
            </div>
          ))}

          {/* Uploaded images */}
          {uploadedImages.map((image) => (
            <div
              key={image.url}
              className="relative aspect-square bg-slate-100 rounded-lg overflow-hidden group"
            >
              <img
                src={image.url}
                alt="Uploaded"
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemove(image.url)}
                className="absolute top-1 right-1 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
              >
                <X className="w-3 h-3" />
              </button>
              <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-green-500 text-white rounded text-[10px] font-medium flex items-center gap-1">
                <CheckCircle2 className="w-2.5 h-2.5" />
                Uploaded
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
