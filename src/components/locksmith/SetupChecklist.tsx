"use client";

/**
 * Persistent "Complete your setup" card on the locksmith dashboard.
 *
 * Shows the two DATA-CRITICAL items (per product decision the accent is on
 * call-out fee + base location) with live done/not-done state derived from the
 * database — it disappears only when both are genuinely set, which is what
 * makes job matching + local-ads calibration accurate. Also offers a tour replay.
 */

import Link from "next/link";
import { CheckCircle2, Circle, MapPin, PoundSterling, PlayCircle } from "lucide-react";

interface SetupChecklistProps {
  feeSet: boolean;
  locationSet: boolean;
}

export function SetupChecklist({ feeSet, locationSet }: SetupChecklistProps) {
  if (feeSet && locationSet) return null;

  const items = [
    {
      done: feeSet,
      icon: PoundSterling,
      title: "Set your call-out fee",
      detail: "You choose the price customers see for a call-out.",
      href: "/locksmith/settings",
    },
    {
      done: locationSet,
      icon: MapPin,
      title: "Set your base location",
      detail: "Matches you to nearby jobs — and we advertise locally for your area.",
      href: "/locksmith/settings",
    },
  ];

  const remaining = items.filter((i) => !i.done).length;

  return (
    <div className="bg-white border-2 border-orange-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold text-slate-900">
          Complete your setup{" "}
          <span className="text-sm font-normal text-orange-600">
            ({remaining} step{remaining > 1 ? "s" : ""} left)
          </span>
        </h3>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("locksafe:replay-tour"))}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-orange-600"
        >
          <PlayCircle className="w-4 h-4" /> Replay tour
        </button>
      </div>

      <div className="space-y-2">
        {items.map((item) => (
          <Link
            key={item.title}
            href={item.href}
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
                <item.icon className="w-4 h-4 inline mr-1 -mt-0.5" />
                {item.title}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">{item.detail}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
