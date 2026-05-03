import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { SITE_NAME, SUPPORT_PHONE, getFullUrl } from "@/lib/config";
import {
  buildServicesIndexBreadcrumbJsonLd,
  buildServicesIndexFaqJsonLd,
  buildServicesItemListJsonLd,
  buildSpeakableJsonLd,
} from "@/lib/service-jsonld";
import { SERVICE_CATALOG, type ServiceSlug } from "@/lib/services-catalog";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  DoorOpen,
  FileCheck,
  Home,
  Key,
  Lock,
  Phone,
  Shield,
  ShieldCheck,
  Wrench,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

const tileStyle: Record<
  ServiceSlug,
  { icon: typeof DoorOpen; color: string; bgColor: string; textColor: string }
> = {
  "emergency-locksmith": {
    icon: AlertTriangle,
    color: "bg-red-500",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
  },
  "locked-out": {
    icon: DoorOpen,
    color: "bg-orange-500",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
  },
  "lock-change": {
    icon: Lock,
    color: "bg-amber-500",
    bgColor: "bg-amber-50",
    textColor: "text-amber-700",
  },
  "broken-key-extraction": {
    icon: Key,
    color: "bg-yellow-500",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
  },
  "upvc-door-lock-repair": {
    icon: Wrench,
    color: "bg-teal-500",
    bgColor: "bg-teal-50",
    textColor: "text-teal-700",
  },
  "burglary-lock-repair": {
    icon: Shield,
    color: "bg-rose-600",
    bgColor: "bg-rose-50",
    textColor: "text-rose-700",
  },
  "car-key-replacement": {
    icon: Car,
    color: "bg-slate-700",
    bgColor: "bg-slate-50",
    textColor: "text-slate-700",
  },
  "safe-opening": {
    icon: ShieldCheck,
    color: "bg-indigo-600",
    bgColor: "bg-indigo-50",
    textColor: "text-indigo-700",
  },
  "landlord-lock-change": {
    icon: Home,
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  "commercial-locksmith": {
    icon: Building2,
    color: "bg-purple-500",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
  },
};

const TITLE = `Locksmith Services | ${SITE_NAME} – Verified, Fixed-Price, 24/7`;
const DESCRIPTION =
  "Every UK locksmith service — emergency lockouts, BS3621 lock changes, broken-key extraction, UPVC repair, car keys, safes, landlord and commercial work — with verified, DBS-checked locksmiths and a fixed quote agreed before any work starts.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "locksmith services UK",
    "emergency locksmith",
    "lock replacement",
    "BS3621 lock change",
    "verified locksmith",
    "fixed price locksmith",
    "auto locksmith UK",
    "commercial locksmith",
    "24/7 locksmith UK",
  ],
  alternates: { canonical: getFullUrl("/services") },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    url: getFullUrl("/services"),
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

const services = SERVICE_CATALOG.map((entry) => {
  const style = tileStyle[entry.id as ServiceSlug];
  return {
    slug: entry.id,
    icon: style.icon,
    title: entry.title,
    description: entry.shortDescription,
    features: entry.whatsIncluded,
    price: entry.priceHint,
    color: style.color,
    bgColor: style.bgColor,
    textColor: style.textColor,
  };
});

const guarantees = [
  {
    icon: ShieldCheck,
    title: "Verified Professionals",
    description: "Every locksmith is DBS-checked, insured, and vetted.",
  },
  {
    icon: FileCheck,
    title: "Digital Paper Trail",
    description: "GPS tracking, timestamped photos, and insurer-ready PDF.",
  },
  {
    icon: Zap,
    title: "No Hidden Fees",
    description: "See the full quote — in writing — before any work begins.",
  },
  {
    icon: Clock,
    title: "Rapid Response",
    description: "15–30 minute average arrival time, 24/7 across the UK.",
  },
];

