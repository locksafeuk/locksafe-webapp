import type { IntentSegment } from "@/lib/intent-landing";
import { getServiceBySlug } from "@/lib/services-catalog";

interface Props {
  segment: IntentSegment;
  index: number;
}

/**
 * Single emotional sub-block on an intent page. Each segment carries a
 * micro-narrative ("If you're locked out at night with a child in the
 * car…") + the catalog services that fit that situation.
 */
export function SegmentBlock({ segment, index }: Props) {
  const services = (segment.serviceFilter.serviceSlugs ?? [])
    .map((slug) => getServiceBySlug(slug))
    .filter((s): s is NonNullable<ReturnType<typeof getServiceBySlug>> => Boolean(s));

  return (
    <section
      id={`segment-${segment.id}`}
      className="scroll-mt-32 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 border-t border-slate-200 first:border-t-0"
    >
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
        <div className="lg:w-1/3">
          <p className="text-[10px] tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
            Scenario {String(index + 1).padStart(2, "0")}
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">{segment.label}</h2>
          <p className="text-slate-600 leading-relaxed">{segment.emotionalAngle}</p>
          <a
            href="/request"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors"
          >
            {segment.ctaLabel || "Post a job"}
            <span aria-hidden>→</span>
          </a>
        </div>
        <div className="lg:w-2/3 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {services.map((s) => (
            <a
              key={s.id}
              href={`/services/${s.id}`}
              className="group block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-4"
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <h3 className="font-semibold text-slate-900 group-hover:text-amber-700">{s.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                  {s.priceHint}
                </span>
              </div>
              <p className="text-sm text-slate-600 line-clamp-2">{s.shortDescription}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
