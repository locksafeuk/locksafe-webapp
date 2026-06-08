import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import {
  CATEGORY_LABELS,
  COMPETITOR_ALTERNATIVES,
  type CompetitorCategory,
} from "@/lib/competitor-alternatives";
import { SITE_NAME } from "@/lib/config";
import { canonical } from "@/lib/seo/url-helpers";
import type { Metadata } from "next";
import Link from "next/link";

const TITLE = `Locksmith Alternatives — Compare Your Options | ${SITE_NAME}`;
const DESCRIPTION =
  "Compare LockSafe with national locksmith chains, directories and untrustworthy traders. Verified, DBS-checked locksmiths, upfront quotes and a documented job — free for customers.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: canonical("/alternatives") },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    url: canonical("/alternatives"),
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
  },
};

const CATEGORY_ORDER: CompetitorCategory[] = ["chain", "directory", "generic"];

export default function AlternativesHubPage() {
  return (
    <>
      <Header />
      <main className="pb-24 md:pb-0">
        <section className="bg-slate-900 text-white">
          <div className="section-container py-14 md:py-20">
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">
              Looking for a locksmith alternative?
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-slate-300">
              See how {SITE_NAME} compares — verified locksmiths, the full price
              before any work starts, and a legally-binding record of every job.
            </p>
            <div className="mt-8">
              <Link
                href="/request"
                className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-orange-600"
              >
                Get Emergency Help →
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="section-container max-w-4xl">
            {CATEGORY_ORDER.map((cat) => {
              const items = COMPETITOR_ALTERNATIVES.filter(
                (c) => c.category === cat,
              );
              if (items.length === 0) return null;
              return (
                <div key={cat} className="mb-12 last:mb-0">
                  <h2 className="mb-5 text-2xl font-bold text-slate-900">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {items.map((c) => (
                      <Link
                        key={c.slug}
                        href={`/alternatives/${c.slug}`}
                        className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-orange-300 hover:shadow-md"
                      >
                        <h3 className="text-lg font-semibold text-slate-900 group-hover:text-orange-600">
                          {c.category === "generic"
                            ? c.metaTitle.split(" — ")[0]
                            : `${c.name} Alternative`}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600">
                          {c.heroIntro}
                        </p>
                        <span className="mt-3 inline-block text-sm font-semibold text-orange-600">
                          See the comparison →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
