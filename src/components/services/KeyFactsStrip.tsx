import type { ServiceEntry } from "@/lib/services-catalog";

interface Props {
  service: ServiceEntry;
}

/**
 * Scannable key-facts strip — drives both human scanning and GEO snippets.
 * Sits directly under the hero, above the long-form body.
 */
export function KeyFactsStrip({ service }: Props) {
  return (
    <section
      aria-label="Key facts"
      className="bg-white border-b border-slate-200 py-6"
    >
      <div className="section-container">
        <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-center">
          {service.keyFacts.map((fact) => (
            <div key={fact.label} className="px-2">
              <dt className="text-xs uppercase tracking-wide text-slate-500 font-medium mb-1">
                {fact.label}
              </dt>
              <dd className="text-sm font-semibold text-slate-900">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
