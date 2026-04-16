"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SignaturePad } from "@/components/signature/SignaturePad";
import {
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  Download,
  ArrowLeft,
  Shield,
} from "lucide-react";

// Mock job data for demo
const mockJob = {
  id: "1",
  jobNumber: "LS-202602-0001",
  customer: { name: "Sarah Mitchell", phone: "07700 900123" },
  address: "10 Downing Street, London SW1A 1AA",
  quote: {
    lockType: "Euro Cylinder",
    defect: "Snapped key in lock",
    parts: [{ name: "Euro Cylinder TS007 3*", quantity: 1, unitPrice: 65, total: 65 }],
    labourCost: 75,
    labourTime: 35,
    partsTotal: 65,
    subtotal: 140,
    vat: 28,
    total: 168,
  },
  timeline: [
    { time: "14:23", event: "Request submitted", status: "complete" },
    { time: "14:25", event: "Job accepted by Mike Thompson", status: "complete" },
    { time: "14:41", event: "Locksmith arrived (GPS verified)", status: "complete" },
    { time: "14:48", event: "Diagnostic completed", status: "complete" },
    { time: "14:50", event: "Quote accepted", status: "complete" },
    { time: "15:25", event: "Work completed", status: "complete" },
  ],
};

export default function JobCompletePage() {
  const params = useParams();
  const [isSigned, setIsSigned] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(null);

  const handleSignature = async (signature: string) => {
    setSignatureData(signature);
    setIsSigned(true);

    // Simulate report generation
    setIsGeneratingReport(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setReportUrl(`/api/reports/${params.id}/download`);
    setIsGeneratingReport(false);
  };

  if (isSigned) {
    return (
      <div className="min-h-screen bg-slate-50 py-8">
        <div className="section-container">
          <div className="max-w-xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>

              <h1 className="text-2xl font-bold text-slate-900 mb-2">
                Job Complete!
              </h1>
              <p className="text-slate-600 mb-6">
                Thank you for using LockSafe. Your legal documentation is ready.
              </p>

              {/* Job summary */}
              <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-500">Job Number</span>
                  <span className="font-mono font-medium">{mockJob.jobNumber}</span>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-slate-500">Total Paid</span>
                  <span className="text-xl font-bold text-green-600">
                    £{mockJob.quote.total.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Status</span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    Signed & Verified
                  </span>
                </div>
              </div>

              {/* Anti-fraud shield */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6">
                <div className="flex items-center gap-3 text-orange-700">
                  <Shield className="w-6 h-6" />
                  <div className="text-left">
                    <div className="font-semibold">Anti-Fraud Protection Active</div>
                    <div className="text-sm text-orange-600">
                      Complete timeline, GPS logs, and photos saved
                    </div>
                  </div>
                </div>
              </div>

              {/* Download Report */}
              {isGeneratingReport ? (
                <div className="flex items-center justify-center gap-3 py-4 text-slate-600">
                  <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  Generating legal report...
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white py-6"
                    onClick={() => window.open(`/job/${params.id}/report`, "_blank")}
                  >
                    <Download className="w-5 h-5 mr-2" />
                    Download PDF Report
                  </Button>

                  <p className="text-xs text-slate-500">
                    This report is your legal proof of service. Keep it for your records.
                  </p>
                </div>
              )}

              <Link href="/" className="block mt-6">
                <Button variant="outline" className="w-full">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="section-container py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-bold text-slate-900">Complete Job</h1>
              <p className="text-sm text-slate-500">{mockJob.jobNumber}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="section-container py-6">
        <div className="max-w-xl mx-auto space-y-6">
          {/* Job Summary */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Job Summary</h2>

            <div className="space-y-3 mb-4">
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span>{mockJob.address}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>
                  {mockJob.quote.lockType} - {mockJob.quote.defect}
                </span>
              </div>
            </div>

            {/* Quote breakdown */}
            <div className="border-t pt-4 space-y-2">
              {mockJob.quote.parts.map((part, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-slate-600">
                    {part.name} x{part.quantity}
                  </span>
                  <span>£{part.total.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Labour ({mockJob.quote.labourTime} min)</span>
                <span>£{mockJob.quote.labourCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-slate-600">VAT (20%)</span>
                <span>£{mockJob.quote.vat.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg pt-2">
                <span>Total</span>
                <span className="text-orange-600">£{mockJob.quote.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="font-semibold text-slate-900 mb-4">Job Timeline</h2>

            <div className="space-y-3">
              {mockJob.timeline.map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 text-xs text-slate-500 font-mono">{item.time}</div>
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-sm">{item.event}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Signature */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <SignaturePad
              onSave={handleSignature}
              signerName={mockJob.customer.name}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
