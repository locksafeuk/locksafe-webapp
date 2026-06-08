import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getCompetitorBySlug } from "@/lib/competitor-alternatives";
import { SITE_NAME, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/lib/config";
import { localizedAltPairs } from "@/lib/coverage-cities";
import { canonical, slugify } from "@/lib/seo/url-helpers";
import { ukCitiesData } from "@/lib/uk-cities-data";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ competitor: string; city: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return localizedAltPairs();
}

function resolve(competitor: string, city: string) {
  const c = getCompetitorBySlug(competitor);
  const cityData = ukCitiesData[city];
  if (!c || !cityData) return null;
  return { c, cityData };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { competitor, city } = await params;
  const r = resolve(competitor, city);
  if (!r) return { title: `Not Found | ${SITE_NAME}` };
  const { c, cityData } = r;

  const title = `${c.name} Alternative in ${cityData.name} | ${SITE_NAME}`;
  const description = `Looking for a ${c.name} alternative in ${cityData.name}? ${SITE_NAME} connects you with verified, DBS-checked locksmiths covering ${cityData.name} — the price agreed before any work starts, and a documented job. Free for customers.`;
  const url = canonical(`/alternatives/${c.slug}/in/${city}`);

  return {
    title,
    description,
    keywords: [
      `${c.name} alternative ${cityData.name}`,
      `${c.name} alternative in ${cityData.name}`,
      `alternative to ${c.name} ${cityData.name}`,
      `locksmith like ${c.name} ${cityData.name}`,
      `${cityData.name} locksmith`,
    ],
    alternates: { canonical: url },
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
      url,
      siteName: SITE_NAME,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function LocalizedAlternativePage({ params }: PageProps) {
  const { competitor, city } = await params;
  const r = resolve(competitor, city);
  if (!r) notFound();
  const { c, cityData } = r;

  const url = canonical(`/alternatives/${c.slug}/in/${city}`);
  const h1 = `${c.name} alternative in ${cityData.name}`;
  const comparisonHeading = `${c.name} vs ${SITE_NAME}: Comparison`;
  const areas = cityData.areas.slice(0, 10);

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: canonical("/") },
      {
        "@type": "ListItem",
        position: 2,
        name: "Alternatives",
        item: canonical("/alternatives"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${c.name} Alternative`,
        item: canonical(`/alternatives/${c.slug}`),
      },
      { "@type": "ListItem", position: 4, name: cityData.name, item: url },
    ],
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: c.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <>
      <Header />

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

      <main className="pb-24 md:pb-0">
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="bg-slate-900 text-white">
          <div className="section-container py-14 md:py-20">
            <nav
              aria-label="Breadcrumb"
              className="mb-4 text-sm text-slate-400"
            >
              <Link href="/alternatives" className="hover:text-white">
                Alternatives
              </Link>
              <span className="mx-2">/</span>
              <Link
                href={`/alternatives/${c.slug}`}
                className="hover:text-white"
              >
                {c.name} Alternative
              </Link>
            </nav>

            <p className="mb-3 inline-block rounded-full bg-orange-500/15 px-3 py-1 text-sm font-semibold text-orange-400">
              Covering {cityData.name} · response {cityData.avgResponseTime}
            </p>

            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              {h1}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">
              Verified, DBS-checked locksmiths covering {cityData.name} — with
              the full price agreed before any work starts and a documented job.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/request"
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-orange-600"
              >
                Get a {cityData.name} locksmith →
              </Link>
              <a
                href={`tel:${SUPPORT_PHONE_TEL}`}
                className="inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Call {SUPPORT_PHONE}
              </a>
            </div>
          </div>
        </section>

        {/* ── Why LockSafe in {city} ─────────────────────────────────────── */}
        <section className="bg-white py-14">
          <div className="section-container max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold text-slate-900">
              A {c.name} alternative that covers {cityData.name}
            </h2>
            <p className="mb-5 text-lg leading-relaxed text-slate-600">
              {c.whatTheyAre}
            </p>
            <p className="mb-4 text-lg leading-relaxed text-slate-700">
              {SITE_NAME}'s verified locksmith network covers {cityData.name}{" "}
              and the surrounding area, with an average response of{" "}
              {cityData.avgResponseTime}. You compare locksmiths on fee, ETA and
              rating, approve a fixed quote before any work starts, and get a
              full PDF record of the job — GPS, photos and a digital signature.
            </p>
          </div>
        </section>

        {/* ── Comparison table ───────────────────────────────────────────── */}
        <section className="bg-slate-50 py-14">
          <div className="section-container max-w-4xl">
            <h2 className="mb-6 text-3xl font-bold text-slate-900">
              {comparisonHeading}
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100">
                    <th className="px-5 py-4 font-semibold text-slate-700">
                      &nbsp;
                    </th>
                    <th className="px-5 py-4 font-semibold text-slate-700">
                      {c.name}
                    </th>
                    <th className="px-5 py-4 font-semibold text-orange-600">
                      {SITE_NAME}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.comparison.map((row) => (
                    <tr
                      key={row.dimension}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <th
                        scope="row"
                        className="px-5 py-4 font-semibold text-slate-900"
                      >
                        {row.dimension}
                      </th>
                      <td className="px-5 py-4 text-slate-600">{row.them}</td>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        {row.lockSafe}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Areas covered (cross-link to existing city/area pages) ─────── */}
        <section className="bg-white py-14">
          <div className="section-container max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold text-slate-900">
              Areas we cover in {cityData.name}
            </h2>
            <div className="flex flex-wrap gap-2">
              {areas.map((area) => (
                <Link
                  key={area}
                  href={`/locksmith-city/${city}/${slugify(area)}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700 transition hover:border-orange-300 hover:text-orange-600"
                >
                  {area}
                </Link>
              ))}
            </div>
            <p className="mt-5">
              <Link
                href={`/locksmith-city/${city}`}
                className="font-semibold text-orange-600 hover:underline"
              >
                See all {cityData.name} locksmith coverage →
              </Link>
            </p>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className="bg-slate-50 py-14">
          <div className="section-container max-w-3xl">
            <h2 className="mb-6 text-3xl font-bold text-slate-900">
              {c.name} alternative in {cityData.name} — FAQs
            </h2>
            <div className="space-y-6">
              {c.faqs.map((f) => (
                <div key={f.q}>
                  <h3 className="mb-2 text-lg font-semibold text-slate-900">
                    {f.q}
                  </h3>
                  <p className="text-slate-700">{f.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────────────── */}
        <section className="bg-slate-900 py-14 text-white">
          <div className="section-container max-w-3xl text-center">
            <h2 className="mb-4 text-3xl font-bold">
              Need a locksmith in {cityData.name}?
            </h2>
            <p className="mb-8 text-lg text-slate-300">
              Post your job in 90 seconds. Compare verified locksmiths covering{" "}
              {cityData.name}, see the price first, and get a documented job.
            </p>
            <div className="flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/request"
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-orange-600"
              >
                Get Emergency Help →
              </Link>
              <a
                href={`tel:${SUPPORT_PHONE_TEL}`}
                className="inline-flex items-center justify-center rounded-lg border border-white/30 px-6 py-3 text-base font-semibold text-white transition hover:bg-white/10"
              >
                Call {SUPPORT_PHONE}
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
