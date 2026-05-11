import type { IntentRelatedCluster, IntentLanding } from "@/lib/intent-landing";

interface Props {
  clusters: IntentRelatedCluster[];
  /** Pre-resolved landings keyed by slug — passed by the server page. */
  resolved: Record<string, Pick<IntentLanding, "slug" | "title" | "intro">>;
}

/**
 * Grouped related-intent navigation. Mirrors mademoiselle's
 * IntentRelatedClusters — drives topical-authority graph by surfacing
 * sibling landings under the same pillar.
 */
export function RelatedClusters({ clusters, resolved }: Props) {
  if (clusters.length === 0) return null;
  return (
    <div>
      <div className="text-center mb-8 sm:mb-10">
        <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
          Continue exploring
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">Related scenarios</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        {clusters.map((cluster, ci) => (
          <div key={ci} className="rounded-2xl bg-white border border-slate-200 p-5 sm:p-6">
            <h3 className="font-semibold text-slate-900 mb-3">{cluster.heading}</h3>
            <ul className="space-y-2">
              {cluster.slugs
                .map((slug) => resolved[slug])
                .filter((l): l is NonNullable<typeof l> => Boolean(l))
                .map((l) => (
                  <li key={l.slug}>
                    <a
                      href={`/intent/${l.slug}`}
                      className="block rounded-lg px-3 py-2 hover:bg-amber-50 text-slate-700 hover:text-amber-800 transition-colors"
                    >
                      <span className="font-medium">{l.title}</span>
                      {l.intro && (
                        <span className="block text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {l.intro}
                        </span>
                      )}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