// 6 cross-service FAQs for the index FAQPage schema (AEO).
const indexFaqs = [
  {
    question: "How does LockSafe UK actually work?",
    answer:
      "LockSafe UK is a marketplace for verified, DBS-checked locksmiths. You post a job in 60 seconds, locksmiths quote you a fixed price in writing, you pick the one you want, track their arrival on a map, and only pay once the job is done. No doorstep negotiations, no surprise invoices.",
  },
  {
    question: "How much do UK locksmith services cost?",
    answer:
      "Prices on LockSafe UK typically range from £60 for a basic lockout to £600 for full commercial system installs. Every job has a fixed price agreed in writing before any work starts. Indicative price bands are shown on each service page.",
  },
  {
    question: "How fast will a LockSafe locksmith reach me?",
    answer:
      "Average arrival time is 15–30 minutes across most UK postcodes. Each locksmith's quote includes their ETA, and you track them live on a map after accepting. Coverage is 24 hours a day, 365 days a year.",
  },
  {
    question: "Are LockSafe locksmiths really verified?",
    answer:
      "Yes. Every locksmith on the platform is DBS-checked, holds public liability insurance, and is vetted before being allowed to quote on jobs. We reject more applicants than we accept — this is the platform's anti-fraud foundation.",
  },
  {
    question: "What if the price changes when the locksmith arrives?",
    answer:
      "It can't, without your written approval. Our anti-stitch-up guarantee means the quoted price is the price you pay. If anything ever changes mid-job, we step in. This is the platform's core promise.",
  },
  {
    question: "Do I need to pay before the locksmith arrives?",
    answer:
      "No. The price is locked when you accept the quote, but no card is charged until the locksmith confirms the job is finished. You only pay for work that's actually been done.",
  },
];

const FEATURED_EMERGENCY: ServiceSlug[] = [
  "emergency-locksmith",
  "locked-out",
  "burglary-lock-repair",
];

