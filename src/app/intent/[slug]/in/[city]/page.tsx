import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  loadIntentLandingBySlug,
  loadAllIntentLandingSlugs,
} from "@/lib/intent-landings-store";
import {
  getCityBySlug,
  getAllCitySlugs,
  getNearbyCities,
} from "@/lib/uk-cities-data";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  localBusinessJsonLd,
  serviceJsonLd,
  speakableJsonLd,
  ldScript,
} from "@/lib/seo";
import { intentGeoUrl, intentUrl, canonical } from "@/lib/seo/url-helpers";
import { resolveIntentVariant, pickHook } from "@/lib/seo/intent-ab";
import { getServiceBySlug } from "@/lib/services-catalog";
import { IntentHero } from "@/components/intent/IntentHero";
import { TrustConfidence } from "@/components/intent/TrustConfidence";
import { IntentFaq } from "@/components/intent/IntentFaq";
import { IntentTracker } from "@/components/intent/IntentTracker";

interface Props {
  params: Promise<{ slug: string; city: string }>;
}

/**
 * Pre-build the top 15 highest-traffic UK cities at deploy time.
 * All other city combinations are generated on first request and cached
 * via ISR (revalidate = 86400). This keeps the build under ~3 min while
 * still giving Google fast access to every page.
 *
 * Previous approach (all 79 cities × all intents = 948 pages) was the
 * main cause of 5–8 min build times.
 */

// Revalidate ISR pages every 24 hours
export const revalidate = 86400;

const TOP_CITIES = [
  "london", "manchester", "birmingham", "liverpool", "leeds",
  "sheffield", "bristol", "edinburgh", "glasgow", "nottingham",
  "oxford", "reading", "brighton", "southampton", "cambridge",
];

export async function generateStaticParams() {
  const intentSlugs = await loadAllIntentLandingSlugs();
  const out: { slug: string; city: string }[] = [];
  for (const slug of intentSlugs) {
    for (const city of TOP_CITIES) {
      out.push({ slug, city });
    }
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, city } = await params;
  const landing = await loadIntentLandingBySlug(slug);
  const cityData = getCityBySlug(city);
  if (!landing || !cityData) return {};

  const title = `${landing.title} in ${cityData.name} | Verified Locksmith | LockSafe UK`;
  const description = `${landing.title} in ${cityData.name}? Verified, DBS-checked locksmiths covering ${cityData.areas.slice(0, 3).join(", ")} & all ${cityData.region}. Price agreed before any work starts. Average response ${cityData.avgResponseTime}.`;
  const keywords = [
    landing.pillarKeyword,
    ...landing.intentTags,
    `locksmith ${cityData.name}`,
    `${landing.title.toLowerCase()} ${cityData.name}`,
    ...cityData.areas.slice(0, 5).map((a) => `locksmith ${a}`),
  ].filter(Boolean) as string[];

  return {
    title,
    description,
    keywords: keywords.join(", "),
    alternates: { canonical: intentGeoUrl(slug, city) },
    openGraph: {
      title,
      description,
      url: canonical(intentGeoUrl(slug, city)),
      type: "article",
    },
  };
}

