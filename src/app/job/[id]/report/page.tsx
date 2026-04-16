"use client";

import { useRef, useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import {
  Download,
  Printer,
  Shield,
  MapPin,
  Clock,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { downloadJobReportPDF, type JobReportData } from "@/lib/pdf-generator";
import { SITE_URL, SITE_NAME, SUPPORT_PHONE } from "@/lib/config";

interface Job {
  id: string;
  jobNumber: string;
  status: string;
  problemType: string;
  propertyType: string;
  address: string;
  postcode: string;
  description: string | null;
  createdAt: string;
  acceptedAt?: string;
  arrivedAt?: string;
  diagnosedAt?: string;
  workStartedAt?: string;
  workCompletedAt?: string;
  signedAt?: string;
  customer?: {
    name: string;
    phone: string;
    email?: string;
  } | null;
  locksmith?: {
    name: string;
    phone: string;
    companyName?: string;
    licenseNumber?: string;
    rating?: number;
  } | null;
  quote?: {
    lockType: string;
    defect: string;
    labourCost: number;
    partsTotal: number;
    subtotal: number;
    vat: number;
    total: number;
    parts: Array<{ name: string; unitPrice: number; quantity: number; total?: number }>;
  };
  signature?: {
    signerName: string;
    signedAt: string;
    confirmsWork: boolean;
    confirmsPrice: boolean;
    confirmsSatisfied: boolean;
  };
  // GPS tracking for all events
  requestGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  acceptedGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  arrivalGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  quoteGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  workStartedGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  completionGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  signatureGps?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
}

const problemLabels: Record<string, string> = {
  lockout: "Locked Out",
  broken: "Broken Lock",
  "key-stuck": "Key Stuck",
  "lost-keys": "Lost Keys",
  burglary: "After Burglary",
  other: "Other Issue",
};

const propertyLabels: Record<string, string> = {
  house: "House",
  flat: "Flat/Apartment",
  commercial: "Commercial",
  vehicle: "Vehicle",
};

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const reportRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/jobs/${id}`);
        const data = await response.json();

        if (data.success && data.job) {
          setJob(data.job);
        } else {
          setError("Job not found");
        }
      } catch (err) {
        console.error("Error fetching job:", err);
        setError("Failed to load job");
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = async () => {
    if (!job) return;

    setIsGenerating(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));

      const reportData: JobReportData = {
        jobNumber: job.jobNumber,
        reportNumber: `LRS-${new Date().getFullYear()}-${job.id.slice(-6).toUpperCase()}`,
        generatedAt: new Date().toISOString(),
        customer: {
          name: job.customer?.name || "Unknown Customer",
          phone: job.customer?.phone || "N/A",
          address: job.address,
          postcode: job.postcode,
        },
        locksmith: {
          name: job.locksmith?.name || "Unassigned",
          company: job.locksmith?.companyName || "Independent Locksmith",
          license: job.locksmith?.licenseNumber || "N/A",
          phone: job.locksmith?.phone || "N/A",
          rating: job.locksmith?.rating || 5,
        },
        job: {
          problemType: problemLabels[job.problemType] || job.problemType,
          propertyType: propertyLabels[job.propertyType] || job.propertyType,
          description: job.description || "No description provided",
        },
        timeline: [
          { time: new Date(job.createdAt).toLocaleTimeString(), event: "Request Submitted", gps: job.requestGps || null },
          ...(job.acceptedAt ? [{ time: new Date(job.acceptedAt).toLocaleTimeString(), event: "Job Accepted", gps: job.acceptedGps || null }] : []),
          ...(job.arrivedAt ? [{ time: new Date(job.arrivedAt).toLocaleTimeString(), event: "Locksmith Arrived", gps: job.arrivalGps || null }] : []),
          ...(job.diagnosedAt ? [{ time: new Date(job.diagnosedAt).toLocaleTimeString(), event: "Diagnostic Completed", gps: null }] : []),
          ...(job.quote ? [{ time: new Date(job.diagnosedAt || job.createdAt).toLocaleTimeString(), event: `Quote Sent (£${job.quote.total.toFixed(2)})`, gps: job.quoteGps || null }] : []),
          ...(job.workStartedAt ? [{ time: new Date(job.workStartedAt).toLocaleTimeString(), event: "Work Started", gps: job.workStartedGps || null }] : []),
          ...(job.workCompletedAt ? [{ time: new Date(job.workCompletedAt).toLocaleTimeString(), event: "Work Completed", gps: job.completionGps || null }] : []),
          ...(job.signedAt ? [{ time: new Date(job.signedAt).toLocaleTimeString(), event: "Customer Signed", gps: job.signatureGps || null }] : []),
        ],
        quote: job.quote ? {
          diagnostic: job.quote.defect || "Diagnosis completed",
          lockType: job.quote.lockType,
          parts: job.quote.parts?.map(p => ({ name: p.name, qty: p.quantity, price: p.unitPrice * p.quantity })) || [],
          labour: job.quote.labourCost,
          partsTotal: job.quote.partsTotal,
          subtotal: job.quote.subtotal,
          vat: job.quote.vat,
          total: job.quote.total,
        } : {
          diagnostic: "No quote available",
          lockType: "N/A",
          parts: [],
          labour: 0,
          partsTotal: 0,
          subtotal: 0,
          vat: 0,
          total: 0,
        },
        signature: job.signature ? {
          name: job.signature.signerName,
          timestamp: new Date(job.signature.signedAt).toLocaleTimeString(),
          ip: "N/A",
          confirms: [
            ...(job.signature.confirmsWork ? ["Work completed as described"] : []),
            ...(job.signature.confirmsPrice ? ["Price as quoted"] : []),
            ...(job.signature.confirmsSatisfied ? ["Satisfied with service"] : []),
          ],
          data: "",
        } : {
          name: "Not signed",
          timestamp: "",
          ip: "",
          confirms: [],
          data: "",
        },
      };

      await downloadJobReportPDF(reportData);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Invalid time';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-slate-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 mb-4">{error || "Report not found"}</p>
          <Link href="/">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Safe access for customer and locksmith
  const customerName = job.customer?.name || "Unknown Customer";
  const customerPhone = job.customer?.phone || "N/A";
  const locksmithName = job.locksmith?.name || "Unassigned";
  const locksmithCompany = job.locksmith?.companyName || "Independent Locksmith";
  const locksmithPhone = job.locksmith?.phone || "N/A";
  const locksmithRating = job.locksmith?.rating;

  const reportNumber = `LRS-${new Date().getFullYear()}-${job.id.slice(-6).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="print:hidden bg-white border-b sticky top-0 z-10">
        <div className="section-container py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href={`/customer/job/${id}`} className="p-2 hover:bg-slate-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <Shield className="w-6 h-6 text-orange-500" />
              <div>
                <div className="font-bold text-slate-900">Legal Job Report</div>
                <div className="text-sm text-slate-500">{reportNumber}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
              <Button
                onClick={handleDownload}
                className="bg-orange-500 hover:bg-orange-600"
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="section-container py-8 print:py-0">
        <div
          ref={reportRef}
          className="max-w-3xl mx-auto bg-white shadow-lg print:shadow-none"
        >
          <div className="bg-slate-900 text-white p-8 print:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                  <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-white" stroke="currentColor" strokeWidth="2">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </div>
                <div>
                  <div className="text-2xl font-bold">LockSafe</div>
                  <div className="text-slate-400">Official Job Report</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">Report Number</div>
                <div className="font-mono font-bold">{reportNumber}</div>
                <div className="text-sm text-slate-400 mt-1">Job: {job.jobNumber}</div>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border-b border-orange-200 px-8 py-4 print:px-6">
            <div className="flex items-center gap-3 text-orange-700">
              <Shield className="w-5 h-5" />
              <span className="font-medium">
                Anti-Fraud Protected Document - GPS Verified, Timestamped, Digitally Signed
              </span>
            </div>
          </div>

          {(!job.customer || !job.locksmith) && (
            <div className="bg-amber-50 border-b border-amber-200 px-8 py-4 print:px-6">
              <div className="flex items-center gap-3 text-amber-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">
                  {!job.locksmith
                    ? "No locksmith has been assigned to this job yet"
                    : "Some job details are incomplete"}
                </span>
              </div>
            </div>
          )}

          <div className="p-8 print:p-6 space-y-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Customer Details</h3>
                <div className="space-y-1">
                  <div className="font-semibold text-lg">{customerName}</div>
                  <div className="text-slate-600">{customerPhone}</div>
                  <div className="text-slate-600">{job.address}</div>
                  <div className="text-slate-600">{job.postcode}</div>
                </div>
              </div>
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Locksmith Details</h3>
                <div className="space-y-1">
                  <div className="font-semibold text-lg">{locksmithName}</div>
                  <div className="text-slate-600">{locksmithCompany}</div>
                  <div className="text-slate-600">Phone: {locksmithPhone}</div>
                  {locksmithRating && (
                    <div className="text-slate-600">Rating: {locksmithRating}/5.0</div>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">Job Details</h3>
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <span className="text-slate-500 text-sm">Problem Type:</span>
                    <div className="font-medium">{problemLabels[job.problemType] || job.problemType}</div>
                  </div>
                  <div>
                    <span className="text-slate-500 text-sm">Property Type:</span>
                    <div className="font-medium">{propertyLabels[job.propertyType] || job.propertyType}</div>
                  </div>
                </div>
                {job.description && (
                  <div>
                    <span className="text-slate-500 text-sm">Description:</span>
                    <div>{job.description}</div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Complete Timeline
              </h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-left px-4 py-2">Time</th>
                      <th className="text-left px-4 py-2">Event</th>
                      <th className="text-left px-4 py-2">GPS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="px-4 py-2 font-mono">{formatDate(job.createdAt)}</td>
                      <td className="px-4 py-2 font-mono">{formatTime(job.createdAt)}</td>
                      <td className="px-4 py-2">Request Submitted</td>
                      <td className="px-4 py-2 text-slate-500">
                        {job.requestGps ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.requestGps.lat.toFixed(4)}, {job.requestGps.lng.toFixed(4)}
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                    {job.acceptedAt && (
                      <tr className="border-t">
                        <td className="px-4 py-2 font-mono">{formatDate(job.acceptedAt)}</td>
                        <td className="px-4 py-2 font-mono">{formatTime(job.acceptedAt)}</td>
                        <td className="px-4 py-2">Job Accepted</td>
                        <td className="px-4 py-2 text-slate-500">
                          {job.acceptedGps ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.acceptedGps.lat.toFixed(4)}, {job.acceptedGps.lng.toFixed(4)}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    )}
                    {job.arrivedAt && (
                      <tr className="border-t">
                        <td className="px-4 py-2 font-mono">{formatDate(job.arrivedAt)}</td>
                        <td className="px-4 py-2 font-mono">{formatTime(job.arrivedAt)}</td>
                        <td className="px-4 py-2">Locksmith Arrived</td>
                        <td className="px-4 py-2 text-slate-500">
                          {job.arrivalGps ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.arrivalGps.lat.toFixed(4)}, {job.arrivalGps.lng.toFixed(4)}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    )}
                    {job.diagnosedAt && (
                      <tr className="border-t">
                        <td className="px-4 py-2 font-mono">{formatDate(job.diagnosedAt)}</td>
                        <td className="px-4 py-2 font-mono">{formatTime(job.diagnosedAt)}</td>
                        <td className="px-4 py-2">Quote Sent {job.quote && `(£${job.quote.total.toFixed(2)})`}</td>
                        <td className="px-4 py-2 text-slate-500">
                          {job.quoteGps ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.quoteGps.lat.toFixed(4)}, {job.quoteGps.lng.toFixed(4)}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    )}
                    {job.workStartedAt && (
                      <tr className="border-t">
                        <td className="px-4 py-2 font-mono">{formatDate(job.workStartedAt)}</td>
                        <td className="px-4 py-2 font-mono">{formatTime(job.workStartedAt)}</td>
                        <td className="px-4 py-2">Work Started</td>
                        <td className="px-4 py-2 text-slate-500">
                          {job.workStartedGps ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.workStartedGps.lat.toFixed(4)}, {job.workStartedGps.lng.toFixed(4)}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    )}
                    {job.workCompletedAt && (
                      <tr className="border-t">
                        <td className="px-4 py-2 font-mono">{formatDate(job.workCompletedAt)}</td>
                        <td className="px-4 py-2 font-mono">{formatTime(job.workCompletedAt)}</td>
                        <td className="px-4 py-2">Work Completed</td>
                        <td className="px-4 py-2 text-slate-500">
                          {job.completionGps ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.completionGps.lat.toFixed(4)}, {job.completionGps.lng.toFixed(4)}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    )}
                    {job.signedAt && (
                      <tr className="border-t">
                        <td className="px-4 py-2 font-mono">{formatDate(job.signedAt)}</td>
                        <td className="px-4 py-2 font-mono">{formatTime(job.signedAt)}</td>
                        <td className="px-4 py-2">Customer Signed</td>
                        <td className="px-4 py-2 text-slate-500">
                          {job.signatureGps ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {job.signatureGps.lat.toFixed(4)}, {job.signatureGps.lng.toFixed(4)}
                            </span>
                          ) : "-"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {job.quote && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  <FileText className="w-4 h-4 inline mr-1" />
                  Itemised Invoice
                </h3>
                <div className="border rounded-lg p-4">
                  {job.quote.defect && (
                    <div className="mb-3 pb-3 border-b">
                      <div className="text-sm text-slate-500">Diagnostic:</div>
                      <div>{job.quote.defect}</div>
                    </div>
                  )}

                  <div className="mb-3">
                    <div className="text-sm text-slate-500">Lock Type:</div>
                    <div>{job.quote.lockType}</div>
                  </div>

                  {job.quote.parts && job.quote.parts.length > 0 && (
                    <table className="w-full text-sm mb-4">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Part</th>
                          <th className="text-center py-2">Qty</th>
                          <th className="text-right py-2">Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {job.quote.parts.map((part, i) => (
                          <tr key={i} className="border-b">
                            <td className="py-2">{part.name}</td>
                            <td className="text-center py-2">{part.quantity}</td>
                            <td className="text-right py-2">£{(part.unitPrice * part.quantity).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Labour</span>
                      <span>£{job.quote.labourCost?.toFixed(2) || '0.00'}</span>
                    </div>
                    {job.quote.partsTotal > 0 && (
                      <div className="flex justify-between">
                        <span>Parts Total</span>
                        <span>£{job.quote.partsTotal.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Subtotal</span>
                      <span>£{job.quote.subtotal?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT (20%)</span>
                      <span>£{job.quote.vat?.toFixed(2) || '0.00'}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t">
                      <span>Total</span>
                      <span className="text-orange-600">£{job.quote.total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {job.signature && (
              <div>
                <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Digital Signature
                </h3>
                <div className="border rounded-lg p-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="border-2 border-slate-300 rounded-lg h-24 bg-slate-50 flex items-center justify-center mb-2">
                        <span className="italic text-slate-600">Digitally Signed</span>
                      </div>
                      <div className="text-center">
                        <div className="font-semibold">{job.signature.signerName}</div>
                        <div className="text-sm text-slate-500">
                          Signed at {formatTime(job.signature.signedAt)}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Customer confirms:</div>
                      {job.signature.confirmsWork && (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          Work completed as described
                        </div>
                      )}
                      {job.signature.confirmsPrice && (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          Price as quoted
                        </div>
                      )}
                      {job.signature.confirmsSatisfied && (
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          Satisfied with service
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t pt-6 text-xs text-slate-500 text-center">
              <p className="mb-2">
                This document is an official record of services provided by a LockSafe verified locksmith.
                All timestamps are recorded automatically and GPS coordinates are captured at key events.
              </p>
              <p>
                Generated: {new Date().toLocaleString()} |
                Job: {job.jobNumber} |
                Report: {reportNumber}
              </p>
              <p className="mt-2 font-medium">
                {SITE_NAME} - {SITE_URL.replace('https://', 'www.')} - {SUPPORT_PHONE}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