export default function ServicesPage() {
  const itemListLd = buildServicesItemListJsonLd(SERVICE_CATALOG);
  const breadcrumbLd = buildServicesIndexBreadcrumbJsonLd();
  const faqLd = buildServicesIndexFaqJsonLd(indexFaqs);
  const speakableLd = buildSpeakableJsonLd(getFullUrl("/services"));

  const featured = FEATURED_EMERGENCY.map((slug) =>
    SERVICE_CATALOG.find((s) => s.id === slug),
  ).filter((s): s is (typeof SERVICE_CATALOG)[number] => Boolean(s));

  return (
    <>
      <Header />

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
        dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableLd) }}
      />

      <main>
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="bg-slate-50 border-b border-slate-200"
        >
          <div className="section-container py-3">
            <ol className="flex items-center gap-2 text-sm text-slate-600">
              <li>
                <Link href="/" className="hover:text-orange-600">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </li>
              <li className="font-medium text-slate-900" aria-current="page">
                Services
              </li>
            </ol>
          </div>
        </nav>

        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="py-16 md:py-24 bg-gradient-to-b from-slate-900 to-slate-800 text-white"
        >
          <div className="section-container">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 rounded-full px-4 py-2 text-sm font-semibold mb-6 uppercase tracking-wide">
                <Wrench className="w-4 h-4" />
                Locksmith Services
              </div>
              <h1
                id="hero-heading"
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
              >
                Every lock problem.{" "}
                <span className="text-orange-400">One verified platform.</span>{" "}
                Fixed price, in writing, before any work.
              </h1>
              <p className="text-lg md:text-xl text-slate-200 mb-8 leading-relaxed">
                Stop calling random Google ads and hoping for the best. LockSafe
                UK connects you with DBS-checked, insured locksmiths who quote
                up front, track live, and document every job for your insurer or
                landlord.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/request">
                  <Button className="btn-primary px-8 py-6 text-base">
                    Get a fixed quote now
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
                <a href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`}>
                  <Button
                    variant="outline"
                    className="border-slate-300 text-white hover:text-slate-900 px-8 py-6 text-base"
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Call {SUPPORT_PHONE}
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Speakable / TL;DR for GEO */}
        <section
          id="tldr"
          aria-labelledby="tldr-heading"
          className="py-12 bg-orange-50 border-y border-orange-100"
        >
          <div className="section-container max-w-3xl">
            <h2
              id="tldr-heading"
              className="text-sm font-semibold uppercase tracking-wide text-orange-700 mb-3"
            >
              In short
            </h2>
            <p className="text-lg md:text-xl text-slate-800 leading-relaxed">
              {DESCRIPTION}
            </p>
          </div>
        </section>

        {/* Featured / urgent strip */}
        <section
          aria-labelledby="featured-heading"
          className="py-12 bg-white border-b border-slate-200"
        >
          <div className="section-container">
            <h2
              id="featured-heading"
              className="text-sm font-semibold uppercase tracking-wide text-orange-600 mb-4"
            >
              Most-requested right now
            </h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {featured.map((entry) => {
                const style = tileStyle[entry.id as ServiceSlug];
                const Icon = style.icon;
                return (
                  <Link
                    key={entry.id}
                    href={`/services/${entry.id}`}
                    className="flex items-center gap-4 bg-slate-50 hover:bg-orange-50 border border-slate-200 hover:border-orange-300 rounded-2xl p-4 transition-colors"
                  >
                    <div
                      className={`w-12 h-12 ${style.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">
                        {entry.title}
                      </div>
                      <div className="text-sm text-slate-600">
                        {entry.priceHint}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Services grid */}
        <section
          aria-labelledby="all-services-heading"
          className="py-16 md:py-20 bg-slate-50"
        >
          <div className="section-container">
            <h2
              id="all-services-heading"
              className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
            >
              Every locksmith service we cover
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mb-12">
              Pick the closest match to your problem and you'll see indicative
              pricing, what's included, and FAQs from other UK customers.
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => (
                <article
                  key={service.title}
                  className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg hover:border-orange-300 transition-all flex flex-col"
                >
                  <div
                    className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center mb-4`}
                  >
                    <service.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">
                    {service.title}
                  </h3>
                  <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                    {service.description}
                  </p>
                  <ul className="space-y-2 mb-4">
                    {service.features.slice(0, 3).map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2 text-sm text-slate-700"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                    <span className="text-base font-bold text-slate-900">
                      {service.price}
                    </span>
                    <Link href={`/services/${service.slug}`}>
                      <Button size="sm" className="btn-primary">
                        Learn more
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Guarantees */}
        <section
          aria-labelledby="guarantees-heading"
          className="py-16 bg-slate-900 text-white"
        >
          <div className="section-container">
            <h2
              id="guarantees-heading"
              className="text-3xl font-bold text-center mb-12"
            >
              Every service comes with
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {guarantees.map((item) => (
                <div key={item.title} className="text-center">
                  <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          aria-labelledby="faq-heading"
          className="py-16 md:py-20 bg-white"
        >
          <div className="section-container max-w-3xl">
            <h2
              id="faq-heading"
              className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-12"
            >
              Frequently asked questions
            </h2>
            <ul className="space-y-3">
              {indexFaqs.map((faq) => (
                <li key={faq.question}>
                  <details className="group bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                    <summary className="flex items-center justify-between gap-4 cursor-pointer px-6 py-4 font-semibold text-slate-900 list-none">
                      <span>{faq.question}</span>
                      <ChevronDown className="w-5 h-5 flex-shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="px-6 pb-5 text-slate-600 leading-relaxed">
                      {faq.answer}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section
          aria-labelledby="cta-heading"
          className="py-16 md:py-24 bg-gradient-to-b from-slate-900 to-slate-800 text-white"
        >
          <div className="section-container text-center">
            <h2
              id="cta-heading"
              className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
            >
              Need a locksmith now?
            </h2>
            <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-2xl mx-auto">
              Verified, DBS-checked locksmiths quote in minutes. Fixed price.
              Live tracking. Insurance-ready paperwork. That's it.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/request">
                <Button className="btn-primary px-8 py-6 text-base">
                  Post your job in 60 seconds
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
              <a href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`}>
                <Button
                  variant="outline"
                  className="border-slate-300 text-white hover:text-slate-900 px-8 py-6 text-base"
                >
                  <Phone className="w-4 h-4 mr-1" />
                  Call {SUPPORT_PHONE}
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
