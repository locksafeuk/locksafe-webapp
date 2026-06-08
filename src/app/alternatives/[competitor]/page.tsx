import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import {
  type CompetitorAlternative,
  getAllCompetitorSlugs,
  getCompetitorBySlug,
} from "@/lib/competitor-alternatives";
import { SITE_NAME, SUPPORT_PHONE, SUPPORT_PHONE_TEL } from "@/lib/config";
import { canonical } from "@/lib/seo/url-helpers";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ competitor: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllCompetitorSlugs().map((competitor) => ({ competitor }));
}

/** H1 / page title — branded entries read "{Name} Alternative"; the generic
 *  cowboy page uses its own phrasing from the meta title. */
function pageHeading(c: CompetitorAlternative): string {
  if (c.category === "generic") return c.metaTitle.split(" — ")[0];
  return `${c.name} Alternative`;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { competitor } = await params;
  const c = getCompetitorBySlug(competitor);

  if (!c) {
    return { title: `Not Found | ${SITE_NAME}` };
  }

  const url = canonical(`/alternatives/${c.slug}`);

  return {
    title: c.metaTitle,
    description: c.metaDescription,
    keywords: c.keywords,
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
      title: c.metaTitle,
      description: c.metaDescription,
    },
    twitter: {
      card: "summary_large_image",
      title: c.metaTitle,
      description: c.metaDescription,
    },
  };
}

export default async function CompetitorAlternativePage({ params }: PageProps) {
  const { competitor } = await params;
  const c = getCompetitorBySlug(competitor);

  if (!c) {
    notFound();
  }

  const url = canonical(`/alternatives/${c.slug}`);
  const h1 = pageHeading(c);
  const comparisonHeading = `${c.name} vs ${SITE_NAME}: Comparison`;

  // ── JSON-LD: Breadcrumb + FAQ (AI/search love these on versus pages) ──
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: canonical("/"),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Alternatives",
        item: canonical("/alternatives"),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: h1,
        item: url,
      },
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
        {/* ── Hero: concise value + CTA BEFORE any scrolling ─────────────── */}
        <section className="bg-slate-900 text-white">
          <div className="section-container py-14 md:py-20">
            <nav
              aria-label="Breadcrumb"
              className="mb-4 text-sm text-slate-400"
            >
              <Link href="/" className="hover:text-white">
                Home
              </Link>
              <span className="mx-2">/</span>
              <Link href="/alternatives" className="hover:text-white">
                Alternatives
              </Link>
            </nav>

            <p className="mb-3 inline-block rounded-full bg-orange-500/15 px-3 py-1 text-sm font-semibold text-orange-400">
              The trusted{" "}
              {c.category === "generic" ? "anti-scam" : "alternative"} choice
            </p>

            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              {h1}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">
              {c.heroIntro}
            </p>

            {/* Above-the-fold CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

            <p className="mt-4 text-sm text-slate-400">
              100% free for customers · Verified locksmiths · See the quote
              before any work starts
            </p>
          </div>
        </section>

        {/* ── Concise "why we're the alternative" ────────────────────────── */}
        <section className="bg-white py-14">
          <div className="section-container max-w-3xl">
            <h2 className="mb-4 text-3xl font-bold text-slate-900">
              Why {SITE_NAME} is a great alternative
            </h2>
            <p className="mb-5 text-lg leading-relaxed text-slate-600">
              {c.whatTheyAre}
            </p>
            {c.body.map((para) => (
              <p
                key={para.slice(0, 40)}
                className="mb-4 text-lg leading-relaxed text-slate-700"
              >
                {para}
              </p>
            ))}
          </div>
        </section>

        {/* ── Comparison table (AI/search lift this) ─────────────────────── */}
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
            <p className="mt-4 text-sm text-slate-500">
              Comparison reflects the {SITE_NAME} platform model. Details about
              other providers are general and may vary — always confirm current
              terms directly.
            </p>
          </div>
        </section>

        {/* ── Why LockSafe bullets ───────────────────────────────────────── */}
        <section className="bg-white py-14">
          <div className="section-container max-w-3xl">
            <h2 className="mb-6 text-3xl font-bold text-slate-900">
              What you get with {SITE_NAME}
            </h2>
            <ul className="space-y-4">
              {c.whyLockSafe.map((point) => (
                <li key={point.slice(0, 40)} className="flex gap-3">
                  <span
                    aria-hidden
                    className="mt-1 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-600"
                  >
                    ✓
                  </span>
                  <span className="text-lg text-slate-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className="bg-slate-50 py-14">
          <div className="section-container max-w-3xl">
            <h2 className="mb-6 text-3xl font-bold text-slate-900">
              {c.name} alternative — FAQs
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
              Ready for a better alternative?
            </h2>
            <p className="mb-8 text-lg text-slate-300">
              Post your job in 90 seconds. Compare verified locksmiths, see the
              price first, and get a documented job — 24/7.
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
