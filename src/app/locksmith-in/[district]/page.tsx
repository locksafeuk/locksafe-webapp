import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Phone } from "lucide-react";

import { prisma as _prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/config";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  localBusinessJsonLd,
  serviceJsonLd,
  ldScript,
} from "@/lib/seo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

// ── Force dynamic rendering ─────────────────────────────────────────────────
// We deliberately do NOT use generateStaticParams here. Reasons:
//   1. The DistrictLandingPage table didn't exist on Vercel's build cache
//      at the time of the initial deploys, which caused the route to be
//      excluded from the route manifest entirely (verified via Vercel's
//      route-matching showing /locksmith-in/* fell through to
//      /locksmith-city/[city]/[area]).
//   2. Build-time Prisma calls are fragile across deploy environments
//      (DATABASE_URL not always set, generated client may be stale).
//   3. The DistrictLandingPage row count is small (~80 max in the
//      foreseeable future) so per-request rendering with edge caching
//      via revalidate is performant enough.
//
// `dynamic = "force-dynamic"` skips all build-time path enumeration —
// the route registers cleanly and renders on demand. `revalidate = 3600`
// then caches each rendered page at the edge for 1 hour. notFound()
// inside the page handler gates pages without real coverage.

export const dynamic = "force-dynamic";
export const revalidate = 3600;

interface Props {
  params: Promise<{ district: string }>;
}

const PHONE_E164 = "+442045771989";

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { district: slug } = await params;
  const page = await loadPage(slug);
  if (!page) return {};

  const canonicalUrl = `${SITE_URL}/locksmith-in/${page.slug}`;
  const title       = `Locksmith in ${page.district}, ${page.anchorTown ?? "UK"} | LockSafe`;
  const description = page.heroSubcopy ?? page.heroHeadline ?? "Local locksmith service.";

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      url:   canonicalUrl,
      type:  "website",
    },
    robots: {
      index:  true,
      follow: true,
    },
  };
}

// ── Loader (DB row + coverage cross-check) ─────────────────────────────────

async function loadPage(slug: string) {
  const page: {
    id:                 string;
    district:           string;
    slug:               string;
    anchorTown:         string | null;
    region:             string | null;
    nearbyOutcodes:     string[];
    featuredEngineerName: string | null;
    heroHeadline:       string | null;
    heroSubcopy:        string | null;
    introParagraph:     string | null;
    coverageNarrative:  string | null;
    whyChooseUs:        string | null;
    faqs:               unknown;
    localTrustAnchors:  string[];
    updatedAt:          Date;
    isPublished:        boolean;
    lat:                number | null;
    lng:                number | null;
  } | null = await prisma.districtLandingPage.findUnique({
    where:  { slug: slug.toLowerCase() },
    select: {
      id: true, district: true, slug: true,
      anchorTown: true, region: true, nearbyOutcodes: true,
      featuredEngineerName: true,
      heroHeadline: true, heroSubcopy: true, introParagraph: true,
      coverageNarrative: true, whyChooseUs: true,
      faqs: true, localTrustAnchors: true,
      updatedAt: true, isPublished: true, lat: true, lng: true,
    },
  });
  if (!page || !page.isPublished) return null;

  // Defence in depth: confirm we STILL have active coverage. A page
  // can be live in the DB but coverage may have been paused since
  // generation. Don't drive ads to a page we can't fulfil.
  const activeCoverage: number = await prisma.locksmithCoverage.count({
    where: {
      postcodeDistrict: page.district,
      isPaused:         false,
    },
  });
  if (activeCoverage === 0) return null;

  return page;
}

// ── Page component ──────────────────────────────────────────────────────────

