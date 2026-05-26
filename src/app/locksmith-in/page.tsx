import type { Metadata } from "next";
import Link from "next/link";
import { Phone } from "lucide-react";

import { prisma as _prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/config";
import {
  breadcrumbJsonLd,
  itemListJsonLd,
  ldScript,
} from "@/lib/seo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

const PHONE_E164 = "+442045771989";

// ── Force dynamic rendering ─────────────────────────────────────────────────
// Build-time Prisma calls were unreliable on Vercel's initial deploys
// of this feature (DistrictLandingPage table didn't exist at build
// time of the parent commits), causing the route to be excluded from
// the manifest. force-dynamic guarantees the route registers; the
// 1-hour edge cache via revalidate keeps it cheap.
export const dynamic = "force-dynamic";
export const revalidate = 3600;

// ── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title:       "Find a Local LockSafe Locksmith by Postcode | LockSafe UK",
  description: "Browse LockSafe's local locksmith coverage by UK postcode district. DBS-checked engineers, fixed price agreed before any work starts, 24/7 dispatch.",
  alternates:  { canonical: `${SITE_URL}/locksmith-in` },
  openGraph: {
    title:       "Find a Local LockSafe Locksmith by Postcode | LockSafe UK",
    description: "Browse LockSafe's local locksmith coverage by UK postcode district.",
    url:         `${SITE_URL}/locksmith-in`,
    type:        "website",
  },
  robots: { index: true, follow: true },
};

// ── Region grouping ────────────────────────────────────────────────────────

interface DistrictRow {
  district:     string;
  slug:         string;
  anchorTown:   string | null;
  region:       string | null;
  heroSubcopy:  string | null;
  isPublished:  boolean;
}

/**
 * Bucket districts into broad UK regions for friendly grouping on the
 * hub. Falls back to a Region.Other catch-all when the row's `region`
 * field doesn't map (this happens when postcodes.io returned a county
 * we don't have an explicit bucket for).
 */
const REGION_BUCKETS: Array<{ label: string; match: (region: string) => boolean }> = [
  { label: "London",            match: (r) => /london/i.test(r) },
  { label: "South East",        match: (r) => /surrey|kent|sussex|hampshire|berkshire|hertfordshire|essex|buckinghamshire|oxfordshire|berkshire/i.test(r) },
  { label: "South West",        match: (r) => /bristol|somerset|devon|cornwall|gloucestershire|wiltshire|dorset/i.test(r) },
  { label: "Midlands",          match: (r) => /birmingham|leicester|nottingham|coventry|warwickshire|derbyshire|staffordshire|west midlands|east midlands/i.test(r) },
  { label: "North West",        match: (r) => /manchester|liverpool|lancashire|cheshire|greater manchester|merseyside/i.test(r) },
  { label: "North East",        match: (r) => /yorkshire|newcastle|durham|sunderland|teesside|tyne/i.test(r) },
  { label: "Wales",             match: (r) => /wales|cardiff|swansea|glamorgan/i.test(r) },
  { label: "Scotland",          match: (r) => /scotland|edinburgh|glasgow|aberdeen|fife|lothian|stirling/i.test(r) },
  { label: "Northern Ireland",  match: (r) => /northern ireland|belfast|antrim|down/i.test(r) },
];

