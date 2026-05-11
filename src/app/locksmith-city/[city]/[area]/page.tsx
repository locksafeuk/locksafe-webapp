import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  getCityBySlug,
  getAllCitySlugs,
  ukCitiesData,
} from "@/lib/uk-cities-data";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  localBusinessJsonLd,
  serviceJsonLd,
  speakableJsonLd,
  ldScript,
} from "@/lib/seo";
import { cityUrl, cityAreaUrl, canonical } from "@/lib/seo/url-helpers";
import { slugify } from "@/lib/seo/url-helpers";
import { SERVICE_CATALOG } from "@/lib/services-catalog";
import { IntentFaq } from "@/components/intent/IntentFaq";

interface Props {
  params: Promise<{ city: string; area: string }>;
}

export async function generateStaticParams() {
  const out: { city: string; area: string }[] = [];
  for (const cityData of Object.values(ukCitiesData)) {
    for (const area of cityData.areas) {
      out.push({ city: cityData.slug, area: slugify(area) });
    }
  }
  return out;
}

function findAreaName(cityData: ReturnType<typeof getCityBySlug>, areaSlug: string): string | null {
  if (!cityData) return null;
  const match = cityData.areas.find((a) => slugify(a) === areaSlug);
  return match ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city, area } = await params;
  const cityData = getCityBySlug(city);
  const areaName = findAreaName(cityData, area);
  if (!cityData || !areaName) return {};

  const title = `Locksmith ${areaName}, ${cityData.name} | 24/7 Verified | LockSafe UK`;
  const description = `Verified locksmith covering ${areaName} in ${cityData.name}. DBS-checked pros, transparent pricing, GPS-tracked arrival in ${cityData.avgResponseTime}. Post your job in 90 seconds.`;

  return {
    title,
    description,
    keywords: [
      `locksmith ${areaName}`,
      `locksmith ${areaName} ${cityData.name}`,
      `emergency locksmith ${areaName}`,
      `24 hour locksmith ${areaName}`,
      `locked out ${areaName}`,
      `lock change ${areaName}`,
    ].join(", "),
    alternates: { canonical: cityAreaUrl(city, area) },
    openGraph: {
      title,
      description,
      url: canonical(cityAreaUrl(city, area)),
      type: "article",
    },
  };
}

export default async function CityAreaPage({ params }: Props) {
  const { city, area } = await params;
  const cityData = getCityBySlug(city);
  const areaName = findAreaName(cityData, area);
  if (!cityData || !areaName) notFound();

  const otherAreas = cityData.areas.filter((a) => slugify(a) !== area).slice(0, 12);
  const topServices = SERVICE_CATALOG.slice(0, 6);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: cityData.name, url: cityUrl(city) },
    { name: areaName, url: cityAreaUrl(city, area) },
  ];

  const faqs = [
    {
      question: `How quickly can a locksmith reach ${areaName}?`,
      answer: `Average LockSafe response time across ${cityData.name} (including ${areaName}) is ${cityData.avgResponseTime}. Posting a job at 3am works the same as 3pm — verified locksmiths cover ${areaName} 24/7.`,
    },
    {
      question: `Are LockSafe ${areaName} locksmiths DBS-checked?`,
      answer: `Yes. Every locksmith on LockSafe is DBS-verified, insured, and ID-confirmed. You see their profile and rating before accepting a bid in ${areaName}.`,
    },
    {
      question: `How much does a ${areaName} locksmith cost?`,
      answer: `${cityData.name} locksmith jobs typically run from £60 for lockouts to £250 for full lock changes. On LockSafe the bid you accept is the price you pay — no doorstep upsells.`,
    },
    {
      question: `Do you cover ${areaName} at night and weekends?`,
      answer: `Yes — 24/7, 365 days a year. ${areaName} sits inside ${cityData.emergencyContext}, so night and weekend coverage is the same as any weekday.`,
    },
  ];

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
            localBusinessJsonLd({
              name: `LockSafe UK Locksmith — ${areaName}, ${cityData.name}`,
              description: `Verified locksmith services in ${areaName}, ${cityData.name}.`,
              url: cityAreaUrl(city, area),
              addressLocality: areaName,
              addressRegion: cityData.region,
              coordinates: cityData.coordinates,
              areaServed: [areaName, ...otherAreas.slice(0, 5)],
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
            serviceJsonLd({
              name: `Locksmith services in ${areaName}, ${cityData.name}`,
              description: `Emergency, lock change, and burglary repair locksmiths in ${areaName}.`,
              url: cityAreaUrl(city, area),
              serviceType: "Locksmith",
              areaServed: [{ name: areaName, type: "City" }, { name: cityData.name, type: "City" }],
              priceRange: { low: 60, high: 250 },
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            speakableJsonLd({
              url: cityAreaUrl(city, area),
              cssSelectors: ["h1", "#tldr", "#faq summary"],
            }),
          ),
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <p className="text-[10px] tracking-[0.3em] uppercase text-amber-400 mb-3 font-medium">
            {cityData.name} · {areaName}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4 max-w-3xl">
            Verified locksmith in {areaName}
          </h1>
          <p className="text-base sm:text-lg text-slate-200 max-w-2xl mb-6">
            DBS-checked locksmiths covering {areaName} and the rest of {cityData.name}. Average
            response: {cityData.avgResponseTime}. Price agreed before any work starts.
          </p>
          <Link
            href="/request"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-base font-semibold transition-colors"
          >
            Get a {areaName} locksmith
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* TL;DR */}
      <section id="tldr" className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
            {areaName} sits inside {cityData.name}, {cityData.region}. LockSafe's verified network covers{" "}
            {cityData.emergencyContext} — meaning a locksmith near {areaName} usually arrives within{" "}
            {cityData.avgResponseTime}, day or night.
          </p>
        </div>
      </section>

      {/* Top services in area */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            What we handle in {areaName}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {topServices.map((s) => (
            <Link
              key={s.id}
              href={`/services/${s.id}/in/${city}`}
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

      {/* Other areas */}
      {otherAreas.length > 0 && (
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Other {cityData.name} areas we cover
              </h2>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {otherAreas.map((a) => (
                <Link
                  key={a}
                  href={cityAreaUrl(city, slugify(a))}
                  className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-700 hover:border-amber-400"
                >
                  {a}
                </Link>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link href={cityUrl(city)} className="text-sm text-amber-700 hover:text-amber-800 underline">
                ← Back to {cityData.name} locksmith
              </Link>
            </div>
          </div>
        </section>
      )}

      <IntentFaq items={faqs} title={`${areaName} locksmith — FAQs`} eyebrow="Local answers" />

      {/* Final CTA */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Need a {areaName} locksmith now?</h2>
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