export default async function DistrictLandingPage({ params }: Props) {
  const { district: slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  const canonicalUrl = `${SITE_URL}/locksmith-in/${page.slug}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const faqs = Array.isArray(page.faqs) ? (page.faqs as Array<{ question: string; answer: string }>) : [];

  const breadcrumbs = [
    { name: "Home",     url: "/" },
    { name: "Locksmith areas", url: "/locksmith-in" },
    { name: page.district, url: `/locksmith-in/${page.slug}` },
  ];

  // Sister districts that ALSO have a published page → real internal links.
  const sisterDistricts = await prisma.districtLandingPage.findMany({
    where:  {
      isPublished: true,
      district: { in: page.nearbyOutcodes, not: page.district },
    },
    select: { district: true, slug: true, anchorTown: true },
    take:   8,
  });

  return (
    <main className="bg-white">
      {/* ── Structured data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldScript(breadcrumbJsonLd(breadcrumbs)) }}
      />
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldScript(faqJsonLd(faqs)) }}
        />
      )}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            localBusinessJsonLd({
              name:            `LockSafe — Locksmith ${page.district}`,
              description:     page.heroSubcopy ?? "",
              url:             canonicalUrl,
              addressLocality: page.anchorTown ?? page.district,
              addressRegion:   page.region ?? "United Kingdom",
              coordinates:     page.lat !== null && page.lng !== null
                ? { lat: page.lat, lng: page.lng }
                : { lat: 51.5074, lng: -0.1278 },
              areaServed:      [page.district, ...page.nearbyOutcodes.slice(0, 5)],
              priceRange:      "££",
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            serviceJsonLd({
              name:        `Emergency Locksmith in ${page.district}`,
              description:
                page.heroSubcopy ??
                `24/7 emergency locksmith service across ${page.district}${
                  page.anchorTown ? `, ${page.anchorTown}` : ""
                }. DBS-checked local engineers; price agreed before any work starts.`,
              url:         canonicalUrl,
              serviceType: "Locksmith",
              areaServed:  [page.district, ...page.nearbyOutcodes.slice(0, 5)].map((name) => ({
                name,
                type: "City" as const,
              })),
              provider: {
                name:      "LockSafe",
                telephone: PHONE_E164,
                url:       SITE_URL,
              },
            }),
          ),
        }}
      />

      {/* ── Hero ── */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <p className="text-[11px] sm:text-xs tracking-[0.3em] uppercase text-amber-600 mb-3 font-medium">
            {page.anchorTown ?? "UK"} · {page.district}
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight">
            {page.heroHeadline}
          </h1>
          {page.heroSubcopy && (
            <p className="text-lg sm:text-xl text-slate-700 leading-relaxed mb-7">
              {page.heroSubcopy}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`tel:${PHONE_E164}`}
              data-call-id={`district-hero-${page.slug}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold transition-colors"
            >
              <Phone className="w-4 h-4" /> Call {PHONE_E164}
            </a>
            <Link
              href="/request"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"
            >
              Book online
            </Link>
          </div>
        </div>
      </section>

      {/* ── Local trust strip ── */}
      {page.localTrustAnchors.length > 0 && (
        <section className="border-b border-slate-200">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {page.localTrustAnchors.map((bullet, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm sm:text-base text-slate-700"
                >
                  <span aria-hidden className="text-amber-500 font-bold mt-0.5">✓</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── Intro paragraph ── */}
      {page.introParagraph && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <p className="text-base sm:text-lg text-slate-800 leading-relaxed">
            {page.introParagraph}
          </p>
        </section>
      )}

      {/* ── Coverage narrative ── */}
      {page.coverageNarrative && (
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
              Local coverage for {page.district}
            </h2>
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
              {page.coverageNarrative}
            </p>
          </div>
        </section>
      )}

      {/* ── Why choose us ── */}
      {page.whyChooseUs && (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-4">
            Why {page.anchorTown ?? "local"} customers choose LockSafe
          </h2>
          <p className="text-base sm:text-lg text-slate-700 leading-relaxed">
            {page.whyChooseUs}
          </p>
        </section>
      )}

      {/* ── FAQs ── */}
      {faqs.length > 0 && (
        <section id="faq" className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
              Questions {page.anchorTown ? `${page.anchorTown} residents` : "locals"} ask us
            </h2>
            <div className="space-y-4">
              {faqs.map((f, i) => (
                <details
                  key={i}
                  className="group rounded-xl border border-slate-200 bg-white p-5 open:shadow-sm"
                >
                  <summary className="cursor-pointer font-semibold text-slate-900 list-none flex items-start justify-between gap-3">
                    <span>{f.question}</span>
                    <span aria-hidden className="text-amber-500 group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-3 text-slate-700 leading-relaxed">{f.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Nearby areas (sister districts with published pages) ── */}
      {sisterDistricts.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6">
            Nearby areas we also cover
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {sisterDistricts.map((s: { district: string; slug: string; anchorTown: string | null }) => (
              <Link
                key={s.slug}
                href={`/locksmith-in/${s.slug}`}
                className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-4"
              >
                <div className="font-semibold text-slate-900">{s.district}</div>
                {s.anchorTown && (
                  <div className="text-sm text-slate-600 mt-0.5">{s.anchorTown}</div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Final CTA ── */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Need a locksmith in {page.district} now?
          </h2>
          <p className="text-slate-300 text-base sm:text-lg mb-6">
            Speak to LockSafe. We dispatch a real local engineer around the clock.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`tel:${PHONE_E164}`}
              data-call-id={`district-footer-${page.slug}`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold transition-colors"
            >
              <Phone className="w-4 h-4" /> Call {PHONE_E164}
            </a>
            <Link
              href="/request"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-medium transition-colors"
            >
              Book online
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
