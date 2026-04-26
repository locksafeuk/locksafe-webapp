import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, MapPin, Star, CheckCircle2, FileText, Scale, Phone } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white py-12 md:py-20">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-100 rounded-full blur-3xl opacity-50" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-100 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="section-container relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div className="space-y-8">
            {/* Mobile-Only Floating Phone Number */}
            <div className="md:hidden flex justify-center -mt-4 mb-2">
              <a
                href="tel:07818333989"
                className="flex items-center justify-center gap-3 text-slate-900"
              >
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">Call Now - Free Support</span>
                  <span className="text-3xl font-bold text-slate-900 tracking-tight">07818 333 989</span>
                </div>
              </a>
            </div>

            {/* Category Badge - NEW: Explicit category ownership */}
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-full px-4 py-2 text-sm font-medium text-orange-700">
              <Shield className="w-4 h-4" />
              UK's First Anti-Fraud Locksmith Platform
            </div>

            {/* Main heading - UPDATED: Category-creating headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
              <span className="text-slate-900">The Only Platform That</span>
              <br />
              <span className="text-orange-500">Prevents Price Scams</span>
            </h1>

            {/* Subheading - UPDATED: Lead with legal protection */}
            <p className="text-lg md:text-xl text-slate-600 max-w-lg">
              <strong>Every job creates a legally-binding digital paper trail.</strong>{" "}
              GPS tracking, timestamped photos, digital signatures, and instant PDF reports.
              Your word is never against theirs again.
            </p>

            {/* Key promises - UPDATED: Emphasize protection guarantees */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 text-slate-700 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5">
                <Scale className="w-5 h-5 text-green-600 flex-shrink-0" />
                <span className="font-medium">Legally-binding documentation on every job</span>
              </div>
              <div className="flex items-center gap-3 text-slate-700 bg-blue-50 border border-blue-100 rounded-lg px-4 py-2.5">
                <Shield className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span className="font-medium">Auto-refund if locksmith doesn't arrive on time</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>All locksmiths verified, insured & background-checked</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>See the full quote BEFORE work starts - accept or decline</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <span>GPS tracking, photos & PDF report - your anti-fraud shield</span>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/request">
                <Button className="btn-primary text-lg px-8 py-6">
                  Get Emergency Help
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" className="px-8 py-6 text-lg rounded-full border-slate-300 hover:bg-slate-50">
                  See How It Works
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap gap-6 pt-4">
              <div className="flex items-center gap-2 text-slate-600">
                <Clock className="w-5 h-5 text-orange-500" />
                <span className="font-medium">15-30 min response</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <MapPin className="w-5 h-5 text-orange-500" />
                <span className="font-medium">UK-Wide</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
                <span className="font-medium">4.9/5 Rating</span>
              </div>
            </div>
          </div>

          {/* Right Content - Phone Mockups */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative">
              {/* Main phone */}
              <div className="relative z-10 bg-slate-900 rounded-[3rem] p-3 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="bg-white rounded-[2.5rem] overflow-hidden w-[280px] md:w-[320px]">
                  {/* Phone notch */}
                  <div className="bg-slate-900 h-8 flex items-center justify-center">
                    <div className="w-20 h-5 bg-black rounded-full" />
                  </div>
                  {/* App screen */}
                  <div className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 text-white" stroke="currentColor" strokeWidth="2">
                          <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                        </svg>
                      </div>
                      <span className="font-bold text-slate-900">LockSafe</span>
                    </div>

                    {/* Legal Documentation Mockup - NEW */}
                    <div className="text-center py-2">
                      <div className="text-sm font-semibold text-slate-700">Your Legal Protection</div>
                      <div className="text-xs text-slate-500">Every job fully documented</div>
                    </div>

                    <div className="space-y-2">
                      {/* GPS Verified */}
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-200">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 text-sm">GPS Verified</div>
                          <div className="text-xs text-green-600">Location captured</div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>

                      {/* Photos Documented */}
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-blue-600" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <circle cx="8.5" cy="8.5" r="1.5" />
                            <path d="M21 15l-5-5L5 21" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 text-sm">Photos</div>
                          <div className="text-xs text-blue-600">Before & after</div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      </div>

                      {/* Digital Signature */}
                      <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
                        <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                          <FileText className="w-4 h-4 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-slate-900 text-sm">Digital Signature</div>
                          <div className="text-xs text-purple-600">Legally binding</div>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-purple-500" />
                      </div>
                    </div>

                    <div className="text-center pt-2">
                      <div className="text-xs text-slate-500 font-medium">PDF Report Generated</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary phone (behind) */}
              <div className="absolute top-8 -left-16 z-0 bg-slate-800 rounded-[3rem] p-3 shadow-xl transform -rotate-6 hidden md:block">
                <div className="bg-white rounded-[2.5rem] overflow-hidden w-[240px]">
                  <div className="bg-slate-900 h-8 flex items-center justify-center">
                    <div className="w-20 h-5 bg-black rounded-full" />
                  </div>
                  <div className="p-4 space-y-3">
                    <div className="text-center py-2">
                      <div className="text-lg font-semibold text-slate-900">Your Decision</div>
                      <div className="text-sm text-slate-500">Quote for approval</div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-600">Parts (cylinder)</span>
                        <span className="font-semibold">£85</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-600">Labour (35 min)</span>
                        <span className="font-semibold">£75</span>
                      </div>
                      <div className="flex justify-between py-2 text-lg">
                        <span className="font-semibold text-slate-900">Total</span>
                        <span className="font-bold text-orange-600">£160</span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button type="button" className="flex-1 bg-green-500 text-white py-2 rounded-lg text-sm font-medium">
                        Accept
                      </button>
                      <button type="button" className="flex-1 bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-medium">
                        Decline
                      </button>
                    </div>

                    <div className="text-center">
                      <div className="text-xs text-slate-500">Decline = pay assessment only</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
