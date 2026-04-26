import { CheckCircle2, AlertCircle, Info, Phone, ArrowRight, Shield, Clock, PoundSterling } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const pricingTiers = [
  {
    step: "1",
    title: "Assessment Fee",
    subtitle: "Call-out & Diagnostic",
    price: "£25-49",
    priceNote: "Typical range",
    description: "This is NOT for any work. It covers the locksmith's travel to you and time to inspect the problem. You see this price upfront before you book.",
    includes: [
      "Locksmith travels to your location",
      "On-site inspection of the problem",
      "Professional diagnosis",
      "Detailed quote for actual work",
    ],
    highlight: "You pay this to confirm your booking. If you decline the work quote, this is all you pay.",
    color: "orange",
  },
  {
    step: "2",
    title: "Work Quote",
    subtitle: "The Actual Job",
    price: "Varies",
    priceNote: "Based on job complexity",
    description: "After diagnosing your problem, the locksmith provides a detailed quote for the work. You see exact costs BEFORE any work begins.",
    includes: [
      "Itemised parts breakdown",
      "Labour costs clearly stated",
      "No hidden charges",
      "Assessment fee deducted from total",
    ],
    highlight: "You can ACCEPT or DECLINE. Decline = you only pay the assessment fee. No pressure.",
    color: "green",
  },
];

const commonServices = [
  { service: "Emergency lockout (standard lock)", price: "£60 - £120", time: "15-30 min" },
  { service: "Lock replacement (cylinder)", price: "£80 - £150", time: "20-40 min" },
  { service: "Lock replacement (mortice)", price: "£120 - £200", time: "30-60 min" },
  { service: "Anti-snap lock upgrade", price: "£90 - £180", time: "25-45 min" },
  { service: "uPVC door lock repair", price: "£70 - £140", time: "20-45 min" },
  { service: "Safe opening", price: "£150 - £400", time: "30-90 min" },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-16 md:py-24 bg-white">
      <div className="section-container">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
            <PoundSterling className="w-4 h-4" />
            TRANSPARENT PRICING
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            Know Exactly What You'll Pay
          </h2>
          <p className="text-lg text-slate-600">
            No surprises. No hidden fees. Two simple steps with full transparency at each stage.
          </p>
        </div>

        {/* Assessment Fee Explainer - PROMINENT */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-orange-200 rounded-2xl p-6 md:p-8 mb-12">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Info className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl md:text-2xl font-bold text-slate-900 mb-2">
                What is the Assessment Fee?
              </h3>
              <p className="text-slate-700 text-lg mb-4">
                <strong className="text-orange-600">Assessment Fee = Call-out + Diagnostic ONLY.</strong>{" "}
                This covers the locksmith's travel to your location and time to inspect the problem.
                It is <strong>NOT</strong> payment for any repair work.
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600">Shown upfront before you book</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600">Typically £25-49 depending on location</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600">Deducted from final work quote</span>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600">Refundable if locksmith doesn't arrive</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Step Pricing Visual */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {pricingTiers.map((tier) => (
            <div
              key={tier.step}
              className={`relative rounded-2xl p-6 md:p-8 border-2 ${
                tier.color === "orange"
                  ? "bg-orange-50/50 border-orange-200"
                  : "bg-green-50/50 border-green-200"
              }`}
            >
              {/* Step number */}
              <div className={`absolute -top-4 left-6 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                tier.color === "orange" ? "bg-orange-500" : "bg-green-500"
              }`}>
                {tier.step}
              </div>

              <div className="mt-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{tier.title}</h3>
                    <p className={`text-sm font-medium ${
                      tier.color === "orange" ? "text-orange-600" : "text-green-600"
                    }`}>{tier.subtitle}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">{tier.price}</div>
                    <div className="text-xs text-slate-500">{tier.priceNote}</div>
                  </div>
                </div>

                <p className="text-slate-600 mb-4">{tier.description}</p>

                <ul className="space-y-2 mb-4">
                  {tier.includes.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                      <CheckCircle2 className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        tier.color === "orange" ? "text-orange-500" : "text-green-500"
                      }`} />
                      {item}
                    </li>
                  ))}
                </ul>

                <div className={`p-3 rounded-lg ${
                  tier.color === "orange" ? "bg-orange-100" : "bg-green-100"
                }`}>
                  <p className={`text-sm font-medium ${
                    tier.color === "orange" ? "text-orange-800" : "text-green-800"
                  }`}>
                    {tier.highlight}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Flow Arrow - Mobile Hidden */}
        <div className="hidden md:flex justify-center items-center mt-6 mb-12">
          <div className="bg-white border-2 border-green-300 rounded-full px-6 py-3 shadow-sm">
            <span className="text-green-700 font-semibold">Then you decide: Accept or Decline</span>
          </div>
        </div>

        {/* Common Service Prices */}
        <div className="bg-slate-50 rounded-2xl p-6 md:p-8 mb-12">
          <h3 className="text-xl font-bold text-slate-900 mb-2 text-center">
            Typical Work Prices
          </h3>
          <p className="text-slate-600 text-center mb-6">
            Indicative prices only. Your actual quote depends on lock type, time of day, and complexity.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {commonServices.map((item) => (
              <div key={item.service} className="bg-white rounded-xl p-4 border border-slate-200">
                <div className="font-medium text-slate-900 mb-2">{item.service}</div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-green-600 font-semibold">
                    <PoundSterling className="w-4 h-4" />
                    {item.price}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    <Clock className="w-3 h-3" />
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            * Prices may be higher for out-of-hours, weekends, and bank holidays. Always shown upfront.
          </p>
        </div>

        {/* No Hidden Fees Guarantee */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 md:p-8 text-white mb-12">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="w-20 h-20 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-10 h-10 text-white" />
            </div>
            <div className="text-center md:text-left flex-1">
              <h3 className="text-2xl font-bold mb-2">No Hidden Fees. Ever.</h3>
              <p className="text-white/80">
                What you see is what you pay. The work quote is binding - no "extra charges" after the fact.
                If the locksmith tries to charge more than quoted, report it and we'll intervene.
              </p>
            </div>
            <Link href="/refund-policy" className="flex-shrink-0">
              <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 bg-transparent">
                View Refund Policy
              </Button>
            </Link>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center">
          <p className="text-slate-600 mb-4">
            Ready to get help? See real prices from verified locksmiths in your area.
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
      </div>
    </section>
  );
}
