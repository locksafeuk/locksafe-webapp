import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { getServiceBySlug, SERVICE_CATALOG } from "@/lib/services-catalog";
import { postcodeData, getPostcodeBySlug } from "@/lib/postcode-data";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  localBusinessJsonLd,
  serviceJsonLd,
  howToJsonLd,
  speakableJsonLd,
  ldScript,
} from "@/lib/seo";
import { postcodeServiceUrl, postcodeUrl, serviceUrl, canonical } from "@/lib/seo/url-helpers";
import { IntentFaq } from "@/components/intent/IntentFaq";

interface Props {
  params: Promise<{ slug: string; service: string }>;
}

/**
 * Top services × all postcodes. Cap intentionally to control build time;
 * other services remain reachable through the postcode hub at
 * /emergency-locksmith-{slug}.
 */
const PILLAR_POSTCODE_SERVICES = [
  "emergency-locksmith",
  "lock-change",
  "burglary-repair",
  "auto-locksmith",
  "commercial-locksmith",
] as const;

export async function generateStaticParams() {
  const out: { slug: string; service: string }[] = [];
  for (const data of Object.values(postcodeData)) {
    for (const service of PILLAR_POSTCODE_SERVICES) {
      out.push({ slug: data.slug, service });
    }
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, service } = await params;
  const data = getPostcodeBySlug(slug);
  const serviceData = getServiceBySlug(service);
  if (!data || !serviceData) return {};

  const title = `${serviceData.title} ${data.postcode} ${data.area} | LockSafe UK`;
  const description = `${serviceData.title} in ${data.area} (${data.postcode}). Verified locksmith, ${data.avgResponseTime} response across ${data.neighborhoods.slice(0, 3).join(", ")}. From ${serviceData.priceHint}. Price agreed before work starts.`;

  return {
    title,
    description,
    keywords: [
      `${serviceData.title.toLowerCase()} ${data.postcode}`,
      `${serviceData.title.toLowerCase()} ${data.area}`,
      `locksmith ${data.postcode}`,
      `locksmith ${data.area}`,
      `emergency locksmith ${data.postcode}`,
      ...data.neighborhoods.slice(0, 4).map((n) => `${serviceData.title.toLowerCase()} ${n}`),
    ].join(", "),
    alternates: { canonical: postcodeServiceUrl(slug, service) },
    openGraph: {
      title,
      description,
      url: canonical(postcodeServiceUrl(slug, service)),
      type: "article",
    },
  };
}

