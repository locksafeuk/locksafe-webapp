"use client";

import { useEffect, useState } from "react";

interface Segment {
  id: string;
  label: string;
  count?: number;
}

interface Props {
  segments: Segment[];
  catalogAnchor?: string;
  totalCount?: number;
}

/**
 * Sticky tab nav that scrolls between segment blocks on an intent page.
 * Mirrors mademoiselle's IntentSegmentsNav.
 */
export function SegmentsNav({ segments, catalogAnchor = "all-services", totalCount }: Props) {
  const [active, setActive] = useState<string | null>(segments[0]?.id ?? null);

  useEffect(() => {
    const ids = segments.map((s) => s.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(`segment-${id}`);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [segments]);

  if (segments.length === 0) return null;

  return (
    <nav
      aria-label="Page sections"
      className="sticky top-16 z-30 -mx-4 sm:mx-0 mb-4 bg-white/95 backdrop-blur border-y border-slate-200"
    >
      <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto px-4 sm:px-0 py-2.5">
        {segments.map((s) => {
          const isActive = active === s.id;
          return (
            <a
              key={s.id}
              href={`#segment-${s.id}`}
              aria-current={isActive ? "true" : undefined}
              className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {s.label}
              {typeof s.count === "number" && s.count > 0 && (
                <span className={`ml-1.5 text-[10px] ${isActive ? "text-white/70" : "text-slate-500"}`}>
                  {s.count}
                </span>
              )}
            </a>
          );
        })}
        <a
          href={`#${catalogAnchor}`}
          className="ml-auto whitespace-nowrap px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium bg-amber-100 text-amber-900 hover:bg-amber-200"
        >
          All services{typeof totalCount === "number" && totalCount > 0 ? ` · ${totalCount}` : ""}
        </a>
      </div>
    </nav>
  );
}
