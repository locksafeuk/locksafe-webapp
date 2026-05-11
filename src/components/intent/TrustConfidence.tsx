import type { IntentTrustItem } from "@/lib/intent-landing";
import { Shield, CircleDollarSign, FileText, Clock, BadgeCheck, FileBadge } from "lucide-react";

const ICONS: Record<IntentTrustItem["topic"], typeof Shield> = {
  verification: BadgeCheck,
  pricing: CircleDollarSign,
  "paper-trail": FileText,
  "response-time": Clock,
  guarantee: Shield,
  insurance: FileBadge,
};

interface Props {
  items: IntentTrustItem[];
}

/**
 * Locksmith analogue of mademoiselle's IntentStyleConfidence: reassurance
 * modules surfacing the unique trust signals (DBS, transparent pricing,
 * paper trail, response time, guarantee, insurance).
 */
export function TrustConfidence({ items }: Props) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="text-center mb-8 sm:mb-10">
        <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
          Why LockSafe doesn't get scammed
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
          The bits no other &quot;locksmith near me&quot; service has
        </h2>
        <div className="mt-4 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {items.map((item) => {
          const Icon = ICONS[item.topic] || Shield;
          return (
            <div
              key={`${item.topic}-${item.title}`}
              className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700 mb-3">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed">{item.body}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