export default async function IntentGeoPage({ params }: Props) {
  const { slug, city } = await params;
  const landing = await loadIntentLandingBySlug(slug);
  const cityData = getCityBySlug(city);
  if (!landing || !cityData) notFound();

  const hasVariantB = Boolean(landing.emotionalHookB && landing.emotionalHookB.trim().length > 0);
  const variant = await resolveIntentVariant(slug, hasVariantB);
  const picked = pickHook(
    {
      emotionalHook: landing.emotionalHook ?? null,
      heroSubcopy: landing.heroSubcopy ?? null,
      emotionalHookB: landing.emotionalHookB ?? null,
      heroSubcopyB: landing.heroSubcopyB ?? null,
    },
    variant,
  );

  // Geo-localise the hook
  const localisedHeadline = `${picked.emotionalHook || landing.h1} — in ${cityData.name}`;
  const localisedSubcopy =
    picked.heroSubcopy ||
    `Verified locksmiths across ${cityData.emergencyContext}. Average response ${cityData.avgResponseTime}.`;

  const services = (landing.serviceFilter.serviceSlugs ?? [])
    .map((s) => getServiceBySlug(s))
    .filter((s): s is NonNullable<ReturnType<typeof getServiceBySlug>> => Boolean(s));

  const nearby = getNearbyCities(city).slice(0, 6);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Scenarios", url: "/intent" },
    { name: landing.title, url: intentUrl(slug) },
    { name: cityData.name, url: intentGeoUrl(slug, city) },
  ];

  // Localise FAQs: add a city-specific Q&A at the top of the list
  const localFaqs = [
    {
      question: `How quickly can a locksmith reach me in ${cityData.name}?`,
      answer: `Average LockSafe response time in ${cityData.name} is ${cityData.avgResponseTime} thanks to our network covering ${cityData.areas.slice(0, 4).join(", ")} and all surrounding ${cityData.region} areas.`,
    },
    ...landing.faqs,
  ];

  return (
    <main>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldScript(breadcrumbJsonLd(breadcrumbs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldScript(faqJsonLd(localFaqs)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            serviceJsonLd({
              name: `${landing.h1} in ${cityData.name}`,
              description: landing.metaDescription || landing.intro || landing.h1,
              url: intentGeoUrl(slug, city),
              serviceType: landing.pillarKeyword || "Locksmith Service",
              areaServed: [
                { name: cityData.name, type: "City" },
                ...cityData.areas.slice(0, 5).map((a) => ({ name: a, type: "City" as const })),
              ],
              priceRange: { low: 60, high: 250 },
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            localBusinessJsonLd({
              name: `LockSafe UK — ${landing.title} in ${cityData.name}`,
              description: `${landing.title} provided by verified UK locksmiths across ${cityData.name} and ${cityData.region}.`,
              url: intentGeoUrl(slug, city),
              addressLocality: cityData.name,
              addressRegion: cityData.region,
              coordinates: cityData.coordinates,
              areaServed: cityData.areas.slice(0, 10),
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
            speakableJsonLd({
              url: intentGeoUrl(slug, city),
              cssSelectors: ["h1", "#tldr", "#faq h2", "#faq summary"],
            }),
          ),
        }}
      />

      <IntentTracker
        slug={slug}
        pillarKeyword={landing.pillarKeyword ?? null}
        intentTags={[...landing.intentTags, `city:${city}`]}
        variant={variant}
        isAbTestRunning={hasVariantB}
      />

      <IntentHero
        landing={{
          h1: localisedHeadline,
          pillarKeyword: landing.pillarKeyword ?? undefined,
          intentTags: landing.intentTags,
          eyebrow: `${cityData.name} · ${landing.pillarKeyword?.replace(/-/g, " ") || "Locksmith"}`,
          emotionalHook: localisedHeadline,
          heroSubcopy: localisedSubcopy,
        }}
        ctaLabel={`Get a ${cityData.name} locksmith`}
      />

      {/* City-context strip */}
      <section id="tldr" className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 text-sm">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Coverage</p>
              <p className="font-semibold text-slate-900">{cityData.emergencyContext}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Response</p>
              <p className="font-semibold text-slate-900">{cityData.avgResponseTime}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Region</p>
              <p className="font-semibold text-slate-900">{cityData.region}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Postcodes</p>
              <p className="font-semibold text-slate-900">{cityData.postcodeAreas.join(", ")}</p>
            </div>
          </div>
          {landing.intro && (
            <p className="text-base text-slate-700 leading-relaxed mt-6 pt-6 border-t border-slate-200">
              {landing.intro}
            </p>
          )}
        </div>
      </section>

      {/* Trust modules */}
      {landing.blocks.trustConfidence.length > 0 && (
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <TrustConfidence items={landing.blocks.trustConfidence} />
          </div>
        </section>
      )}

      {/* Areas covered */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-8">
            <p className="text-[10px] tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
              Coverage
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              Areas we cover in {cityData.name}
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {cityData.areas.map((area) => (
              <span
                key={area}
                className="px-3 py-1.5 rounded-full bg-white border border-slate-200 text-sm text-slate-700"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      {services.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {cityData.name} locksmith services
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <Link
                key={s.id}
                href={`/services/${s.id}/in/${city}`}
                className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="font-semibold text-slate-900">{s.title} in {cityData.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                    {s.priceHint}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{s.shortDescription}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <IntentFaq items={localFaqs} title={`${landing.title} in ${cityData.name} — FAQs`} eyebrow="Local answers" />

      {/* Nearby cities */}
      {nearby.length > 0 && (
        <section className="bg-slate-50 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="text-center mb-8">
              <p className="text-[10px] tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
                Nearby cities
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Same scenario in a different city
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {nearby.map((c) => (
                <Link
                  key={c.slug}
                  href={`/intent/${slug}/in/${c.slug}`}
                  className="block rounded-lg border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-3 text-center"
                >
                  <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{c.region}</p>
                </Link>
              ))}
            </div>
            <div className="text-center mt-6">
              <Link
                href={intentUrl(slug)}
                className="text-sm text-amber-700 hover:text-amber-800 underline"
              >
                ← Back to {landing.title}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Verified {cityData.name} locksmith, transparent price
          </h2>
          <p className="text-slate-300 mb-7 max-w-xl mx-auto">
            Post the job, pick the locksmith. Average {cityData.name} response: {cityData.avgResponseTime}.
          </p>
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
