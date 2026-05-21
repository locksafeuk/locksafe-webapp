import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Phone,
  Scale,
  Shield,
  Star,
  Wrench,
} from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SITE_URL, SITE_NAME, SUPPORT_PHONE } from "@/lib/config";

export const metadata: Metadata = {
  title: `Get a Locksmith Quote in Minutes | Verified UK Locksmiths | ${SITE_NAME}`,
  description:
    "Get a transparent, no-obligation locksmith quote in minutes. Verified, insured UK locksmiths. See the price BEFORE work starts. Average response 15-30 minutes, 24/7.",
  keywords: [
    "locksmith quote",
    "free locksmith quote",
    "emergency locksmith near me",
    "24 hour locksmith",
    "locked out locksmith",
    "uk locksmith price",
  ],
  openGraph: {
    title: `Get a Locksmith Quote | ${SITE_NAME}`,
    description:
      "Verified UK locksmiths. Transparent pricing. See the quote before any work starts. 15-30 min response 24/7.",
    url: `${SITE_URL}/quote`,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_GB",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} – Get a Locksmith Quote`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `Get a Locksmith Quote | ${SITE_NAME}`,
    description:
      "Verified UK locksmiths with transparent pricing. Get a quote in minutes.",
    images: ["/twitter-image"],
  },
  alternates: {
    canonical: `${SITE_URL}/quote`,
  },
  robots: { index: true, follow: true },
};

const problems = [
  { slug: "lockout", icon: "🔒", label: "Locked Out", desc: "Can't get inside" },
  { slug: "broken", icon: "🔧", label: "Broken Lock", desc: "Lock damaged" },
  { slug: "lost-keys", icon: "🗝️", label: "Lost Keys", desc: "Need locks changed" },
  { slug: "burglary", icon: "🚨", label: "After Break-in", desc: "Urgent security" },
];

const phoneDigits = SUPPORT_PHONE.replace(/\s+/g, "");

