import type { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import {
  Phone,
  Shield,
  MapPin,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertTriangle,
  BadgeCheck,
  Camera,
  CreditCard,
  Lock,
  Eye,
  FileSignature,
  Fingerprint,
  Receipt,
  Navigation,
  ShieldAlert,
  ChevronDown,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

/* ------------------------------------------------------------------ */
/*  East London locality data                                          */
/* ------------------------------------------------------------------ */

const EAST_LONDON = {
  area: "East London",
  postcodes: ["E1", "E2", "E3", "E5", "E8", "E9", "E11", "E14", "E15", "E16", "E17", "E20"],
  neighborhoods: [
    "Stratford",
    "Whitechapel",
    "Bethnal Green",
    "Shoreditch",
    "Hackney",
    "Dalston",
    "Bow",
    "Mile End",
    "Walthamstow",
    "Leyton",
    "Leytonstone",
    "Wapping",
    "Limehouse",
    "Poplar",
    "Canary Wharf",
    "Isle of Dogs",
    "Canning Town",
    "Plaistow",
    "Hackney Wick",
    "Hoxton",
  ],
};

/* ------------------------------------------------------------------ */
/*  SEO metadata                                                       */
/* ------------------------------------------------------------------ */

export const metadata: Metadata = {
  title: "Trusted Locksmith East London | Verified, Transparent, No Scams",
  description:
    "Locked out in East London? LockSafe only dispatches identity-verified locksmiths with transparent pricing, GPS tracking and fraud monitoring. No surprise fees. No fake reviews.",
  keywords: [
    "emergency locksmith east london",
    "trusted locksmith east london",
    "locksmith near me",
    "avoid locksmith scams",
    "verified locksmith east london",
    "locksmith stratford",
    "locksmith hackney",
    "locksmith whitechapel",
    "locksmith bethnal green",
    "locksmith bow",
    "locksmith e1",
    "locksmith e8",
    "locksmith e14",
    "locksmith e15",
    "transparent pricing locksmith",
    "no surprise fees locksmith",
  ],
  openGraph: {
    title: "Locked Out in East London? Verified, Tracked, Transparent.",
    description:
      "Every LockSafe locksmith is ID-checked, GPS-tracked and price-monitored before they reach you. Built so you can stay calm under pressure.",
    url: `${SITE_URL}/locksmith-east-london`,
    type: "website",
    locale: "en_GB",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "Trusted Locksmith East London | LockSafe",
    description:
      "Verified locksmiths. Transparent pricing. GPS tracking. Built to keep East Londoners safe from locksmith scams.",
  },
  alternates: {
    canonical: `${SITE_URL}/locksmith-east-london`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

/* ------------------------------------------------------------------ */
/*  Schema.org                                                         */
/* ------------------------------------------------------------------ */

function buildSchemas() {
  const localBusiness = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/locksmith-east-london#business`,
    name: "LockSafe — Trusted Locksmiths East London",
    description:
      "Verified, identity-checked locksmith dispatch covering all East London postcodes (E1–E20). Transparent pricing, GPS-tracked attendance, fraud monitoring.",
    url: `${SITE_URL}/locksmith-east-london`,
    telephone: "+442045771989",
    priceRange: "££",
    address: {
      "@type": "PostalAddress",
      addressLocality: "East London",
      addressRegion: "Greater London",
      postalCode: "E1",
      addressCountry: "GB",
    },
    areaServed: EAST_LONDON.neighborhoods.map((name) => ({ "@type": "City", name })),
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "00:00",
      closes: "23:59",
    },
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I know a LockSafe locksmith is not a scammer?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Every locksmith on LockSafe passes identity verification (photo ID + selfie match), public liability insurance checks and a DBS check before they can accept jobs. When one is dispatched to you, you see their name, photo, vehicle and live GPS location in real time. Anyone arriving who does not match that profile is not from LockSafe — do not let them in.",
        },
      },
      {
        "@type": "Question",
        name: "How does LockSafe stop surprise fees?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Pricing is two-stage and visible before anyone moves. You see the assessment fee before the locksmith leaves. Once on site, you receive a separate written work quote on your phone and must approve it before any work begins. If you decline, you only pay the assessment fee. Our fraud monitor flags quotes that fall outside normal East London market rates.",
        },
      },
      {
        "@type": "Question",
        name: "Why are locksmith scams so common in London?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Locksmithing is unregulated in the UK — anyone can call themselves a locksmith. Many lead-generation sites buy Google ads, take your call, then sub-contract the job to an unvetted driver. The most common scams are: quoting £49 on the phone then charging £400 in cash on site, drilling locks unnecessarily, refusing to leave until paid, and using a fake business address. LockSafe is built to make all of that impossible.",
        },
      },
      {
        "@type": "Question",
        name: "Which East London areas do you cover?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "All E-postcodes including Stratford, Whitechapel, Bethnal Green, Shoreditch, Hackney, Dalston, Bow, Mile End, Walthamstow, Leyton, Leytonstone, Wapping, Limehouse, Poplar, Canary Wharf, Isle of Dogs, Canning Town, Plaistow and surrounding areas.",
        },
      },
      {
        "@type": "Question",
        name: "Are LockSafe reviews real?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes. Reviews can only be left by verified customers after a completed and paid job. We do not display vanity numbers or buy reviews. If we have not earned a review yet for a specific area, we will not invent one.",
        },
      },
    ],
  };

  return { localBusiness, faq };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LocksmithEastLondonPage() {
  const schemas = buildSchemas();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.localBusiness) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.faq) }}
      />

      {/* Sticky mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-slate-950/95 backdrop-blur p-4 border-t border-slate-800">
        <a href="tel:+442045771989" className="block">
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base font-semibold rounded-2xl flex items-center justify-center gap-3">
            <Phone className="w-5 h-5" />
            Call a Verified Locksmith
          </Button>
        </a>
        <p className="text-center text-slate-500 text-xs mt-2">
          Identity-checked · GPS-tracked · Transparent pricing
        </p>
      </div>

      <Header />

      <main className="pb-24 lg:pb-0">
        {/* ============================================================ */}
        {/* HERO — calm, factual, trust-led                              */}
        {/* ============================================================ */}
        <section className="relative bg-slate-950 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" />
          <div className="absolute inset-0 opacity-25">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl" />
          </div>

          <div className="relative section-container py-14 md:py-20 lg:py-24">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-2 backdrop-blur-sm">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 text-sm font-medium">
                  Built to protect East Londoners from locksmith scams
                </span>
              </div>
            </div>

            <div className="max-w-4xl mx-auto text-center">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-[1.1] tracking-tight">
                <span className="text-slate-400 text-xl md:text-2xl font-medium block mb-3">
                  Locked out somewhere in East London?
                </span>
                A verified locksmith.
                <br className="hidden md:block" />{" "}
                <span className="text-emerald-400">A price you see before they start.</span>
              </h1>

              <p className="text-base md:text-lg text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                LockSafe only dispatches locksmiths who have passed identity verification,
                insurance checks and a DBS check. You see their photo, vehicle and live GPS
                location before they reach you, and the written work quote on your phone
                before any work begins. No surprise fees. No fake reviews. No drilling
                without your written consent.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                <a href="tel:+442045771989" className="group">
                  <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-7 text-lg font-semibold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all">
                    <Phone className="w-5 h-5 mr-3" />
                    +44 20 4577 1989
                  </Button>
                </a>
                <Link href="/quote" className="group">
                  <Button className="w-full sm:w-auto bg-white/10 hover:bg-white/15 text-white px-8 py-7 text-lg font-semibold rounded-2xl border border-white/20 transition-all">
                    Request a Verified Locksmith
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 max-w-3xl mx-auto">
                {[
                  { icon: Fingerprint, label: "Identity verified" },
                  { icon: Navigation, label: "GPS tracked" },
                  { icon: Receipt, label: "Written quote first" },
                  { icon: ShieldAlert, label: "Fraud monitored" },
                ].map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5"
                  >
                    <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-slate-300 text-xs md:text-sm font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden md:flex justify-center mt-12 text-slate-600">
              <ChevronDown className="w-6 h-6 animate-bounce" />
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* THE SCAM PROBLEM                                              */}
        {/* ============================================================ */}
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="section-container max-w-5xl">
            <div className="mb-12">
              <span className="inline-block text-rose-600 text-xs font-semibold tracking-widest uppercase mb-3">
                The London locksmith problem
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                Why locksmith scams are so common in London
              </h2>
              <p className="text-slate-600 text-base md:text-lg leading-relaxed max-w-3xl">
                Locksmithing is <span className="font-semibold text-slate-900">unregulated</span>{" "}
                in the UK. Anyone can put up a sign, run a Google ad, and turn up at your door.
                That gap is exactly what scam operators exploit — and East London, with its dense
                housing and high call-out volume, is one of the most targeted areas in the country.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "The £49 bait-and-switch",
                  body: "Quoted £49 on the phone. Once the lock is drilled, the bill is £350–£600 in cash. They will not leave until paid.",
                },
                {
                  title: "Unnecessary drilling",
                  body: "Most modern locks can be picked or bypassed without damage. Scammers drill on purpose so they can charge to fit a new lock — often a cheap one marked up several times over.",
                },
                {
                  title: "Fake local business",
                  body: "A 'Locksmith Bethnal Green' listing with a fake local address that re-routes to a national call centre. The driver who arrives has no connection to the area or the business name.",
                },
                {
                  title: "No paperwork, no comeback",
                  body: "No written quote, no receipt, no business address you can return to. If the lock fails the next day, there is no one to call.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">{item.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* HOW LOCKSAFE PROTECTS YOU                                    */}
        {/* ============================================================ */}
        <section className="py-16 md:py-24 bg-white">
          <div className="section-container max-w-6xl">
            <div className="text-center mb-14 max-w-3xl mx-auto">
              <span className="inline-block text-emerald-600 text-xs font-semibold tracking-widest uppercase mb-3">
                Trust under pressure
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4 tracking-tight">
                Every safeguard, built into the booking
              </h2>
              <p className="text-slate-600 text-base md:text-lg leading-relaxed">
                You do not have to vet a stranger at 11pm on your own doorstep. The platform does
                it before they are dispatched, and keeps watching while they are with you.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  icon: Fingerprint,
                  title: "Identity verification",
                  body: "Every locksmith must pass photo-ID and live selfie matching before they can take a job. You see their verified name and photo on your phone before they arrive.",
                },
                {
                  icon: BadgeCheck,
                  title: "Insurance & DBS checks",
                  body: "Public liability insurance, business registration and a DBS check are confirmed and re-confirmed annually. No expired certificate, no jobs.",
                },
                {
                  icon: Navigation,
                  title: "Live GPS tracking",
                  body: "Watch the locksmith approach in real time, just like a rideshare. You always know who is at the door, and so does our control room.",
                },
                {
                  icon: Receipt,
                  title: "Two-stage transparent pricing",
                  body: "Assessment fee shown before dispatch. Separate written work quote on your phone before any work begins. You approve it; only then does anything happen.",
                },
                {
                  icon: ShieldAlert,
                  title: "Live fraud monitor",
                  body: "Every quote is checked against East London market rates in real time. Outliers are flagged before you ever see them.",
                },
                {
                  icon: Camera,
                  title: "Photo evidence on every job",
                  body: "Time-stamped photos of the lock before and after work — your record, our record, kept for you to review later.",
                },
                {
                  icon: FileSignature,
                  title: "Digital sign-off",
                  body: "Work is only marked complete when you digitally sign that you are satisfied. No signature, no payment release to the locksmith.",
                },
                {
                  icon: Lock,
                  title: "No-drill commitment",
                  body: "Locks are picked or bypassed wherever possible. Drilling requires your explicit written consent — never a default option.",
                },
                {
                  icon: Eye,
                  title: "Verified reviews only",
                  body: "Reviews can only be left after a completed, paid job by the customer who booked it. No purchased reviews. No invented testimonials.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="bg-slate-50 border border-slate-200 rounded-2xl p-6 hover:border-emerald-300 hover:bg-white transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 mb-2">{title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* COMPARISON                                                   */}
        {/* ============================================================ */}
        <section className="py-16 md:py-20 bg-slate-950 text-white">
          <div className="section-container max-w-5xl">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                What changes when you book through LockSafe
              </h2>
              <p className="text-slate-400 text-base md:text-lg">
                Side by side, against the typical East London scam call-out.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 md:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <XCircle className="w-5 h-5 text-rose-400" />
                  <h3 className="font-semibold text-rose-300">Typical scam call-out</h3>
                </div>
                <ul className="space-y-3 text-sm text-slate-300">
                  {[
                    "Phone quote of £49 — actual bill £350–£600",
                    "Driver's identity, name and insurance unknown",
                    "Lock drilled unnecessarily so a replacement can be sold",
                    "Cash demanded on site, no written quote, no receipt",
                    "Reviews bought or written by the operator",
                    "Fake local address; no way to follow up if the lock fails",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <XCircle className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-2xl p-6 md:p-8">
                <div className="flex items-center gap-2 mb-5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-semibold text-emerald-300">LockSafe</h3>
                </div>
                <ul className="space-y-3 text-sm text-slate-200">
                  {[
                    "Two-stage pricing: assessment fee shown before dispatch, written work quote before work begins",
                    "Identity-verified, DBS-checked, insured locksmith — name and photo on your phone",
                    "Picking and bypass first; drilling requires your written consent",
                    "Card payment through the platform, with a digital receipt",
                    "Reviews only from verified completed jobs",
                    "Every job logged, photographed and timestamped — you can review it any time",
                  ].map((line) => (
                    <li key={line} className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* COVERAGE                                                     */}
        {/* ============================================================ */}
        <section className="py-16 md:py-20 bg-white">
          <div className="section-container max-w-5xl">
            <div className="mb-10">
              <span className="inline-block text-sky-600 text-xs font-semibold tracking-widest uppercase mb-3">
                Coverage
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
                East London, end to end
              </h2>
              <p className="text-slate-600 text-base md:text-lg max-w-2xl">
                Verified locksmiths across every E-postcode, day or night.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Areas
                </h3>
                <div className="flex flex-wrap gap-2">
                  {EAST_LONDON.neighborhoods.map((n) => (
                    <span
                      key={n}
                      className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 text-sm font-medium px-3 py-1.5 rounded-full"
                    >
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {n}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Postcodes
                </h3>
                <div className="flex flex-wrap gap-2">
                  {EAST_LONDON.postcodes.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center bg-emerald-50 text-emerald-700 text-sm font-semibold px-3 py-1.5 rounded-full border border-emerald-100"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* WHAT TO DO NOW                                                */}
        {/* ============================================================ */}
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="section-container max-w-4xl">
            <div className="mb-10 text-center">
              <span className="inline-block text-amber-600 text-xs font-semibold tracking-widest uppercase mb-3">
                If you are locked out right now
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
                Five calm steps before you let anyone near your lock
              </h2>
            </div>

            <ol className="space-y-4">
              {[
                "Move somewhere lit and public if you can — a shop, café or neighbour's doorstep.",
                "Do not accept a phone quote without a written follow-up. Anyone unwilling to put a price in writing is not the right person.",
                "Before they arrive, confirm name, photo and vehicle. With LockSafe these are on your screen.",
                "Refuse drilling unless the locksmith has shown you that picking or bypass is genuinely not possible — and you have given written consent.",
                "Pay through the platform, not in cash. A digital receipt is your protection if anything fails later.",
              ].map((step, i) => (
                <li
                  key={step}
                  className="flex items-start gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-900 text-white text-sm font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <p className="text-slate-700 text-sm md:text-base leading-relaxed pt-1">
                    {step}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ============================================================ */}
        {/* PRICING                                                      */}
        {/* ============================================================ */}
        <section className="py-16 md:py-20 bg-white">
          <div className="section-container max-w-4xl">
            <div className="text-center mb-10">
              <span className="inline-block text-emerald-600 text-xs font-semibold tracking-widest uppercase mb-3">
                Transparent pricing
              </span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
                You see the price before anyone starts
              </h2>
              <p className="text-slate-600 text-base md:text-lg max-w-2xl mx-auto">
                Two simple stages. Both visible to you in writing. Neither can be changed after
                the fact.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">1. Assessment fee</h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-2">
                  Shown to you before the locksmith leaves. Covers travel and diagnosing the
                  problem on site. Typically £25–£49 depending on time of day.
                </p>
                <p className="text-slate-500 text-xs">
                  If you decline the work quote, this is all you pay.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold text-slate-900">2. Written work quote</h3>
                </div>
                <p className="text-slate-600 text-sm leading-relaxed mb-2">
                  A separate, itemised quote sent to your phone once the locksmith has seen the
                  lock. You approve in one tap before any work begins.
                </p>
                <p className="text-slate-500 text-xs">
                  Cross-checked against East London market rates by our fraud monitor.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* FAQ                                                          */}
        {/* ============================================================ */}
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="section-container max-w-3xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3 tracking-tight">
                Questions people ask before they book
              </h2>
            </div>

            <div className="space-y-3">
              {schemas.faq.mainEntity.map((q) => (
                <details
                  key={q.name}
                  className="group bg-white border border-slate-200 rounded-2xl px-5 py-4 open:shadow-sm"
                >
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
                    <span className="font-semibold text-slate-900 text-sm md:text-base">
                      {q.name}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180 shrink-0" />
                  </summary>
                  <p className="mt-3 text-slate-600 text-sm leading-relaxed">
                    {q.acceptedAnswer.text}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/* FINAL CTA                                                    */}
        {/* ============================================================ */}
        <section className="py-16 md:py-24 bg-slate-950 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60rem] h-[60rem] bg-emerald-500/15 rounded-full blur-3xl" />
          </div>
          <div className="relative section-container max-w-3xl text-center">
            <Shield className="w-10 h-10 text-emerald-400 mx-auto mb-5" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Get a verified locksmith. Stay in control of the price.
            </h2>
            <p className="text-slate-400 text-base md:text-lg mb-8 max-w-xl mx-auto">
              Identity verified. GPS tracked. Written quote before any work. East London,
              twenty-four hours a day.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="tel:+442045771989">
                <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-7 text-lg font-semibold rounded-2xl shadow-lg shadow-emerald-500/20">
                  <Phone className="w-5 h-5 mr-3" />
                  +44 20 4577 1989
                </Button>
              </a>
              <Link href="/quote">
                <Button className="w-full sm:w-auto bg-white/10 hover:bg-white/15 text-white px-8 py-7 text-lg font-semibold rounded-2xl border border-white/20">
                  Request a Locksmith
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-slate-500 text-xs flex items-center justify-center gap-2">
              <Clock className="w-3.5 h-3.5" />
              24/7 service across all E-postcodes
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
