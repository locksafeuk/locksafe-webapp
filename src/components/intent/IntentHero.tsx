import type { IntentLanding } from "@/lib/intent-landing";

interface Props {
  landing: Pick<IntentLanding, "h1" | "pillarKeyword" | "intentTags"> & {
    eyebrow?: string;
    emotionalHook: string | null;
    heroSubcopy: string | null;
  };
  ctaHref?: string;
  ctaLabel?: string;
}

/**
 * Hero block for intent landing pages. Resolves the visible hook from the
 * already-A/B-picked copy passed in (caller does the variant resolution).
 */
export function IntentHero({ landing, ctaHref = "/request", ctaLabel = "Get a verified locksmith" }: Props) {
  const eyebrow = landing.eyebrow || landing.pillarKeyword || "LockSafe UK";
  const headline = landing.emotionalHook || landing.h1;
  const subcopy = landing.heroSubcopy;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="pointer-events-none absolute -top-20 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
        <p className="inline-flex items-center gap-2 text-[10px] sm:text-xs tracking-[0.3em] uppercase text-amber-400 mb-4 font-medium">
          <span className="w-6 h-px bg-amber-400" />
          {eyebrow.replace(/-/g, " ")}
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-[1.1] mb-5 max-w-3xl">
          {headline}
        </h1>
        {subcopy && (
          <p className="text-base sm:text-lg text-slate-200 leading-relaxed max-w-2xl mb-7">
            {subcopy}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={ctaHref}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm sm:text-base font-semibold transition-colors"
          >
            {ctaLabel}
            <span aria-hidden>→</span>
          </a>
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs sm:text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            DBS-verified · GPS-tracked · Price up-front
          </span>
        </div>
      </div>
    </section>
  );
}
