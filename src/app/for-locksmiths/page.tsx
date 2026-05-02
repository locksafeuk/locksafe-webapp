import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { LocksmithSignupCTAButton } from "@/components/onboarding/LocksmithSignupCTAButton";
import { Button } from "@/components/ui/button";
import { SITE_NAME, getFullUrl } from "@/lib/config";
import {
  ArrowRight,
  Award,
  CheckCircle2,
  Clock,
  FileCheck,
  MapPin,
  Phone,
  PoundSterling,
  Shield,
  Star,
  TrendingUp,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: `For Locksmiths | ${SITE_NAME} - Join Our Platform`,
  description:
    "Join the UK's most trusted locksmith platform. Get verified leads, set your own prices, and build your reputation with our anti-fraud system. No monthly fees. Only pay when you win a job.",
  keywords: [
    "locksmith jobs UK",
    "join locksmith platform",
    "locksmith leads",
    "verified locksmith",
    "locksmith sign up",
  ],
  openGraph: {
    title: `Grow Your Locksmith Business | ${SITE_NAME}`,
    description:
      "Verified leads, transparent platform, no monthly fees. Join the UK's first anti-fraud locksmith network.",
    url: getFullUrl("/for-locksmiths"),
  },
};

const benefits = [
  {
    icon: Users,
    title: "Verified Customer Leads",
    description:
      "Every customer request is genuine. No tyre-kickers, no fake enquiries. Real people with real lock problems in your area.",
  },
  {
    icon: PoundSterling,
    title: "Set Your Own Prices",
    description:
      "You decide your assessment fee and work rates. No platform-imposed pricing. Keep what you earn.",
  },
  {
    icon: Shield,
    title: "Fraud Protection Works Both Ways",
    description:
      "Our digital paper trail protects you too. GPS logs, customer signatures, and timestamped evidence prevent false claims.",
  },
  {
    icon: Star,
    title: "Build Your Reputation",
    description:
      "Earn verified reviews and build a trusted profile. High-rated locksmiths get more jobs and can charge premium rates.",
  },
  {
    icon: MapPin,
    title: "Jobs in Your Area",
    description:
      "Only receive requests within your chosen service radius. No wasted travel, no jobs outside your patch.",
  },
  {
    icon: FileCheck,
    title: "Professional Documentation",
    description:
      "Every job generates a professional PDF report. Looks great, protects you legally, and impresses customers.",
  },
];

const howItWorks = [
  {
    step: "1",
    title: "Apply & Get Verified",
    description:
      "Submit your application with qualifications, insurance details, and DBS certificate. We verify everything before you go live.",
  },
  {
    step: "2",
    title: "Set Your Profile",
    description:
      "Define your service area, set your assessment fee, list your specialties, and add your availability.",
  },
  {
    step: "3",
    title: "Receive & Accept Jobs",
    description:
      "Get notified of customer requests in your area. Review the details and decide which jobs to accept.",
  },
  {
    step: "4",
    title: "Complete & Get Paid",
    description:
      "Do what you do best. Our platform handles documentation, customer signatures, and payment processing.",
  },
];

const stats = [
  { value: "500+", label: "Active Locksmiths" },
  { value: "15min", label: "Avg. Response Time" },
  { value: "4.8/5", label: "Customer Rating" },
  { value: "£0", label: "Monthly Fees" },
];

export default function ForLocksmithsPage() {
  return (
    <>
      <Header />
      <main>
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
          <div className="section-container">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-400 rounded-full px-4 py-2 text-sm font-medium mb-4">
                <Wrench className="w-4 h-4" />
                FOR LOCKSMITH PROFESSIONALS
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6">
                Grow Your Business with{" "}
                <span className="text-orange-500">LockSafe</span>
              </h1>
              <p className="text-lg text-slate-300 mb-8">
                Join the UK's first anti-fraud locksmith platform. Get verified
                leads, set your own prices, and build a trusted reputation. No
                monthly fees — ever.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <LocksmithSignupCTAButton className="btn-primary px-8 text-lg">
                  Apply Now
                  <ArrowRight className="w-5 h-5" />
                </LocksmithSignupCTAButton>
                <a href="tel:07818333989">
                  <Button
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 bg-transparent px-8"
                  >
                    <Phone className="w-4 h-4" />
                    Talk to Us
                  </Button>
                </a>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-orange-500">
                    {stat.value}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="py-16 md:py-24 bg-white">
          <div className="section-container">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Why Locksmiths Choose LockSafe
              </h2>
              <p className="text-lg text-slate-600">
                We built this platform to help honest, skilled locksmiths thrive
                — not the cowboys.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {benefits.map((benefit) => (
                <div
                  key={benefit.title}
                  className="bg-slate-50 rounded-2xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mb-4">
                    <benefit.icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 bg-slate-50">
          <div className="section-container">
            <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
              How to Get Started
            </h2>
            <div className="grid md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {howItWorks.map((item) => (
                <div key={item.step} className="text-center">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold text-lg">
                    {item.step}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Requirements */}
        <section className="py-16 bg-white">
          <div className="section-container">
            <div className="max-w-2xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-900 text-center mb-8">
                Requirements to Join
              </h2>
              <div className="bg-slate-50 rounded-2xl p-8">
                <ul className="space-y-4">
                  {[
                    "Valid locksmith qualifications (City & Guilds, or equivalent)",
                    "Public liability insurance (minimum £2 million)",
                    "Enhanced DBS check (within last 3 years)",
                    "Proof of trading address",
                    "Two professional references",
                    "Commitment to transparent pricing",
                  ].map((req) => (
                    <li key={req} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-slate-700">{req}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-slate-500 mt-6">
                  We reject approximately 70% of applicants to maintain the
                  highest standards. This protects you and your customers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
          <div className="section-container text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Join the Network?
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Apply now and start receiving verified leads in your area. No
              monthly fees, no commitments.
            </p>
            <LocksmithSignupCTAButton className="bg-white text-orange-600 hover:bg-slate-100 px-8 text-lg font-bold">
              Apply Now
              <ArrowRight className="w-5 h-5" />
            </LocksmithSignupCTAButton>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