export default async function PostcodeServicePage({ params }: Props) {
  const { slug, service } = await params;
  const data = getPostcodeBySlug(slug);
  const serviceData = getServiceBySlug(service);
  if (!data || !serviceData) notFound();

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: serviceData.title, url: serviceUrl(service) },
    { name: `${data.postcode} ${data.area}`, url: postcodeUrl(slug) },
    { name: serviceData.title, url: postcodeServiceUrl(slug, service) },
  ];

  const faqs = [
    {
      question: `How quickly can a locksmith reach ${data.postcode} for ${serviceData.title.toLowerCase()}?`,
      answer: `Average LockSafe response in ${data.postcode} ${data.area} is ${data.avgResponseTime}. Verified locksmiths cover ${data.neighborhoods.slice(0, 3).join(", ")} and ${data.district}.`,
    },
    {
      question: `How much does ${serviceData.title.toLowerCase()} cost in ${data.area}?`,
      answer: `${serviceData.title} in ${data.area} starts from ${serviceData.priceHint}. The bid you accept on LockSafe is the price you pay — no surprise doorstep fees.`,
    },
    {
      question: `Do you cover all of ${data.postcode}?`,
      answer: `Yes — full ${data.postcode} coverage including ${data.neighborhoods.join(", ")}, and the surrounding postcodes ${data.nearbyPostcodes.join(", ")}.`,
    },
    {
      question: `Are LockSafe ${data.area} locksmiths verified?`,
      answer: `Every locksmith on LockSafe is DBS-checked, insured, ID-verified and rated by previous customers. You see their profile before accepting a bid.`,
    },
    ...serviceData.faqs.slice(0, 4),
  ];

  const localisedTitle = `${serviceData.title} in ${data.postcode} ${data.area}`;

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldScript(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldScript(faqJsonLd(faqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            serviceJsonLd({
              name: localisedTitle,
              description: serviceData.shortDescription,
              url: postcodeServiceUrl(slug, service),
              serviceType: serviceData.title,
              areaServed: [
                { name: data.area, type: "City" },
                { name: data.postcode, type: "City" },
                ...data.neighborhoods.slice(0, 5).map((n) => ({ name: n, type: "City" as const })),
              ],
              priceRange:
                serviceData.priceRangeLow && serviceData.priceRangeHigh
                  ? { low: serviceData.priceRangeLow, high: serviceData.priceRangeHigh }
                  : undefined,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            localBusinessJsonLd({
              name: `LockSafe UK — ${localisedTitle}`,
              description: `${serviceData.title} provided by verified locksmiths across ${data.postcode} ${data.area}, ${data.county}.`,
              url: postcodeServiceUrl(slug, service),
              addressLocality: data.area,
              addressRegion: data.county,
              postalCode: data.postcode,
              coordinates: data.coordinates,
              areaServed: data.neighborhoods.slice(0, 10),
              rating: { value: 4.9, count: 1250 },
              priceRange: "££",
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            howToJsonLd({
              name: `How to get ${serviceData.title.toLowerCase()} in ${data.postcode}`,
              description: `Three steps to a verified ${data.area} locksmith.`,
              totalTime: "PT5M",
              steps: [
                { name: "Post the job", text: `Describe what's happened — 90 seconds.` },
                { name: "Compare bids", text: `Verified ${data.postcode} locksmiths quote the price before any work.` },
                { name: "Tracked arrival", text: `GPS-tracked arrival in ${data.avgResponseTime}.` },
              ],
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            speakableJsonLd({
              url: postcodeServiceUrl(slug, service),
              cssSelectors: ["h1", "#tldr", "#faq summary"],
            }),
          ),
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <p className="text-[10px] tracking-[0.3em] uppercase text-amber-400 mb-3 font-medium">
            {data.postcode} · {data.area} · {data.county}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4 max-w-3xl">
            {localisedTitle}
          </h1>
          <p className="text-base sm:text-lg text-slate-200 max-w-2xl mb-6">
            {serviceData.subhead} Covering {data.emergencyContext}. Average response: {data.avgResponseTime}.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/request"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-base font-semibold transition-colors"
            >
              Get a {data.postcode} locksmith
              <span aria-hidden>→</span>
            </Link>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm">
              From {serviceData.priceHint}
            </span>
          </div>
        </div>
      </section>

      {/* TL;DR */}
      <section id="tldr" className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
            {serviceData.aiSummary || serviceData.shortDescription} LockSafe verified locksmiths cover{" "}
            {data.neighborhoods.slice(0, 4).join(", ")} and the rest of {data.postcode}.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              What's included
            </h2>
            <ul className="space-y-3">
              {serviceData.whatsIncluded.map((item) => (
                <li key={item} className="flex items-start gap-3 text-slate-700">
                  <span className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-700 flex-shrink-0">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              About {data.postcode} {data.area}
            </h2>
            <p className="text-slate-700 leading-relaxed mb-4">
              {data.area} is {data.description}. We cover {data.emergencyContext}.
            </p>
            {data.localTips.length > 0 && (
              <ul className="space-y-2 text-sm text-slate-600">
                {data.localTips.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
            )}
            <Link
              href={postcodeUrl(slug)}
              className="inline-block mt-4 text-sm text-amber-700 hover:text-amber-800 underline"
            >
              All {data.postcode} locksmith services →
            </Link>
          </div>
        </div>
      </section>

      {/* Neighborhoods */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-8">
            <p className="text-[10px] tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
              Coverage
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {serviceData.title} across {data.postcode}
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {data.neighborhoods.map((n) => (
              <span
                key={n}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-700"
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Other services in this postcode */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="text-center mb-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Other services in {data.postcode}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICE_CATALOG.filter((s) => s.id !== service)
            .slice(0, 6)
            .map((s) => (
              <Link
                key={s.id}
                href={
                  (PILLAR_POSTCODE_SERVICES as readonly string[]).includes(s.id)
                    ? postcodeServiceUrl(slug, s.id)
                    : `/services/${s.id}`
                }
                className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                    {s.priceHint}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{s.shortDescription}</p>
              </Link>
            ))}
        </div>
      </section>

      <IntentFaq items={faqs} title={`${localisedTitle} — FAQs`} eyebrow="Local answers" />

      {/* Nearby postcodes */}
      {data.nearbyPostcodes.length > 0 && (
        <section className="bg-slate-50 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {serviceData.title} in nearby postcodes
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {data.nearbyPostcodes.map((pc) => {
                const pcKey = pc.toLowerCase();
                const nearbyData = postcodeData[pcKey];
                if (!nearbyData) return null;
                return (
                  <Link
                    key={pc}
                    href={postcodeServiceUrl(nearbyData.slug, service)}
                    className="block rounded-lg border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-3 text-center"
                  >
                    <p className="font-semibold text-slate-900 text-sm">{pc}</p>
                    <p className="text-xs text-slate-500 mt-1">{nearbyData.area}</p>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">{localisedTitle}</h2>
          <Link
            href="/request"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-base font-semibold transition-colors"
          >
            Post a job in 90 seconds
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>
    </main>
  );
}
