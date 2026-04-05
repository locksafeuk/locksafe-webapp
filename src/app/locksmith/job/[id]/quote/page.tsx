"use client";

import { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Camera,
  Plus,
  Trash2,
  Send,
  CheckCircle2,
  Clock,
  Wrench,
  Package,
  PoundSterling,
  AlertCircle,
  User,
  MapPin,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import { captureGPS } from "@/hooks/useGPS";
import { useImageUpload } from "@/hooks/useImageUpload";

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  postcode: string;
  address: string;
  assessmentFee: number;
  customer: {
    name: string;
    phone: string;
  } | null;
}

interface UploadedPhoto {
  id?: string;
  url: string;
  type: string;
  caption?: string;
  localPreview?: string;
  isUploading?: boolean;
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

const commonParts = [
  { name: "Euro Cylinder (Standard)", price: 45 },
  { name: "Euro Cylinder (Anti-Snap)", price: 85 },
  { name: "Mortice Lock", price: 120 },
  { name: "Night Latch", price: 75 },
  { name: "Door Handle Set", price: 55 },
  { name: "Key Cutting (Standard)", price: 15 },
  { name: "Key Cutting (Security)", price: 35 },
  { name: "Lock Lubricant", price: 8 },
];

const commonLabour = [
  { name: "Lock Picking (Non-Destructive)", price: 60 },
  { name: "Lock Drilling", price: 80 },
  { name: "Lock Replacement", price: 45 },
  { name: "Key Extraction", price: 40 },
  { name: "Door Realignment", price: 50 },
  { name: "Emergency Call-Out", price: 30 },
];

interface QuoteItem {
  id: string;
  type: "part" | "labour";
  name: string;
  quantity: number;
  unitPrice: number;
}

export default function CreateQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Job data state
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [diagnosis, setDiagnosis] = useState({
    lockType: "",
    defect: "",
    difficulty: "medium",
    notes: "",
  });
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [estimatedTime, setEstimatedTime] = useState("30");
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemType, setAddItemType] = useState<"part" | "labour">("part");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quoteSent, setQuoteSent] = useState(false);

  // Image upload hook
  const {
    uploadImage,
    isUploading,
    uploadProgress,
    error: uploadError,
  } = useImageUpload({
    jobId: id,
    photoType: "DURING",
    uploadedBy: "locksmith",
    onUploadComplete: async (image) => {
      // Save photo to job database
      try {
        const gps = await captureGPS();
        await fetch(`/api/jobs/${id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: image.url,
            type: "DURING",
            caption: "Quote documentation photo",
            gpsLat: gps?.lat,
            gpsLng: gps?.lng,
          }),
        });
      } catch (err) {
        console.error("Error saving photo to job:", err);
      }
    },
    onError: (err) => {
      console.error("Upload error:", err);
    },
  });

  // Fetch job data and existing photos
  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const [jobResponse, photosResponse] = await Promise.all([
          fetch(`/api/jobs/${id}`),
          fetch(`/api/jobs/${id}/photos`),
        ]);

        const jobData = await jobResponse.json();
        const photosData = await photosResponse.json();

        if (jobData.success) {
          setJob({
            id: jobData.job.id,
            jobNumber: jobData.job.jobNumber,
            status: jobData.job.status,
            problemType: jobData.job.problemType,
            propertyType: jobData.job.propertyType,
            postcode: jobData.job.postcode,
            address: jobData.job.address,
            assessmentFee: jobData.job.assessmentFee,
            customer: jobData.job.customer,
          });
        } else {
          setError(jobData.error || "Failed to load job");
        }

        // Load existing photos
        if (photosData.success && photosData.photos) {
          setPhotos(photosData.photos.map((p: any) => ({
            id: p.id,
            url: p.url,
            type: p.type,
            caption: p.caption,
          })));
        }
      } catch (err) {
        setError("Failed to connect to server");
        console.error("Error fetching job:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  // Handle file selection
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      // Create temporary preview
      const reader = new FileReader();
      reader.onload = async (e) => {
        const localPreview = e.target?.result as string;
        const tempId = `temp-${Date.now()}-${Math.random()}`;

        // Add to photos with uploading state
        setPhotos(prev => [...prev, {
          id: tempId,
          url: localPreview,
          type: "DURING",
          localPreview,
          isUploading: true,
        }]);

        // Upload the image
        const result = await uploadImage(file);

        if (result) {
          // Replace temporary photo with uploaded one
          setPhotos(prev => prev.map(p =>
            p.id === tempId
              ? { ...p, url: result.url, isUploading: false, localPreview: undefined }
              : p
          ));
        } else {
          // Remove failed upload
          setPhotos(prev => prev.filter(p => p.id !== tempId));
        }
      };
      reader.readAsDataURL(file);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle photo removal
  const handleRemovePhoto = async (photo: UploadedPhoto) => {
    if (photo.isUploading) return;

    // Remove from local state immediately
    setPhotos(prev => prev.filter(p => p.url !== photo.url));

    // If it has an ID, delete from database
    if (photo.id && !photo.id.startsWith('temp-')) {
      try {
        await fetch(`/api/jobs/${id}/photos/${photo.id}`, {
          method: "DELETE",
        });
      } catch (err) {
        console.error("Error deleting photo:", err);
      }
    }
  };

  const addQuoteItem = (item: { name: string; price: number }, type: "part" | "labour") => {
    const newItem: QuoteItem = {
      id: `item-${Date.now()}`,
      type,
      name: item.name,
      quantity: 1,
      unitPrice: item.price,
    };
    setQuoteItems([...quoteItems, newItem]);
    setShowAddItem(false);
  };

  const addCustomItem = () => {
    if (!customItemName || !customItemPrice) return;
    const newItem: QuoteItem = {
      id: `item-${Date.now()}`,
      type: addItemType,
      name: customItemName,
      quantity: 1,
      unitPrice: Number.parseFloat(customItemPrice),
    };
    setQuoteItems([...quoteItems, newItem]);
    setCustomItemName("");
    setCustomItemPrice("");
    setShowAddItem(false);
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    setQuoteItems(
      quoteItems.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    );
  };

  const removeItem = (itemId: string) => {
    setQuoteItems(quoteItems.filter((item) => item.id !== itemId));
  };

  const partsTotal = quoteItems
    .filter((item) => item.type === "part")
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const labourTotal = quoteItems
    .filter((item) => item.type === "labour")
    .reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const grandTotal = partsTotal + labourTotal;

  const handleSubmitQuote = async () => {
    if (!job) return;

    setIsSubmitting(true);
    try {
      // Capture locksmith's GPS for anti-fraud protection
      const quoteGps = await captureGPS();

      // Create quote via API
      const response = await fetch(`/api/jobs/${id}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lockType: diagnosis.lockType,
          defect: diagnosis.defect,
          difficulty: diagnosis.difficulty,
          notes: diagnosis.notes,
          parts: quoteItems.filter(item => item.type === "part").map(item => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity,
          })),
          labourCost: labourTotal,
          labourTime: parseInt(estimatedTime),
          partsTotal,
          subtotal: grandTotal,
          vat: grandTotal * 0.2, // Calculate VAT
          total: grandTotal + (grandTotal * 0.2), // Including VAT
          quoteGps: quoteGps, // Locksmith's GPS at quote time
          photoUrls: photos.filter(p => !p.isUploading).map(p => p.url), // Include photo URLs
        }),
      });

      const data = await response.json();

      if (data.success) {
        setQuoteSent(true);
      } else {
        alert(data.error || "Failed to submit quote");
      }
    } catch (err) {
      alert("Failed to submit quote");
      console.error("Error submitting quote:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || "Job not found"}</p>
          <Link href="/locksmith/dashboard">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (quoteSent) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Quote Sent!</h1>
          <p className="text-slate-600 mb-6">
            The customer has been notified and will review your quote.
            You'll be notified when they respond.
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
            <div className="text-sm text-slate-500 mb-1">Quote Total (inc. VAT)</div>
            <div className="text-3xl font-bold text-orange-600">£{(grandTotal * 1.2).toFixed(2)}</div>
            <div className="text-sm text-slate-500 mt-1">Subtotal: £{grandTotal.toFixed(2)} + VAT: £{(grandTotal * 0.2).toFixed(2)}</div>
            <div className="text-sm text-slate-500 mt-1">Estimated time: {estimatedTime} minutes</div>
          </div>

          <div className="space-y-2">
            <Link href={`/locksmith/job/${id}/work`}>
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                Continue Managing Job
              </Button>
            </Link>
            <Link href="/locksmith/dashboard">
              <Button variant="outline" className="w-full">
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 pb-32 lg:pb-6">
      {/* Header */}
      <header className="bg-slate-900 text-white sticky top-0 z-40">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="font-bold truncate">Create Quote</div>
                <div className="text-xs text-slate-400">{job.jobNumber}</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-6 max-w-6xl mx-auto">
        <Link href="/locksmith/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job Summary */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Job Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <User className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-500">Customer</div>
                    <div className="font-medium truncate">{job.customer?.name || "Unknown"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-500">Location</div>
                    <div className="font-medium break-words">{job.address}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Wrench className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-500">Problem</div>
                    <div className="font-medium">{problemLabels[job.problemType] || job.problemType}</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <PoundSterling className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-sm text-slate-500">Assessment Fee (Paid)</div>
                    <div className="font-medium text-green-600">£{job.assessmentFee}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnosis */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Diagnosis</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Lock Type
                    </label>
                    <select
                      value={diagnosis.lockType}
                      onChange={(e) => setDiagnosis({ ...diagnosis, lockType: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                    >
                      <option value="">Select lock type...</option>
                      <option value="euro-cylinder">Euro Cylinder</option>
                      <option value="mortice">Mortice Lock</option>
                      <option value="night-latch">Night Latch (Yale)</option>
                      <option value="rim-lock">Rim Lock</option>
                      <option value="deadbolt">Deadbolt</option>
                      <option value="multipoint">Multipoint Lock</option>
                      <option value="smart-lock">Smart Lock</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Difficulty Level
                    </label>
                    <select
                      value={diagnosis.difficulty}
                      onChange={(e) => setDiagnosis({ ...diagnosis, difficulty: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                    >
                      <option value="easy">Easy - Standard procedure</option>
                      <option value="medium">Medium - Some complexity</option>
                      <option value="hard">Hard - Specialist required</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Defect / Issue Found
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Broken key stuck in cylinder, lock mechanism jammed"
                    value={diagnosis.defect}
                    onChange={(e) => setDiagnosis({ ...diagnosis, defect: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    placeholder="Any additional observations or recommendations..."
                    value={diagnosis.notes}
                    onChange={(e) => setDiagnosis({ ...diagnosis, notes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none text-base"
                  />
                </div>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Documentation Photos</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {photos.map((photo, index) => (
                  <div key={photo.id || photo.url || index} className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden group">
                    <img
                      src={photo.localPreview || photo.url}
                      alt={`Photo ${index + 1}`}
                      className={`w-full h-full object-cover ${photo.isUploading ? "opacity-60" : ""}`}
                    />
                    {photo.isUploading && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60">
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500 mb-1" />
                        <span className="text-xs text-slate-500">Uploading...</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(photo)}
                      disabled={photo.isUploading}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-90 hover:opacity-100"
                      title="Remove photo"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-orange-400 hover:text-orange-500 transition-colors"
                  disabled={isUploading}
                >
                  <Camera className="w-6 sm:w-8 h-6 sm:h-8 mb-2" />
                  <span className="text-xs sm:text-sm">{isUploading ? "Uploading..." : "Add Photo"}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                    disabled={isUploading}
                  />
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-3">
                Take photos of: the lock, any damage, the area around the lock
              </p>
              {uploadError && (
                <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" /> {uploadError}
                </div>
              )}
            </div>

            {/* Quote Items */}
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-lg text-slate-900">Quote Items</h2>
                <Button
                  onClick={() => setShowAddItem(true)}
                  variant="outline"
                  size="sm"
                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {quoteItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No items added yet</p>
                  <p className="text-sm">Click "Add Item" to start building the quote</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Parts */}
                  {quoteItems.filter(i => i.type === "part").length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Parts</h3>
                      {quoteItems.filter(i => i.type === "part").map((item) => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-slate-50 rounded-lg mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 truncate">{item.name}</div>
                            <div className="text-sm text-slate-500">£{item.unitPrice} each</div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 text-lg font-medium"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 text-lg font-medium"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-right w-16 sm:w-20 font-semibold">
                              £{item.unitPrice * item.quantity}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="text-right text-sm font-medium text-slate-600">
                        Parts subtotal: £{partsTotal}
                      </div>
                    </div>
                  )}

                  {/* Labour */}
                  {quoteItems.filter(i => i.type === "labour").length > 0 && (
                    <div className="pt-4 border-t">
                      <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Labour</h3>
                      {quoteItems.filter(i => i.type === "labour").map((item) => (
                        <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3 bg-slate-50 rounded-lg mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 truncate">{item.name}</div>
                            <div className="text-sm text-slate-500">£{item.unitPrice}</div>
                          </div>
                          <div className="flex items-center justify-between sm:justify-end gap-3">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 text-lg font-medium"
                              >
                                -
                              </button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300 text-lg font-medium"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-right w-16 sm:w-20 font-semibold">
                              £{item.unitPrice * item.quantity}
                            </div>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="text-right text-sm font-medium text-slate-600">
                        Labour subtotal: £{labourTotal}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Estimated Time */}
              <div className="mt-6 pt-4 border-t">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Estimated Work Time
                </label>
                <select
                  value={estimatedTime}
                  onChange={(e) => setEstimatedTime(e.target.value)}
                  className="w-full sm:w-48 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                >
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                  <option value="180">3+ hours</option>
                </select>
              </div>
            </div>
          </div>

          {/* Quote Summary Sidebar - Desktop */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-24">
              <h2 className="font-bold text-lg text-slate-900 mb-4">Quote Summary</h2>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-slate-600">
                  <span>Parts</span>
                  <span className="font-medium">£{partsTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Labour</span>
                  <span className="font-medium">£{labourTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-medium">£{grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>VAT (20%)</span>
                  <span className="font-medium">£{(grandTotal * 0.2).toFixed(2)}</span>
                </div>
                <div className="border-t pt-3 flex justify-between text-lg">
                  <span className="font-semibold">Total (inc. VAT)</span>
                  <span className="font-bold text-orange-600">£{(grandTotal * 1.2).toFixed(2)}</span>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <Clock className="w-4 h-4" />
                <span>Est. time: {estimatedTime} minutes</span>
              </div>

              {grandTotal === 0 && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 mb-4">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>Add at least one item to send the quote</span>
                </div>
              )}

              <Button
                onClick={handleSubmitQuote}
                disabled={grandTotal === 0 || isSubmitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6 text-lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Send Quote to Customer
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center mt-4">
                Customer will receive the quote instantly and can accept or decline
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Fixed Bottom Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm text-slate-500">Total (inc. VAT)</div>
            <div className="text-2xl font-bold text-orange-600">£{(grandTotal * 1.2).toFixed(2)}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">Subtotal: £{grandTotal.toFixed(2)}</div>
            <div className="text-xs text-slate-500">VAT (20%): £{(grandTotal * 0.2).toFixed(2)}</div>
          </div>
        </div>
        <Button
          onClick={handleSubmitQuote}
          disabled={grandTotal === 0 || isSubmitting}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 text-base"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5 mr-2" />
              Send Quote
            </>
          )}
        </Button>
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg shadow-xl max-h-[85vh] sm:max-h-[90vh] overflow-hidden sm:mx-4">
            <div className="p-4 sm:p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Add Item</h2>
                <button
                  onClick={() => setShowAddItem(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-2xl leading-none"
                >
                  <span className="sr-only">Close</span>
                  ×
                </button>
              </div>
              {/* Tabs */}
              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setAddItemType("part")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-colors ${
                    addItemType === "part"
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Parts
                </button>
                <button
                  type="button"
                  onClick={() => setAddItemType("labour")}
                  className={`flex-1 sm:flex-none px-4 py-2 rounded-lg font-medium transition-colors ${
                    addItemType === "labour"
                      ? "bg-orange-500 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  Labour
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto max-h-[55vh] sm:max-h-[60vh]">
              {/* Common Items */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
                  Common {addItemType === "part" ? "Parts" : "Labour"}
                </h3>
                <div className="space-y-2">
                  {(addItemType === "part" ? commonParts : commonLabour).map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => addQuoteItem(item, addItemType)}
                      className="w-full flex items-center justify-between p-3 sm:p-3 bg-slate-50 hover:bg-orange-50 hover:border-orange-200 border border-transparent rounded-lg transition-colors text-left active:scale-[0.98]"
                    >
                      <span className="font-medium text-slate-900 text-sm sm:text-base">{item.name}</span>
                      <span className="text-orange-600 font-semibold">£{item.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Item */}
              <div className="border-t pt-6">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
                  Custom Item
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={customItemName}
                    onChange={(e) => setCustomItemName(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                  />
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">£</span>
                    <input
                      type="number"
                      placeholder="Price"
                      value={customItemPrice}
                      onChange={(e) => setCustomItemPrice(e.target.value)}
                      className="w-full pl-8 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none text-base"
                    />
                  </div>
                  <Button
                    onClick={addCustomItem}
                    disabled={!customItemName || !customItemPrice}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Custom Item
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
