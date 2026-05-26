"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Loader2,
  Check,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
  allDay: boolean;
}

type WeeklySchedule = Record<DayKey, DaySchedule>;

const DAYS: { key: DayKey; label: string; short: string }[] = [
  { key: "mon", label: "Monday",    short: "Mon" },
  { key: "tue", label: "Tuesday",   short: "Tue" },
  { key: "wed", label: "Wednesday", short: "Wed" },
  { key: "thu", label: "Thursday",  short: "Thu" },
  { key: "fri", label: "Friday",    short: "Fri" },
  { key: "sat", label: "Saturday",  short: "Sat" },
  { key: "sun", label: "Sunday",    short: "Sun" },
];

// 30-minute slots 00:00 – 23:30
const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${m === 0 ? "00" : "30"}`);
  }
}

const formatTime12 = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${suffix}`;
};

const DEFAULT_WEEKLY: WeeklySchedule = {
  mon: { enabled: true,  start: "08:00", end: "18:00", allDay: false },
  tue: { enabled: true,  start: "08:00", end: "18:00", allDay: false },
  wed: { enabled: true,  start: "08:00", end: "18:00", allDay: false },
  thu: { enabled: true,  start: "08:00", end: "18:00", allDay: false },
  fri: { enabled: true,  start: "08:00", end: "18:00", allDay: false },
  sat: { enabled: false, start: "09:00", end: "14:00", allDay: false },
  sun: { enabled: false, start: "09:00", end: "14:00", allDay: false },
};

interface AvailabilityScheduleProps {
  locksmithId: string;
  onUpdate?: () => void;
}

