import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  getServiceBySlug,
  getAllServiceSlugs,
} from "@/lib/services-catalog";
import {
  getCityBySlug,
  getNearbyCities,
} from "@/lib/uk-cities-data";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  localBusinessJsonLd,
  serviceJsonLd,
  howToJsonLd,
  speakableJsonLd,
  ldScript,
} from "@/lib/seo";
import { serviceGeoUrl, serviceUrl, canonical, cityUrl } from "@/lib/seo/url-helpers";
import { IntentFaq } from "@/components/intent/IntentFaq";

interface Props {
  params: Promise<{ slug: string; city: string }>;
}

// Revalidate ISR pages every 24 hours
export const revalidate = 86400;

// Pre-build top 15 cities only; remaining 64 cities are generated on first
// request and cached (ISR). Keeps build time ~3 min instead of 5–8 min.
const TOP_CITIES = [
  "london", "manchester", "birmingham", "liverpool", "leeds",
  "sheffield", "bristol", "edinburgh", "glasgow", "nottingham",
  "oxford", "reading", "brighton", "southampton", "cambridge",
];

export async function generateStaticParams() {
  const serviceSlugs = getAllServiceSlugs();
  const out: { slug: string; city: string }[] = [];
  for (const slug of serviceSlugs) {
    for (const city of TOP_CITIES) {
      out.push({ slug, city });
    }
  }
  return out;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, city } = await params;
  const service = getServiceBySlug(slug);
  const cityData = getCityBySlug(city);
  if (!service || !cityData) return {};

  const title = `${service.title} in ${cityData.name} | Verified Locksmith | LockSafe UK`;
  const description = `${service.title} in ${cityData.name} from ${service.priceHint}. DBS-verified locksmiths, price agreed before any work starts, GPS-tracked arrival. Average response ${cityData.avgResponseTime} across ${cityData.region}.`;
  const keywords = [
    `${service.title} ${cityData.name}`,
    `locksmith ${cityData.name}`,
    ...service.keywords.map((k) => `${k} ${cityData.name}`),
    ...cityData.areas.slice(0, 5).map((a) => `${service.title} ${a}`),
  ];

  return {
    title,
    description,
    keywords: keywords.join(", "),
    alternates: { canonical: serviceGeoUrl(slug, city) },
    openGraph: {
      title,
      description,
      url: canonical(serviceGeoUrl(slug, city)),
      type: "article",
    },
  };
}

