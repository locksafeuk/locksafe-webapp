import type { ServiceEntry } from "@/lib/services-catalog";

interface Props {
  service: ServiceEntry;
}

/**
 * AI-summary / TL;DR block. Anchored at #tldr to act as a Speakable target
 * for voice assistants and a clean snippet for generative engines (GEO).
 */
export function AiSummaryBlock({ service }: Props) {
  return (
    <section
      id="tldr"
      aria-labelledby="tldr-heading"
      className="py-12 bg-orange-50 border-y border-orange-100"
    >
      <div className="section-container">
        <div className="max-w-3xl">
          <h2
            id="tldr-heading"
            className="text-sm font-semibold uppercase tracking-wide text-orange-700 mb-3"
          >
            In short
          </h2>
          <p className="text-lg md:text-xl text-slate-800 leading-relaxed">
            {service.aiSummary}
          </p>
        </div>
      </div>
    </section>
  );
}
