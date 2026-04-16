"use client";

import { useState } from "react";
import {
  MapPin,
  UserCheck,
  Clock,
  Search,
  FileText,
  CheckCircle2,
  Wrench,
  PenTool,
  FileCheck,
  Hand,
} from "lucide-react";

const steps = [
  {
    number: "1",
    icon: MapPin,
    title: "Submit Request",
    description: "Enter your location and describe your lock problem. No payment, no commitment.",
    detail: "Free to submit. Enter your postcode, describe the issue, add photos if you want. Multiple locksmiths will see your request.",
    color: "bg-orange-500",
    isCustomerControl: false,
  },
  {
    number: "2",
    icon: UserCheck,
    title: "YOU Choose Your Locksmith",
    description: "Compare locksmiths by their fee, ETA, rating, and reviews. Pick who YOU want.",
    detail: "Each locksmith sets their own assessment fee (typically £25-49). This is their call-out + diagnostic fee only - shown upfront before you commit. YOU choose who to book.",
    color: "bg-green-500",
    isCustomerControl: true,
  },
  {
    number: "3",
    icon: Clock,
    title: "Arrival Confirmed",
    description: "When the locksmith arrives, they check in with GPS and timestamp verification.",
    detail: "Locksmith presses ARRIVED. Platform saves: GPS coordinates, timestamp, device ID. Full accountability.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
  {
    number: "4",
    icon: Search,
    title: "Real Diagnostic",
    description: "Locksmith inspects and documents the lock type, defect, and required parts.",
    detail: "Inputs: lock type, defect, needed parts, difficulty level. Takes photos: before, interior, lock serial.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
  {
    number: "5",
    icon: FileText,
    title: "Instant Quote",
    description: "Receive a detailed quote on your phone with complete breakdown of costs.",
    detail: "Example: Broken cylinder | Parts: £85 | Labour: £75 | Total: £160 | Time: 35 min. All itemised, nothing hidden.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
  {
    number: "6",
    icon: Hand,
    title: "YOU Decide: Accept or Decline",
    description: "Review the work quote. Accept to proceed, or decline and only pay the assessment fee.",
    detail: "YOUR choice. Decline? You've only paid the assessment fee, job closed - no pressure. Accept? Work begins immediately.",
    color: "bg-green-500",
    isCustomerControl: true,
  },
  {
    number: "7",
    icon: Wrench,
    title: "Work Execution",
    description: "Locksmith performs the work with START/FINISH timestamps and final photos.",
    detail: "Locksmith presses START WORK → completes job → presses FINISH WORK → takes final photos. All recorded.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
  {
    number: "8",
    icon: PenTool,
    title: "YOU Confirm & Sign",
    description: "Sign digitally to confirm work completion, price, and satisfaction.",
    detail: "YOUR final approval. Review everything, then sign digitally: confirms work done, confirms price, confirms satisfaction.",
    color: "bg-green-500",
    isCustomerControl: true,
  },
  {
    number: "9",
    icon: FileCheck,
    title: "Legal PDF Report",
    description: "Instant PDF with complete timeline, GPS, photos, signature. Your anti-fraud shield.",
    detail: "Your protection: complete timeline, GPS logs, all photos, digital signature, price breakdown, locksmith details. Instant download.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-slate-50">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-full px-4 py-2 text-sm font-medium mb-4">
            YOU'RE IN CONTROL
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            From request to report, every step is tracked.
            <span className="font-semibold text-green-600"> Green steps = YOUR decision points.</span>
          </p>
        </div>

        {/* Steps grid - Mobile: vertical, Desktop: 3x3 grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={`relative p-6 rounded-2xl cursor-pointer transition-all duration-300 ${
                activeStep === index
                  ? step.isCustomerControl
                    ? "bg-green-50 border-2 border-green-400 shadow-lg"
                    : "step-card-active shadow-lg"
                  : step.isCustomerControl
                    ? "bg-green-50/50 border border-green-200 hover:shadow-md"
                    : "step-card hover:shadow-md"
              }`}
              onClick={() => setActiveStep(index)}
              onKeyDown={(e) => e.key === 'Enter' && setActiveStep(index)}
              tabIndex={0}
              role="button"
            >
              {/* Step number badge */}
              <div
                className={`absolute -top-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${step.color}`}
              >
                {step.number}
              </div>

              {/* Customer control badge */}
              {step.isCustomerControl && (
                <div className="absolute -top-3 right-4 bg-green-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                  YOUR CHOICE
                </div>
              )}

              <div className="flex items-start gap-4">
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    activeStep === index
                      ? step.isCustomerControl ? "bg-green-500 text-white" : "bg-orange-500 text-white"
                      : step.isCustomerControl ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  <step.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3
                    className={`font-bold text-lg mb-1 ${
                      activeStep === index
                        ? step.isCustomerControl ? "text-green-700" : "text-orange-600"
                        : "text-slate-900"
                    }`}
                  >
                    {step.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {activeStep === index ? step.detail : step.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-slate-600 mb-4">
            This complete digital trail is your anti-fraud shield
          </p>
          <div className="inline-flex items-center gap-2 text-orange-600 font-semibold">
            <FileCheck className="w-5 h-5" />
            Every job creates a legally binding PDF report
          </div>
        </div>
      </div>
    </section>
  );
}
