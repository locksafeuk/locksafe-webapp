import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SITE_NAME, getFullUrl } from "@/lib/config";
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
  ArrowRight,
  Phone,
  Shield,
  ArrowDown,
} from "lucide-react";

export const metadata: Metadata = {
  title: `How It Works | ${SITE_NAME} - 9-Step Anti-Fraud Process`,
  description:
    "Discover how LockSafe protects you at every step. From submitting your request to receiving a legally-binding PDF report. GPS tracking, transparent quotes, and you're always in control.",
  keywords: [
    "how LockSafe works",
    "locksmith booking process",
    "anti-fraud locksmith",
    "locksmith GPS tracking",
    "transparent locksmith",
  ],
  openGraph: {
    title: `How LockSafe Works | ${SITE_NAME}`,
    description:
      "9 transparent steps from request to completion. You're always in control.",
    url: getFullUrl("/how-it-works"),
  },
};

const steps = [
  {
    number: "1",
    icon: MapPin,
    title: "Submit Your Request",
    description: "Enter your location and describe your lock problem. No payment required, no commitment.",
    detail: "Enter your postcode, describe the issue, and optionally add photos. Multiple verified locksmiths will see your request and can respond.",
    color: "bg-orange-500",
    isCustomerControl: false,
  },
  {
    number: "2",
    icon: UserCheck,
    title: "YOU Choose Your Locksmith",
    description: "Compare locksmiths by their assessment fee, ETA, rating, and reviews. Pick who YOU want.",
    detail: "Each locksmith sets their own assessment fee (typically £25-49). This is their call-out + diagnostic fee only — shown upfront before you commit. YOU choose who to book.",
    color: "bg-green-500",
    isCustomerControl: true,
  },
  {
    number: "3",
    icon: Clock,
    title: "Arrival Confirmed",
    description: "When the locksmith arrives, they check in with GPS and timestamp verification.",
    detail: "The locksmith presses ARRIVED on the platform. GPS coordinates, timestamp, and device ID are recorded. Full accountability from the first moment.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
  {
    number: "4",
    icon: Search,
    title: "Real Diagnostic",
    description: "The locksmith inspects and documents the lock type, defect, and required parts.",
    detail: "They record: lock type, defect found, parts needed, difficulty level. They take photos of the lock before work, interior, and serial numbers.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
  {
    number: "5",
    icon: FileText,
    title: "Instant Quote Delivered",
    description: "Receive a detailed, itemised quote on your phone with a complete breakdown of costs.",
    detail: "Example: Broken cylinder | Parts: £85 | Labour: £75 | Total: £160 | Est. Time: 35 min. All itemised, nothing hidden.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
  {
    number: "6",
    icon: Hand,
    title: "YOU Decide: Accept or Decline",
    description: "Review the work quote. Accept to proceed, or decline and only pay the assessment fee.",
    detail: "It's YOUR choice. Decline? You've only paid the assessment fee and the job is closed — no pressure. Accept? Work begins immediately.",
    color: "bg-green-500",
    isCustomerControl: true,
  },
  {
    number: "7",
    icon: Wrench,
    title: "Work Execution",
    description: "The locksmith performs the work with START/FINISH timestamps and takes final photos.",
    detail: "Locksmith presses START WORK, completes the job, presses FINISH WORK, and takes after photos. All timestamps are recorded on the platform.",
    color: "bg-slate-800",
    isCustomerControl: false,
  },
  {
    number: "8",
    icon: PenTool,
    title: "YOU Confirm & Sign",
    description: "Sign digitally to confirm work completion, the agreed price, and your satisfaction.",
    detail: "Your final approval. Review everything carefully, then sign digitally. This confirms the work was done, confirms the price, and confirms your satisfaction.",
    color: "bg-green-500",
    isCustomerControl: true,
  },
  {
    number: "9",
    icon: FileCheck,
    title: "Legal PDF Report Generated",
    description: "Instant PDF with complete timeline, GPS data, photos, digital signature, and price breakdown.",
    detail: "Your protection forever: complete timeline, GPS logs, all photos, your digital signature, full price breakdown, and locksmith details. Instant download.",
    color: "bg-orange-500",
    isCustomerControl: false,
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white">
          <div className="section-container">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-full px-4 py-2 text-sm font-medium mb-4">
                YOU'RE IN CONTROL
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
                How <span className="text-orange-500">LockSafe</span> Works
              </h1>
              <p className="text-lg text-slate-600 mb-4">
                From request to report, every step is tracked, documented, and
                transparent. No other platform gives you this level of control.
              </p>
              <p className="text-green-600 font-semibold">
                🟢 Green steps = YOUR decision points
              </p>
            </div>
          </div>
        </section>

        {/* Steps */}
        <section className="py-16 bg-white">
          <div className="section-container">
            <div className="max-w-3xl mx-auto space-y-6">
              {steps.map((step, index) => (
                <div key={step.number}>
                  <div
                    className={`relative rounded-2xl p-6 md:p-8 border-2 ${
                      step.isCustomerControl
                        ? "bg-green-50/50 border-green-200"
                        : "bg-white border-slate-200"
                    }`}
                  >
                    {/* Step number */}
                    <div
                      className={`absolute -top-4 left-6 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${step.color}`}
                    >
                      {step.number}
                    </div>

                    {/* Customer control badge */}
                    {step.isCustomerControl && (
                      <div className="absolute -top-3 right-6 bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                        YOUR CHOICE
                      </div>
                    )}

                    <div className="flex items-start gap-4 mt-2">
                      <div
                        className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          step.isCustomerControl
                            ? "bg-green-500 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <step.icon className="w-7 h-7" />
                      </div>
                      <div>
                        <h2
                          className={`text-xl font-bold mb-2 ${
                            step.isCustomerControl
                              ? "text-green-700"
                              : "text-slate-900"
                          }`}
                        >
                          {step.title}
                        </h2>
                        <p className="text-slate-600 mb-3">
                          {step.description}
                        </p>
                        <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                          {step.detail}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Arrow between steps */}
                  {index < steps.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ArrowDown className="w-5 h-5 text-slate-300" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Protection Summary */}
        <section className="py-16 bg-slate-900 text-white">
          <div className="section-container text-center">
            <Shield className="w-16 h-16 text-orange-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">
              Your Complete Anti-Fraud Shield
            </h2>
            <p className="text-slate-400 max-w-2xl mx-auto mb-8">
              Every job creates a legally-binding PDF report with GPS coordinates,
              timestamped photos, digital signatures, and a full price breakdown.
              No other locksmith platform offers this level of protection.
            </p>
            <div className="grid sm:grid-cols-3 gap-6 max-w-2xl mx-auto">
              {[
                { label: "GPS Tracked", desc: "Arrival location verified" },
                { label: "Timestamped", desc: "Every action logged" },
                { label: "Signed & Sealed", desc: "Digital signatures" },
              ].map((item) => (
                <div key={item.label}>
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <div className="font-bold">{item.label}</div>
                  <div className="text-sm text-slate-400">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-white">
          <div className="section-container text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Ready to Experience the Difference?
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Get connected with a verified locksmith and see our full anti-fraud
              system in action.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/request">
                <Button className="btn-primary px-8">
                  Get Emergency Help
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="tel:07818333989">
                <Button variant="outline" className="border-slate-300 px-8">
                  <Phone className="w-4 h-4" />
                  Call 07818 333 989
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