export default function QuotePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* HERO */}
        <section className="relative overflow-hidden py-10 md:py-16">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-100 rounded-full blur-3xl opacity-50" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-amber-100 rounded-full blur-3xl opacity-50" />
          </div>

          <div className="section-container relative">
            {/* Mobile floating phone CTA */}
            <div className="md:hidden flex justify-center mb-6">
              <a
                href={`tel:${phoneDigits}`}
                className="flex items-center justify-center gap-3 text-slate-900"
              >
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                    Call Now – Free Support
                  </span>
                  <span className="text-2xl font-bold tracking-tight">
                    {SUPPORT_PHONE}
                  </span>
                </div>
              </a>
            </div>

            <div className="max-w-3xl mx-auto text-center space-y-6">
              <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-full px-4 py-2 text-sm font-medium text-orange-700">
                <Shield className="w-4 h-4" />
                UK's First Anti-Fraud Locksmith Platform
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-slate-900">
                Get a Locksmith Quote
                <br />
                <span className="text-orange-500">In Minutes</span>
              </h1>

              <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto">
                Verified, insured UK locksmiths. See the full quote{" "}
                <strong>before any work starts</strong>. No call-out scams, no
                surprise bills.
              </p>

              {/* Primary CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Link href="/request" prefetch={false} className="inline-flex">
                  <Button className="btn-primary text-lg px-8 py-6 w-full sm:w-auto">
                    Get My Quote
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <a href={`tel:${phoneDigits}`} className="inline-flex">
                  <Button
                    variant="outline"
                    className="px-8 py-6 text-lg rounded-full border-slate-300 hover:bg-slate-50 w-full sm:w-auto"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Call {SUPPORT_PHONE}
                  </Button>
                </a>
              </div>

              {/* Trust pills */}
              <div className="flex flex-wrap gap-4 md:gap-6 pt-4 justify-center">
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Clock className="w-5 h-5 text-orange-500" />
                  <span className="font-medium">15–30 min response</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <MapPin className="w-5 h-5 text-orange-500" />
                  <span className="font-medium">UK-wide, 24/7</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Star className="w-5 h-5 text-orange-500 fill-orange-500" />
                  <span className="font-medium">4.9/5 rating</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROBLEM PICKER */}
        <section className="py-10 md:py-14 bg-white border-t border-slate-100">
          <div className="section-container">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-2">
              What do you need help with?
            </h2>
            <p className="text-center text-slate-600 mb-8">
              Pick the closest match — we'll match you with a verified locksmith.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-3xl mx-auto">
              {problems.map((p) => (
                <Link
                  key={p.slug}
                  href={`/request?type=emergency&problem=${p.slug}`}
                  prefetch={false}
                  className="group bg-white border-2 border-slate-200 hover:border-orange-400 hover:shadow-lg rounded-xl p-4 text-center transition-all"
                >
                  <div className="text-3xl mb-2">{p.icon}</div>
                  <div className="font-semibold text-slate-900 text-sm md:text-base">
                    {p.label}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">{p.desc}</div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* WHY LOCKSAFE */}
        <section className="py-12 md:py-16 bg-slate-50">
          <div className="section-container">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-10">
              Why thousands of UK customers choose LockSafe
            </h2>

            <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mb-4">
                  <Scale className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">
                  Quote BEFORE work starts
                </h3>
                <p className="text-slate-600 text-sm">
                  Every locksmith gives you a written, legally-binding quote
                  before lifting a tool. Accept or decline — no pressure.
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">
                  Auto-refund guarantee
                </h3>
                <p className="text-slate-600 text-sm">
                  If your locksmith doesn't arrive on time, you're refunded
                  automatically. The locksmith pays — never you.
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">
                  Verified & insured
                </h3>
                <p className="text-slate-600 text-sm">
                  Every locksmith is ID-checked, insured, and background-vetted
                  before they ever see a job.
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center mb-4">
                  <FileText className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">
                  Full PDF paper trail
                </h3>
                <p className="text-slate-600 text-sm">
                  GPS-stamped photos, signatures, and a downloadable PDF report
                  — your insurance and your protection.
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">
                  Fast response, 24/7
                </h3>
                <p className="text-slate-600 text-sm">
                  Average response across the UK is 15–30 minutes, day or night,
                  every day of the year.
                </p>
              </div>

              <div className="bg-white rounded-xl p-6 border border-slate-100 shadow-sm">
                <div className="w-12 h-12 bg-rose-50 rounded-lg flex items-center justify-center mb-4">
                  <Wrench className="w-6 h-6 text-rose-600" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">
                  Transparent pricing
                </h3>
                <p className="text-slate-600 text-sm">
                  No hidden fees. No "diagnostic" surprises. The number you see
                  is the number you pay.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-12 md:py-16 bg-white">
          <div className="section-container">
            <h2 className="text-2xl md:text-3xl font-bold text-center text-slate-900 mb-10">
              How your quote works
            </h2>

            <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {[
                { n: 1, t: "Tell us the problem", d: "30-second form — what, where, when." },
                { n: 2, t: "Get matched", d: "Verified local locksmiths bid for your job." },
                { n: 3, t: "Approve the quote", d: "See the price upfront. Accept or decline." },
                { n: 4, t: "Locksmith arrives", d: "GPS-tracked, fully documented, fully insured." },
              ].map((s) => (
                <div key={s.n} className="text-center">
                  <div className="w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-3">
                    {s.n}
                  </div>
                  <h3 className="font-bold text-slate-900 mb-1">{s.t}</h3>
                  <p className="text-slate-600 text-sm">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="py-14 md:py-20 bg-gradient-to-br from-orange-500 to-amber-500 text-white">
          <div className="section-container text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Get your free locksmith quote now
            </h2>
            <p className="text-lg md:text-xl text-orange-50 mb-8 max-w-2xl mx-auto">
              No obligation. No hidden fees. Verified UK locksmiths only.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/request" prefetch={false} className="inline-flex">
                <Button className="bg-white text-orange-600 hover:bg-orange-50 text-lg px-8 py-6 rounded-full font-bold w-full sm:w-auto">
                  Get My Quote
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href={`tel:${phoneDigits}`} className="inline-flex">
                <Button
                  variant="outline"
                  className="border-white text-white hover:bg-white/10 text-lg px-8 py-6 rounded-full w-full sm:w-auto"
                >
                  <Phone className="w-5 h-5 mr-2" />
                  {SUPPORT_PHONE}
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
