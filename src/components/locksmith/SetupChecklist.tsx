"use client";

/**
 * Persistent "Complete your setup" card on the locksmith dashboard.
 *
 * Lists EVERY required (blocking) item from the completeness engine — terms,
 * base location, call-out fee, Stripe payouts, profile photo, insurance — with
 * live done/not-done state. These are exactly the items that gate going
 * "Available", so showing them all stops the "why won't my toggle turn on?"
 * surprise. Optional extras (DBS, app install) are shown as a lighter group.
 *
 * The card hides once every BLOCKING item is satisfied (dispatch-ready).
 */

import Link from "next/link";
import {
  CheckCircle2, Circle, PlayCircle,
  MapPin, PoundSterling, CreditCard, Camera, ShieldCheck, FileText, BadgeCheck, Smartphone,
  type LucideIcon,
} from "lucide-react";

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  blocking: boolean;
}

interface SetupChecklistProps {
  items: ChecklistItem[];
}

// Per-item display metadata (icon, customer-friendly detail, in-app link).
const DISPLAY: Record<string, { icon: LucideIcon; detail: string; href: string }> = {
  terms: {
    icon: FileText,
    detail: "Accept the partner terms to start receiving jobs.",
    href: "/locksmith/settings",
  },
  base_location: {
    icon: MapPin,
    detail: "Matches you to nearby jobs — and we advertise locally for your area.",
    href: "/locksmith/settings",
  },
  callout_fee: {
    icon: PoundSterling,
    detail: "You choose the price customers see for a call-out.",
    href: "/locksmith/settings",
  },
  stripe: {
    icon: CreditCard,
    detail: "Connect Stripe so you get paid within 24h of completing a job.",
    href: "/locksmith/earnings",
  },
  photo: {
    icon: Camera,
    detail: "A real, verified photo builds customer trust on your profile.",
    href: "/locksmith/settings",
  },
  insurance: {
    icon: ShieldCheck,
    detail: "Upload valid insurance to be matched with jobs.",
    href: "/locksmith/settings",
  },
  dbs: {
    icon: BadgeCheck,
    detail: "Optional — a DBS check boosts your trust score.",
    href: "/locksmith/settings",
  },
  app_install: {
    icon: Smartphone,
    detail: "Install the app so you never miss a job alert.",
    href: "/install",
  },
};

function fallback(item: ChecklistItem) {
  return DISPLAY[item.key] || { icon: Circle as LucideIcon, detail: "", href: "/locksmith/settings" };
}

function Row({ item }: { item: ChecklistItem }) {
  const d = fallback(item);
  const Icon = d.icon;
  return (
    <Link
      href={d.href}
      className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
        item.done
          ? "border-emerald-100 bg-emerald-50/50"
          : "border-orange-200 bg-orange-50/60 hover:bg-orange-100/60"
      }`}
    >
      {item.done ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
      ) : (
        <Circle className="w-5 h-5 text-orange-400 mt-0.5 shrink-0" />
      )}
      <div className="min-w-0">
        <div className={`text-sm font-medium ${item.done ? "text-emerald-800 line-through" : "text-slate-900"}`}>
          <Icon className="w-4 h-4 inline mr-1 -mt-0.5" />
          {item.label}
        </div>
        {d.detail && <div className="text-xs text-slate-500 mt-0.5">{d.detail}</div>}
      </div>
    </Link>
  );
}

export function SetupChecklist({ items }: SetupChecklistProps) {
  const required = items.filter((i) => i.blocking);
  const optional = items.filter((i) => !i.blocking);

  // Dispatch-ready: every required item done → hide the card entirely.
  const remaining = required.filter((i) => !i.done).length;
  if (remaining === 0) return null;

  // Show incomplete optional items only while setup is still in progress.
  const optionalToShow = optional.filter((i) => !i.done);

  return (
    <div className="bg-white border-2 border-orange-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold text-slate-900">
          Complete your setup{" "}
          <span className="text-sm font-normal text-orange-600">
            ({remaining} step{remaining > 1 ? "s" : ""} left to go Available)
          </span>
        </h3>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("locksafe:replay-tour"))}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-orange-600 shrink-0"
        >
          <PlayCircle className="w-4 h-4" /> Replay tour
        </button>
      </div>

      <div className="space-y-2">
        {required.map((item) => (
          <Row key={item.key} item={item} />
        ))}
      </div>

      {optionalToShow.length > 0 && (
        <>
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wide mt-4 mb-2">
            Optional — recommended
          </div>
          <div className="space-y-2">
            {optionalToShow.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