function bucketRegion(region: string | null): string {
  if (!region) return "Other";
  for (const b of REGION_BUCKETS) if (b.match(region)) return b.label;
  return region;  // fall through to the raw region string when no bucket matches
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function LocksmithInHub() {
  const rows: DistrictRow[] = await prisma.districtLandingPage.findMany({
    where:  { isPublished: true },
    select: {
      district: true, slug: true, anchorTown: true,
      region: true, heroSubcopy: true, isPublished: true,
    },
    orderBy: [{ region: "asc" }, { district: "asc" }],
  });

  // Group by region bucket
  const grouped = new Map<string, DistrictRow[]>();
  for (const r of rows) {
    const bucket = bucketRegion(r.region);
    if (!grouped.has(bucket)) grouped.set(bucket, []);
    grouped.get(bucket)!.push(r);
  }
  // Stable order: known regions first in the order defined above, then anything else alphabetically
  const orderedBuckets: string[] = [
    ...REGION_BUCKETS.map((b) => b.label).filter((l) => grouped.has(l)),
    ...Array.from(grouped.keys())
        .filter((k) => !REGION_BUCKETS.some((b) => b.label === k))
        .sort(),
  ];

  const breadcrumbs = [
    { name: "Home",                url: "/" },
    { name: "Find a local locksmith", url: "/locksmith-in" },
  ];

  const itemList = rows.map((r) => ({
    url:   `/locksmith-in/${r.slug}`,
    name:  `Locksmith in ${r.district}${r.anchorTown ? ` (${r.anchorTown})` : ""}`,
  }));

  return (
    <main className="bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldScript(breadcrumbJsonLd(breadcrumbs)) }}
      />
      {itemList.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldScript(itemListJsonLd(itemList)) }}
        />
      )}

      {/* ── Hero ── */}
      <section className="bg-slate-50 border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 text-center">
          <p className="text-[11px] sm:text-xs tracking-[0.3em] uppercase text-amber-600 mb-3 font-medium">
            Local coverage · UK
          </p>
          <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 mb-4 leading-tight">
            Find a local LockSafe locksmith by postcode
          </h1>
          <p className="text-lg sm:text-xl text-slate-700 leading-relaxed mb-7 max-w-2xl mx-auto">
            We dispatch DBS-checked, insured engineers across the UK. Fixed price agreed before any work starts. No callout fee.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`tel:${PHONE_E164}`}
              data-call-id="locksmith-in-hub-hero"
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

      {/* ── Districts grouped by region ── */}
      {rows.length === 0 ? (
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">
            Coverage is being added across the UK
          </h2>
          <p className="text-slate-700">
            We&apos;re actively expanding. Call us on {PHONE_E164} — chances are we still cover your area, even if it isn&apos;t listed here yet.
          </p>
        </section>
      ) : (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">
            Areas LockSafe covers
          </h2>
          <p className="text-slate-700 mb-8">
            {rows.length} postcode district{rows.length === 1 ? "" : "s"} with active local coverage.
            Tap a district to see your local engineer.
          </p>
          {orderedBuckets.map((bucket) => {
            const items = grouped.get(bucket)!;
            return (
              <div key={bucket} className="mb-10 last:mb-0">
                <h3 className="text-lg sm:text-xl font-semibold text-slate-900 mb-4 pb-2 border-b border-slate-200">
                  {bucket}
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {items.length} district{items.length === 1 ? "" : "s"}
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {items.map((r) => (
                    <Link
                      key={r.slug}
                      href={`/locksmith-in/${r.slug}`}
                      className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <div className="font-semibold text-slate-900 text-lg">{r.district}</div>
                          {r.anchorTown && (
                            <div className="text-sm text-slate-600 mt-0.5">{r.anchorTown}</div>
                          )}
                        </div>
                        <span aria-hidden className="text-amber-500 mt-1">→</span>
                      </div>
                      {r.heroSubcopy && (
                        <p className="text-sm text-slate-600 line-clamp-2 mt-2">{r.heroSubcopy}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* ── Trust strip ── */}
      <section className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm sm:text-base text-slate-700">
            <li className="flex items-center gap-2"><span aria-hidden className="text-amber-500 font-bold">✓</span><span>DBS-checked</span></li>
            <li className="flex items-center gap-2"><span aria-hidden className="text-amber-500 font-bold">✓</span><span>Insured</span></li>
            <li className="flex items-center gap-2"><span aria-hidden className="text-amber-500 font-bold">✓</span><span>Fixed price</span></li>
            <li className="flex items-center gap-2"><span aria-hidden className="text-amber-500 font-bold">✓</span><span>No callout fee</span></li>
            <li className="flex items-center gap-2"><span aria-hidden className="text-amber-500 font-bold">✓</span><span>24/7 dispatch</span></li>
            <li className="flex items-center gap-2"><span aria-hidden className="text-amber-500 font-bold">✓</span><span>Real local engineer</span></li>
          </ul>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Don&apos;t see your postcode listed?
          </h2>
          <p className="text-slate-300 text-base sm:text-lg mb-6">
            Call LockSafe — we cover most of the UK and dispatch a real local engineer around the clock.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href={`tel:${PHONE_E164}`}
              data-call-id="locksmith-in-hub-footer"
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
