import type { IntentSocialProofCluster } from "@/lib/intent-landing";
import { getServiceBySlug } from "@/lib/services-catalog";
import { Star } from "lucide-react";

interface Props {
  cluster: IntentSocialProofCluster;
}

const BADGE: Record<IntentSocialProofCluster["label"], string> = {
  "most-booked": "Most booked",
  "customer-favourite": "Customer favourite",
  "real-jobs": "Real jobs this week",
  "verified-pro": "Verified pro picks",
  "editor-pick": "Editor's pick",
};

/**
 * Social-proof rail for an intent page. Static implementation maps the
 * cluster's serviceFilter to catalog services; the `dynamicSource` field
 * is preserved on the type so a future DB-backed version can swap in
 * real booking-volume data without API changes.
 */
export function SocialProofRail({ cluster }: Props) {
  const services = (cluster.serviceFilter.serviceSlugs ?? [])
    .map((slug) => getServiceBySlug(slug))
    .filter((s): s is NonNullable<ReturnType<typeof getServiceBySlug>> => Boolean(s));
  if (services.length === 0) return null;

  return (
    <div className="mb-10 last:mb-0">
      <div className="flex items-end justify-between gap-4 mb-4">
        <div>
          <p className="inline-flex items-center gap-2 text-[10px] tracking-[0.3em] uppercase text-amber-600 mb-1 font-medium">
            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
            {BADGE[cluster.label] || cluster.label}
          </p>
          <h3 className="text-xl sm:text-2xl font-bold text-slate-900">{cluster.heading}</h3>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map((s) => (
          <a
            key={s.id}
            href={`/services/${s.id}`}
            className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-4"
          >
            <h4 className="font-semibold text-slate-900 mb-1">{s.title}</h4>
            <p className="text-sm text-slate-600 line-clamp-2 mb-2">{s.shortDescription}</p>
            <span className="text-xs text-amber-700 font-medium">{s.priceHint}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
