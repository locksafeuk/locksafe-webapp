import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import {
  loadIntentLandingBySlug,
  loadAllIntentLandingSlugs,
  loadIntentLandingsBySlugs,
} from "@/lib/intent-landings-store";
import {
  breadcrumbJsonLd,
  faqJsonLd,
  itemListJsonLd,
  serviceJsonLd,
  speakableJsonLd,
  ldScript,
} from "@/lib/seo";
import { intentUrl, canonical } from "@/lib/seo/url-helpers";
import { resolveIntentVariant, pickHook } from "@/lib/seo/intent-ab";
import { getServiceBySlug } from "@/lib/services-catalog";
import { IntentHero } from "@/components/intent/IntentHero";
import { SegmentsNav } from "@/components/intent/SegmentsNav";
import { SegmentBlock } from "@/components/intent/SegmentBlock";
import { TrustConfidence } from "@/components/intent/TrustConfidence";
import { SocialProofRail } from "@/components/intent/SocialProofRail";
import { RelatedClusters } from "@/components/intent/RelatedClusters";
import { IntentFaq } from "@/components/intent/IntentFaq";
import { IntentTracker } from "@/components/intent/IntentTracker";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const slugs = await loadAllIntentLandingSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const landing = await loadIntentLandingBySlug(slug);
  if (!landing) return {};
  const title = landing.metaTitle || `${landing.title} | LockSafe UK`;
  const description =
    landing.metaDescription || landing.intro || `${landing.title} — LockSafe UK.`;
  const keywords = [landing.pillarKeyword, ...landing.intentTags].filter(Boolean) as string[];
  return {
    title,
    description,
    keywords: keywords.length > 0 ? keywords.join(", ") : undefined,
    alternates: { canonical: intentUrl(slug) },
    openGraph: {
      title,
      description,
      url: canonical(intentUrl(slug)),
      images: landing.heroImageUrl ? [{ url: landing.heroImageUrl }] : undefined,
      type: "article",
    },
  };
}

