"use client";

import { useState } from "react";
import { X, Check, Shield, Eye, FileText, ThumbsUp, ArrowRight, PoundSterling, Users } from "lucide-react";
import Link from "next/link";

interface PriceGuaranteeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCTAClick?: () => void;
}

export function PriceGuaranteeModal({ isOpen, onClose, onCTAClick }: PriceGuaranteeModalProps) {
  const [activeTab, setActiveTab] = useState<"guarantee" | "process">("guarantee");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="bg-emerald-600 px-4 py-4 text-center">
          <Shield className="w-8 h-8 text-white mx-auto mb-2" />
          <h2 className="text-lg font-bold text-white">Our Transparency Promise</h2>
          <p className="text-emerald-100 text-xs mt-1">You're ALWAYS in control</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 text-sm">
          <button
            onClick={() => setActiveTab("guarantee")}
            className={`flex-1 py-2 font-medium ${
              activeTab === "guarantee" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-slate-500"
            }`}
          >
            Guarantee
          </button>
          <button
            onClick={() => setActiveTab("process")}
            className={`flex-1 py-2 font-medium ${
              activeTab === "process" ? "text-emerald-600 border-b-2 border-emerald-600" : "text-slate-500"
            }`}
          >
            How It Works
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "guarantee" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Eye className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-slate-900">Upfront Fee</h4>
                  <p className="text-xs text-slate-600">See assessment fee BEFORE booking</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-slate-900">YOU Choose</h4>
                  <p className="text-xs text-slate-600">Compare price, ETA & reviews</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-slate-900">Quote First</h4>
                  <p className="text-xs text-slate-600">Full quote before work starts</p>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <ThumbsUp className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <h4 className="font-medium text-sm text-slate-900">No Pressure</h4>
                  <p className="text-xs text-slate-600">Decline the quote - only pay assessment</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {["Submit request (free)", "Compare offers", "Pay assessment", "Review quote", "Accept or decline"].map((step, i) => (
                <div key={step} className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {i + 1}
                  </div>
                  <span className="text-sm text-slate-700">{step}</span>
                </div>
              ))}

              <div className="mt-3 p-2.5 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-1.5 mb-1">
                  <PoundSterling className="w-3 h-3 text-slate-500" />
                  <span className="text-xs font-medium text-slate-600">Typical Costs</span>
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span className="text-slate-500">Assessment: <strong className="text-slate-700">£25-49</strong></span>
                  <span className="text-slate-500">Lockout: <strong className="text-slate-700">£60-120</strong></span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <Link
            href="/request"
            onClick={() => { onCTAClick?.(); onClose(); }}
            className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg text-sm text-center"
          >
            Get Free Quote <ArrowRight className="w-4 h-4 inline ml-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}
