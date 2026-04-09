import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SITE_NAME, getFullUrl } from "@/lib/config";
import {
  PoundSterling,
  CheckCircle2,
  Info,
  Shield,
  Clock,
  ArrowRight,
  Phone,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

export const metadata: Metadata = {
  title: `Transparent Pricing | ${SITE_NAME} - No Hidden Fees`,
  description:
    "See exactly what you'll pay before any work begins. Assessment fees from £25-49, work quotes provided on-site. No surprises, no hidden charges. Full breakdown of locksmith costs.",
  keywords: [
    "locksmith prices UK",
    "emergency locksmith cost",
    "locksmith call out fee",
    "lock change price",
    "transparent locksmith pricing",
  ],
  openGraph: {
    title: `Honest Locksmith Pricing | ${SITE_NAME}`,
    description:
      "No surprises. No hidden fees. See the full price before any work begins.",
    url: getFullUrl("/pricing"),
  },
};

const commonPrices = [
  { service: "Emergency lockout (standard lock)", price: "£60 - £120", time: "15-30 min" },
  { service: "Lock replacement (cylinder)", price: "£80 - £150", time: "20-40 min" },
  { service: "Lock replacement (mortice)", price: "£120 - £200", time: "30-60 min" },
  { service: "Anti-snap lock upgrade", price: "£90 - £180", time: "25-45 min" },
  { service: "uPVC door lock repair", price: "£70 - £140", time: "20-45 min" },
  { service: "Safe opening", price: "£150 - £400", time: "30-90 min" },
  { service: "Window lock repair/replacement", price: "£50 - £100", time: "15-30 min" },
  { service: "Master key system (per lock)", price: "£30 - £60", time: "10-20 min" },
  { service: "Car lockout", price: "£80 - £150", time: "20-45 min" },
];

const faqs = [
  {
    q: "What is the assessment fee?",
    a: "The assessment fee (typically £25-49) covers the locksmith's travel to your location and time to inspect the problem. It is NOT payment for any repair work. You see this upfront before booking.",
  },
  {
    q: "What if I decline the work quote?",
    a: "You only pay the assessment fee. No work is done, no extra charges. You're free to walk away.",
  },
  {
    q: "Are there extra charges for evenings or weekends?",
    a: "Some locksmiths may charge a small premium for unsociable hours. This is always shown upfront in their assessment fee before you book.",
  },
  {
    q: "Is the assessment fee deducted from the work price?",
    a: "Yes. If you accept the work quote, the assessment fee you already paid is deducted from the total.",
  },
  {
    q: "What if the locksmith charges more than quoted?",
    a: "The work quote is binding. If a locksmith attempts to charge more, report it through the platform and we'll intervene. Our digital paper trail protects you.",
  },
];

export default function PricingPage() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white">
          <div className="section-container">
            <div className="text-center max-w-3xl mx-auto">
              <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
                <PoundSterling className="w-4 h-4" />
                TRANSPARENT PRICING
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
                Know What You'll Pay{" "}
                <span className="text-orange-500">Before Work Starts</span>
              </h1>
              <p className="text-lg text-slate-600">
                No surprises. No hidden fees. Two simple steps: a small assessment
                fee to get a locksmith to you, then a detailed quote you can
                accept or decline.
              </p>
            </div>
          </div>
        </section>

        {/* Two-Step Process */}
        <section className="py-16 bg-white">
          <div className="section-container">
            <div className="grid md:grid-cols-2 gap-8 mb-16">
              {/* Step 1 */}
              <div className="relative bg-orange-50/50 border-2 border-orange-200 rounded-2xl p-8">
                <div className="absolute -top-4 left-6 w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div className="mt-4">
                  <h2 className="text-xl font-bold text-slate-900 mb-1">
                    Assessment Fee
                  </h2>
                  <p className="text-orange-600 text-sm font-medium mb-4">
                    Call-out & Diagnostic
                  </p>
                  <div className="text-3xl font-bold text-slate-900 mb-4">
                    £25-49{" "}
                    <span className="text-sm font-normal text-slate-500">
                      typical range
                    </span>
                  </div>
                  <p className="text-slate-600 mb-4">
                    Covers the locksmith's travel and time to inspect your problem.
                    Shown upfront before you book.
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Locksmith travels to you",
                      "On-site problem inspection",
                      "Professional diagnosis",
                      "Detailed quote for the work",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-orange-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 p-3 bg-orange-100 rounded-lg">
                    <p className="text-sm font-medium text-orange-800">
                      Decline the work? This is all you pay.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative bg-green-50/50 border-2 border-green-200 rounded-2xl p-8">
                <div className="absolute -top-4 left-6 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div className="mt-4">
                  <h2 className="text-xl font-bold text-slate-900 mb-1">
                    Work Quote
                  </h2>
                  <p className="text-green-600 text-sm font-medium mb-4">
                    The Actual Job
                  </p>
                  <div className="text-3xl font-bold text-slate-900 mb-4">
                    Varies{" "}
                    <span className="text-sm font-normal text-slate-500">
                      based on job
                    </span>
                  </div>
                  <p className="text-slate-600 mb-4">
                    After diagnosis, you get an itemised quote. You see every cost
                    BEFORE work begins.
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Itemised parts breakdown",
                      "Labour costs clearly stated",
                      "No hidden charges",
                      "Assessment fee deducted from total",
                    ].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-700">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 p-3 bg-green-100 rounded-lg">
                    <p className="text-sm font-medium text-green-800">
                      Accept or decline - your choice, no pressure.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Common Prices Table */}
            <div className="bg-slate-50 rounded-2xl p-6 md:p-8 mb-16">
              <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">
                Typical Work Prices
              </h2>
              <p className="text-slate-600 text-center mb-8">
                Indicative prices only. Actual quotes depend on lock type, time,
                and complexity.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {commonPrices.map((item) => (
                  <div
                    key={item.service}
                    className="bg-white rounded-xl p-4 border border-slate-200"
                  >
                    <div className="font-medium text-slate-900 mb-2">
                      {item.service}
                    </div>
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
                * Prices may be higher for out-of-hours, weekends, and bank
                holidays. Always shown upfront.
              </p>
            </div>

            {/* No Hidden Fees */}
            <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-6 md:p-8 text-white mb-16">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-20 h-20 bg-green-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <div className="text-center md:text-left flex-1">
                  <h3 className="text-2xl font-bold mb-2">No Hidden Fees. Ever.</h3>
                  <p className="text-white/80">
                    The work quote is binding. If a locksmith tries to charge more
                    than quoted, report it and we'll intervene. Your digital paper
                    trail is your protection.
                  </p>
                </div>
                <Link href="/refund-policy" className="flex-shrink-0">
                  <Button
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 bg-transparent"
                  >
                    View Refund Policy
                  </Button>
                </Link>
              </div>
            </div>

            {/* FAQ */}
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
                Pricing FAQs
              </h2>
              <div className="space-y-4">
                {faqs.map((faq) => (
                  <div
                    key={faq.q}
                    className="bg-white border border-slate-200 rounded-xl p-6"
                  >
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-orange-500" />
                      {faq.q}
                    </h3>
                    <p className="text-slate-600 text-sm pl-7">{faq.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-slate-50">
          <div className="section-container text-center">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Ready to See Real Prices?
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Submit your request and get transparent quotes from verified
              locksmiths near you.
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