export default async function ServiceGeoPage({ params }: Props) {
  const { slug, city } = await params;
  const service = getServiceBySlug(slug);
  const cityData = getCityBySlug(city);
  if (!service || !cityData) notFound();

  const nearby = getNearbyCities(city).slice(0, 6);
  const isAutoServiceJourney = /(car|auto|vehicle)/i.test(slug);
  const requestHref = isAutoServiceJourney ? "/request?type=auto" : "/request";

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Services", url: "/services" },
    { name: service.title, url: serviceUrl(slug) },
    { name: cityData.name, url: serviceGeoUrl(slug, city) },
  ];

  // Localised FAQ — prepend a city-specific Q to the service's own FAQs.
  const localFaqs = [
    {
      question: `How much does ${service.title.toLowerCase()} cost in ${cityData.name}?`,
      answer: `${service.title} in ${cityData.name} starts from ${service.priceHint}. The bid you accept on LockSafe is the price you pay — no doorstep upsells, no surprise fees. Final price depends on lock type and time of day.`,
    },
    {
      question: `How fast can a locksmith reach ${cityData.name}?`,
      answer: `Average LockSafe response time in ${cityData.name} is ${cityData.avgResponseTime}, covering ${cityData.areas.slice(0, 4).join(", ")} and all of ${cityData.region}.`,
    },
    ...service.faqs.slice(0, 6),
  ];

  const localTitle = `${service.title} in ${cityData.name}`;

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
              name: localTitle,
              description: service.shortDescription,
              url: serviceGeoUrl(slug, city),
              serviceType: service.title,
              areaServed: [
                { name: cityData.name, type: "City" },
                ...cityData.areas.slice(0, 5).map((a) => ({ name: a, type: "City" as const })),
              ],
              priceRange:
                service.priceRangeLow && service.priceRangeHigh
                  ? { low: service.priceRangeLow, high: service.priceRangeHigh }
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
              name: `LockSafe UK — ${localTitle}`,
              description: `${service.title} provided by verified UK locksmiths across ${cityData.name} and ${cityData.region}.`,
              url: serviceGeoUrl(slug, city),
              addressLocality: cityData.name,
              addressRegion: cityData.region,
              coordinates: cityData.coordinates,
              areaServed: cityData.areas.slice(0, 10),
              rating: { value: 4.9, count: 1250 },
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            howToJsonLd({
              name: `How to get ${service.title.toLowerCase()} in ${cityData.name}`,
              description: `Three steps to a verified ${cityData.name} locksmith with transparent pricing.`,
              totalTime: "PT5M",
              steps: [
                { name: "Post the job", text: `Describe what's happened — takes 90 seconds.` },
                { name: "Compare bids", text: `Verified ${cityData.name} locksmiths bid the price before any work starts.` },
                { name: "Locksmith arrives", text: `GPS-tracked arrival in ${cityData.avgResponseTime}.` },
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
              url: serviceGeoUrl(slug, city),
              cssSelectors: ["h1", "#tldr", "#faq h2", "#faq summary"],
            }),
          ),
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <p className="text-[10px] tracking-[0.3em] uppercase text-amber-400 mb-3 font-medium">
            {cityData.name} · {service.title}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4 max-w-3xl">
            {service.title} in {cityData.name}
          </h1>
          <p className="text-base sm:text-lg text-slate-200 max-w-2xl mb-6">
            {service.subhead} Average response in {cityData.name}: {cityData.avgResponseTime}.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={requestHref}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-base font-semibold transition-colors"
            >
              Get a verified {cityData.name} locksmith
              <span aria-hidden>→</span>
            </Link>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm">
              From {service.priceHint}
            </span>
          </div>
        </div>
      </section>

      {/* TL;DR */}
      <section id="tldr" className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
            {service.aiSummary || service.shortDescription}
          </p>
        </div>
      </section>

      {/* What's included */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              What's included
            </h2>
            <ul className="space-y-3">
              {service.whatsIncluded.map((item) => (
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
              About {cityData.name}
            </h2>
            <p className="text-slate-700 leading-relaxed mb-4">{cityData.description}.</p>
            <p className="text-sm text-slate-600 mb-3">
              <strong className="text-slate-900">Coverage:</strong> {cityData.emergencyContext}
            </p>
            <p className="text-sm text-slate-600 mb-3">
              <strong className="text-slate-900">Postcodes:</strong> {cityData.postcodeAreas.join(", ")}
            </p>
            <Link
              href={cityUrl(city)}
              className="inline-block mt-3 text-sm text-amber-700 hover:text-amber-800 underline"
            >
              See all {cityData.name} locksmith services →
            </Link>
          </div>
        </div>
      </section>

      {/* Areas */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="text-center mb-8">
            <p className="text-[10px] tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
              {cityData.name} areas
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {service.title} across {cityData.name}
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

      {/* FAQ */}
      <IntentFaq items={localFaqs} title={`${localTitle} — FAQs`} eyebrow="Local answers" />

      {/* Nearby cities */}
      {nearby.length > 0 && (
        <section className="bg-slate-50 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="text-center mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                {service.title} in nearby cities
              </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {nearby.map((c) => (
                <Link
                  key={c.slug}
                  href={`/services/${slug}/in/${c.slug}`}
                  className="block rounded-lg border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-3 text-center"
                >
                  <p className="font-semibold text-slate-900 text-sm">{c.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{c.region}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">{localTitle} — transparent price up-front</h2>
          <Link
            href={requestHref}
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
