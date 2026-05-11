import type { Metadata } from "next";
import Link from "next/link";
import { getActiveIntentLandings } from "@/lib/intent-landings";
import { PILLAR_KEYWORDS } from "@/lib/intents-catalog";
import { breadcrumbJsonLd, itemListJsonLd, ldScript } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Locksmith Help by Scenario | LockSafe UK",
  description:
    "Find the right verified locksmith for your scenario — locked out, burgled, key snapped, moving in. Transparent pricing, DBS-verified, GPS-tracked.",
  alternates: { canonical: "/intent" },
};

export default function IntentIndexPage() {
  const landings = getActiveIntentLandings();

  // Group by pillar keyword
  const byPillar = new Map<string, typeof landings>();
  for (const l of landings) {
    const key = l.pillarKeyword || "other";
    if (!byPillar.has(key)) byPillar.set(key, []);
    byPillar.get(key)!.push(l);
  }

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            breadcrumbJsonLd([
              { name: "Home", url: "/" },
              { name: "Scenarios", url: "/intent" },
            ]),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ldScript(
            itemListJsonLd(
              landings.map((l) => ({ url: `/intent/${l.slug}`, name: l.title })),
            ),
          ),
        }}
      />

      <section className="bg-gradient-to-b from-slate-900 to-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <p className="text-[10px] tracking-[0.3em] uppercase text-amber-400 mb-3 font-medium">
            Locksmith help by scenario
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4 max-w-3xl">
            Find the right verified locksmith for what's actually happening
          </h1>
          <p className="text-slate-200 max-w-2xl">
            Every page below is a real scenario UK customers post on LockSafe — with what to do
            right now, what it should cost, and how to avoid the scams.
          </p>
        </div>
      </section>

      {[...PILLAR_KEYWORDS, "other"].map((pillar) => {
        const group = byPillar.get(pillar);
        if (!group || group.length === 0) return null;
        const pillarLabel = pillar
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <section key={pillar} className="border-b border-slate-200">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-6">
                {pillarLabel}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.map((l) => (
                  <Link
                    key={l.slug}
                    href={`/intent/${l.slug}`}
                    className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-5"
                  >
                    <h3 className="font-semibold text-slate-900 mb-2">{l.title}</h3>
                    {l.intro && (
                      <p className="text-sm text-slate-600 line-clamp-3">{l.intro}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </main>
  );
}