export function AvailabilitySchedule({ locksmithId, onUpdate }: AvailabilityScheduleProps) {
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [success, setSuccess]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [enabled, setEnabled]     = useState(false);
  const [overridden, setOverridden] = useState(false);
  const [weekly, setWeekly]       = useState<WeeklySchedule>(DEFAULT_WEEKLY);

  const normalizeWeekly = (incoming: unknown): WeeklySchedule => {
    if (!incoming || typeof incoming !== "object") return DEFAULT_WEEKLY;
    const src = incoming as Partial<WeeklySchedule>;
    const next = { ...DEFAULT_WEEKLY };
    for (const day of DAYS) {
      const raw = src[day.key] as Partial<DaySchedule> | undefined;
      if (!raw) continue;
      next[day.key] = {
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : next[day.key].enabled,
        start: typeof raw.start === "string" ? raw.start : next[day.key].start,
        end: typeof raw.end === "string" ? raw.end : next[day.key].end,
        allDay: typeof raw.allDay === "boolean" ? raw.allDay : false,
      };
    }
    return next;
  };

  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch(`/api/locksmith/availability/schedule?locksmithId=${locksmithId}`);
        const data = await res.json();
        if (data.success) {
          setEnabled(data.schedule?.enabled ?? false);
          setOverridden(data.schedule?.overridden ?? false);
          if (data.schedule?.weekly) setWeekly(normalizeWeekly(data.schedule.weekly));
        }
      } catch { /* silently fall through to defaults */ }
      finally { setLoading(false); }
    })();
  }, [locksmithId]);

  const updateDay = (key: DayKey, field: keyof DaySchedule, value: boolean | string) => {
    setWeekly(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  };

  const applyPreset = (preset: "weekdays" | "all" | "always") => {
    setWeekly(prev => {
      const next = { ...prev } as WeeklySchedule;
      for (const day of DAYS) {
        const isWork = preset === "all" || preset === "always" || !["sat", "sun"].includes(day.key);
        next[day.key] = {
          ...next[day.key],
          enabled: isWork,
          allDay: preset === "always" ? true : next[day.key].allDay,
          ...(preset === "always" ? { start: "00:00", end: "00:00" } : {}),
        };
      }
      return next;
    });
  };

  const isOvernight = (cfg: DaySchedule) => {
    if (!cfg.enabled || cfg.allDay) return false;
    return cfg.end < cfg.start;
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res  = await fetch("/api/locksmith/availability/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locksmithId, enabled, weekly }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setOverridden(false);
        setTimeout(() => setSuccess(false), 3000);
        onUpdate?.();
      } else {
        setError(data.error ?? "Failed to save schedule");
      }
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="p-4 sm:p-6 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Availability Schedule
              </h3>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                Set working hours per day — goes on/off automatically
              </p>
            </div>
          </div>

          {/* Master enable toggle */}
          <button
            onClick={() => setEnabled(v => !v)}
            aria-label={enabled ? "Disable schedule" : "Enable schedule"}
            className="flex-shrink-0"
          >
            {enabled
              ? <ToggleRight className="w-9 h-9 text-indigo-500" />
              : <ToggleLeft  className="w-9 h-9 text-slate-300" />}
          </button>
        </div>

        {/* Override notice */}
        {enabled && overridden && (
          <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>You manually went offline during a scheduled shift. You'll be auto-enabled again at your next shift start.</span>
          </div>
        )}
      </div>

      {/* ── Per-day schedule ── */}
      <div className={`transition-all duration-300 ${enabled ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"}`}>
        <div className="p-4 sm:p-6 space-y-3">
          {/* Presets */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Working Hours</span>
            <div className="flex gap-3">
              <button onClick={() => applyPreset("weekdays")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                Mon–Fri only
              </button>
              <span className="text-slate-200">|</span>
              <button onClick={() => applyPreset("all")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                All 7 days
              </button>
              <span className="text-slate-200">|</span>
              <button onClick={() => applyPreset("always")} className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                24/7 all days
              </button>
            </div>
          </div>

          {/* Day rows */}
          {DAYS.map(day => {
            const cfg = weekly[day.key];
            return (
              <div
                key={day.key}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                  cfg.enabled ? "bg-indigo-50 border border-indigo-100" : "bg-slate-50 border border-slate-100"
                }`}
              >
                {/* Day toggle */}
                <button
                  onClick={() => updateDay(day.key, "enabled", !cfg.enabled)}
                  className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-colors ${
                    cfg.enabled ? "bg-indigo-500 border-indigo-500" : "border-slate-300 bg-white"
                  }`}
                  aria-label={`Toggle ${day.label}`}
                >
                  {cfg.enabled && <Check className="w-3 h-3 text-white" />}
                </button>

                {/* Day label */}
                <span className={`w-10 text-sm font-semibold flex-shrink-0 ${cfg.enabled ? "text-indigo-700" : "text-slate-400"}`}>
                  {day.short}
                </span>

                {/* Time pickers */}
                {cfg.enabled ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() => updateDay(day.key, "allDay", !cfg.allDay)}
                      className={`text-xs px-2 py-1 rounded-lg border font-medium ${
                        cfg.allDay
                          ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                          : "bg-white border-indigo-200 text-indigo-700"
                      }`}
                      aria-label={`Toggle 24 hours for ${day.label}`}
                    >
                      24h
                    </button>

                    {cfg.allDay ? (
                      <span className="text-xs text-emerald-700 font-medium">Open all day</span>
                    ) : (
                      <>
                        <Clock className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <select
                          value={cfg.start}
                          onChange={e => updateDay(day.key, "start", e.target.value)}
                          className="flex-1 min-w-0 text-sm px-2 py-1 rounded-lg border border-indigo-200 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 outline-none"
                          title={`${day.label} start time`}
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                        </select>
                        <span className="text-slate-400 text-xs flex-shrink-0">to</span>
                        <select
                          value={cfg.end}
                          onChange={e => updateDay(day.key, "end", e.target.value)}
                          className="flex-1 min-w-0 text-sm px-2 py-1 rounded-lg border border-indigo-200 bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 outline-none"
                          title={`${day.label} end time`}
                        >
                          {TIME_OPTIONS.map(t => <option key={t} value={t}>{formatTime12(t)}</option>)}
                        </select>
                        {isOvernight(cfg) && <span className="text-[10px] text-indigo-600">overnight</span>}
                      </>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Off</span>
                )}
              </div>
            );
          })}

          {/* Info box */}
          <div className="mt-2 bg-indigo-50 rounded-xl p-3 flex items-start gap-2 text-xs text-indigo-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              The schedule checks every 15 minutes. If you manually go offline during a shift, you'll stay
              offline until your next scheduled start time. If end time is earlier than start time, it is treated
              as overnight. Times are UK time (GMT/BST).
            </span>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          {success && (
            <p className="flex items-center gap-1.5 text-emerald-600 text-sm">
              <Check className="w-4 h-4" /> Schedule saved!
            </p>
          )}
          {error && (
            <p className="flex items-center gap-1.5 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span className="truncate">{error}</span>
            </p>
          )}
          {!success && !error && !enabled && (
            <p className="text-slate-400 text-sm">Toggle on to activate automatic hours</p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 flex-shrink-0"
        >
          {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : "Save Schedule"}
        </Button>
      </div>
    </div>
  );
}