export default async function IntentPage({ params }: Props) {
  const { slug } = await params;
  const landing = await loadIntentLandingBySlug(slug);
  if (!landing) notFound();

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

  // Resolve full service list (catalog services that match the filter)
  const allServices = (landing.serviceFilter.serviceSlugs ?? [])
    .map((s) => getServiceBySlug(s))
    .filter((s): s is NonNullable<ReturnType<typeof getServiceBySlug>> => Boolean(s));

  // Pre-resolve every slug referenced by relatedClusters so the child
  // component stays pure / no DB calls inside React.
  const relatedSlugs = Array.from(
    new Set(landing.blocks.relatedClusters.flatMap((c) => c.slugs)),
  );
  const relatedLandings = await loadIntentLandingsBySlugs(relatedSlugs);
  const resolvedRelated: Record<string, { slug: string; title: string; intro?: string }> = {};
  for (const l of relatedLandings) {
    resolvedRelated[l.slug] = { slug: l.slug, title: l.title, intro: l.intro };
  }

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Intents", url: "/intent" },
    { name: landing.title, url: intentUrl(slug) },
  ];

  const serviceListItems = allServices.map((s) => ({
    url: `/services/${s.id}`,
    name: s.title,
  }));

  return (
    <main>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldScript(breadcrumbJsonLd(breadcrumbs)) }}
      />
      {landing.faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldScript(faqJsonLd(landing.faqs)) }}
        />
      )}
      {landing.blocks.aiSearchQA.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: ldScript({
              ...faqJsonLd(landing.blocks.aiSearchQA),
              "@id": `${canonical(intentUrl(slug))}#ai-search`,
            }),
          }}
        />
      )}
      {serviceListItems.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ldScript(itemListJsonLd(serviceListItems)) }}
        />
      )}
      {/* Service schema — anchors the intent to a real offering */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            serviceJsonLd({
              name: landing.h1,
              description: landing.metaDescription || landing.intro || landing.h1,
              url: intentUrl(slug),
              serviceType: landing.pillarKeyword || "Locksmith Service",
              priceRange: { low: 60, high: 250 },
            }),
          ),
        }}
      />
      {/* Speakable for voice search */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            speakableJsonLd({
              url: intentUrl(slug),
              cssSelectors: ["h1", "#tldr", "#faq h2", "#faq summary"],
            }),
          ),
        }}
      />

      <IntentTracker
        slug={slug}
        pillarKeyword={landing.pillarKeyword ?? null}
        intentTags={landing.intentTags}
        variant={variant}
        isAbTestRunning={hasVariantB}
      />

      <IntentHero
        landing={{
          h1: landing.h1,
          pillarKeyword: landing.pillarKeyword ?? undefined,
          intentTags: landing.intentTags,
          emotionalHook: picked.emotionalHook,
          heroSubcopy: picked.heroSubcopy,
        }}
      />

      {/* Intro / TL;DR — feeds speakable */}
      {landing.intro && (
        <section id="tldr" className="bg-slate-50 border-b border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <p className="text-base sm:text-lg text-slate-700 leading-relaxed">{landing.intro}</p>
          </div>
        </section>
      )}

      {/* Sticky segments nav */}
      {landing.blocks.segments.length > 0 && (
        <SegmentsNav
          segments={landing.blocks.segments.map((s) => ({
            id: s.id,
            label: s.label,
            count: (s.serviceFilter.serviceSlugs ?? []).length,
          }))}
          catalogAnchor="all-services"
          totalCount={allServices.length}
        />
      )}

      {/* Segments */}
      {landing.blocks.segments.length > 0 && (
        <div className="bg-white">
          {landing.blocks.segments.map((seg, i) => (
            <SegmentBlock key={seg.id} segment={seg} index={i} />
          ))}
        </div>
      )}

      {/* Trust modules */}
      {landing.blocks.trustConfidence.length > 0 && (
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <TrustConfidence items={landing.blocks.trustConfidence} />
          </div>
        </section>
      )}

      {/* All services for this intent */}
      {allServices.length > 0 && (
        <section id="all-services" className="scroll-mt-32 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <header className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
                Full service list
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Everything we can help with
              </h2>
            </div>
            <Link
              href="/request"
              className="self-start sm:self-end inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
            >
              Post a job
              <span aria-hidden>→</span>
            </Link>
          </header>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {allServices.map((s) => (
              <Link
                key={s.id}
                href={`/services/${s.id}`}
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
      )}

      {/* AI-search Q&A */}
      {landing.blocks.aiSearchQA.length > 0 && (
        <IntentFaq
          items={landing.blocks.aiSearchQA}
          id="ai-search"
          title="What people actually search for"
          eyebrow="AI search answers"
        />
      )}

      {/* SEO copy */}
      {landing.seoCopy && (
        <section className="bg-slate-50 border-y border-slate-200">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <div className="text-center mb-8 sm:mb-10">
              <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
                The full guide
              </p>
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                About {landing.title.toLowerCase()}
              </h2>
              <div className="mt-4 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
            </div>
            <div
              className={[
                "text-slate-700 text-[15px] leading-relaxed",
                "[&_h2]:text-2xl sm:[&_h2]:text-3xl [&_h2]:text-slate-900 [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:first:mt-0",
                "[&_h3]:text-xl [&_h3]:text-slate-900 [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3",
                "[&_p]:mb-4 [&_p]:leading-7",
                "[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:space-y-2",
                "[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:space-y-2",
                "[&_li]:leading-7",
                "[&_strong]:text-slate-900 [&_strong]:font-semibold",
                "[&_a]:text-amber-700 [&_a]:underline hover:[&_a]:text-amber-800",
              ].join(" ")}
              dangerouslySetInnerHTML={{ __html: landing.seoCopy }}
            />
          </div>
        </section>
      )}

      {/* Social proof rails */}
      {landing.blocks.socialProofClusters.length > 0 && (
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            {landing.blocks.socialProofClusters.map((c, i) => (
              <SocialProofRail key={`${c.label}-${i}`} cluster={c} />
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <IntentFaq items={landing.faqs} />

      {/* Related clusters */}
      {landing.blocks.relatedClusters.length > 0 && (
        <section className="bg-slate-50 border-t border-slate-200">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
            <RelatedClusters clusters={landing.blocks.relatedClusters} resolved={resolvedRelated} />
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Verified locksmith, transparent price</h2>
          <p className="text-slate-300 mb-7 max-w-xl mx-auto">
            Post the job, pick the locksmith, watch them arrive on GPS. Paper trail every time.
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
