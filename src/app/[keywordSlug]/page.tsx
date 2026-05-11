import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Clock, MapPin, CheckCircle2 } from "lucide-react";

import {
  generateKeywordPageParams,
  resolveKeywordPage,
  renderKeywordLanding,
} from "@/lib/keyword-templates-store";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  ldScript,
  speakableJsonLd,
} from "@/lib/seo";
import { canonical } from "@/lib/seo/url-helpers";

interface Props {
  params: Promise<{ keywordSlug: string }>;
}

// SSG-only: any URL not produced by `generateKeywordPageParams` returns 404
// instead of triggering an on-demand DB lookup. This prevents the catch-all
// route from accidentally serving content for unrelated paths.
export const dynamicParams = false;

export async function generateStaticParams() {
  return generateKeywordPageParams();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { keywordSlug } = await params;
  const match = await resolveKeywordPage(keywordSlug);
  if (!match) return {};
  const page = renderKeywordLanding(match.template, match.city);
  return {
    title: page.metaTitle,
    description: page.metaDescription,
    keywords: [match.template.slug, ...match.template.intentTags, match.city.name]
      .filter(Boolean)
      .join(", "),
    alternates: { canonical: canonical(`/${page.slug}`) },
    openGraph: {
      title: page.metaTitle,
      description: page.metaDescription,
      url: canonical(`/${page.slug}`),
      type: "article",
    },
  };
}

export default async function KeywordLandingPage({ params }: Props) {
  const { keywordSlug } = await params;
  const match = await resolveKeywordPage(keywordSlug);
  if (!match) notFound();
  const page = renderKeywordLanding(match.template, match.city);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: match.template.label, url: `/${page.slug}` },
  ];

  return (
    <main className="min-h-screen bg-slate-50">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload
        dangerouslySetInnerHTML={{ __html: ldScript(breadcrumbJsonLd(breadcrumbs)) }}
      />
      {page.faqs.length > 0 && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload
          dangerouslySetInnerHTML={{ __html: ldScript(faqJsonLd(page.faqs)) }}
        />
      )}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload
        dangerouslySetInnerHTML={{
          __html: ldScript(
            speakableJsonLd({
              url: `/${page.slug}`,
              cssSelectors: ["h1", ".hero-intro"],
            }),
          ),
        }}
      />

      {/* Hero */}
      <section className="bg-gradient-to-b from-amber-50 to-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <nav className="text-sm text-slate-500 mb-4">
            <Link href="/" className="hover:text-amber-700">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-slate-700">{match.template.label}</span>
            <span className="mx-2">/</span>
            <span className="text-slate-700">{match.city.name}</span>
          </nav>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight">
            {page.h1}
          </h1>
          {page.emotionalHook && (
            <p className="mt-4 text-lg sm:text-xl text-amber-800 font-medium">
              {page.emotionalHook}
            </p>
          )}
          {page.heroSubcopy && (
            <p className="mt-2 text-base text-slate-600">{page.heroSubcopy}</p>
          )}
          <p className="mt-6 text-base sm:text-lg text-slate-700 max-w-3xl">
            {page.intro}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={`/request?city=${match.city.slug}&intent=${match.template.slug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-5 py-3 shadow"
            >
              {page.ctaLabel}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href={`/locksmith-city/${match.city.slug}`}
              className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-slate-800 text-sm font-medium px-5 py-3"
            >
              All locksmith services in {match.city.name}
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              {match.city.avgResponseTime} response
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-amber-600" />
              {match.city.region}
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              DBS-checked & insured
            </span>
          </div>
        </div>
      </section>

      {/* Trust bullets */}
      {page.trustBullets.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 text-center">
            Why choose LockSafe UK in {match.city.name}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {page.trustBullets.map((b, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl bg-white border border-slate-200 p-4"
              >
                <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-700">{b}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* SEO long-form body */}
      {page.seoCopy && (
        <section className="bg-white border-y border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 prose prose-slate">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              About {match.template.label.toLowerCase()} in {match.city.name}
            </h2>
            <p className="whitespace-pre-line text-slate-700 leading-relaxed">
              {page.seoCopy}
            </p>
          </div>
        </section>
      )}

      {/* Areas covered */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 text-center">
          Areas covered in {match.city.name}
        </h2>
        <div className="flex flex-wrap gap-2 justify-center max-w-3xl mx-auto">
          {match.city.areas.map((area) => (
            <span
              key={area}
              className="inline-block rounded-full bg-white border border-slate-200 text-slate-700 text-xs px-3 py-1.5"
            >
              {area}
            </span>
          ))}
        </div>
        {match.city.postcodeAreas.length > 0 && (
          <p className="text-center text-xs text-slate-500 mt-4">
            Postcode districts: {match.city.postcodeAreas.join(", ")}
          </p>
        )}
      </section>

      {/* FAQs */}
      {page.faqs.length > 0 && (
        <section className="bg-white border-y border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-6 text-center">
              FAQs — {match.template.label} in {match.city.name}
            </h2>
            <dl className="space-y-4">
              {page.faqs.map((f, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-slate-200 p-5 bg-slate-50"
                >
                  <dt className="font-semibold text-slate-900">{f.question}</dt>
                  <dd className="mt-2 text-sm text-slate-700 leading-relaxed">
                    {f.answer}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-16 text-center">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
          Ready for a locksmith in {match.city.name}?
        </h2>
        <p className="text-slate-600 mb-6">
          Get a free fixed quote in under a minute. No call-out fee, no obligation.
        </p>
        <Link
          href={`/request?city=${match.city.slug}&intent=${match.template.slug}`}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold px-6 py-3 shadow"
        >
          {page.ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>
    </main>
  );
}
