"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  Calendar,
  Loader2,
  Check,
  AlertCircle,
  Sun,
  Moon,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface AvailabilityScheduleProps {
  locksmithId: string;
  onUpdate?: () => void;
}

const DAYS_OF_WEEK = [
  { id: "monday", label: "Mon", fullLabel: "Monday" },
  { id: "tuesday", label: "Tue", fullLabel: "Tuesday" },
  { id: "wednesday", label: "Wed", fullLabel: "Wednesday" },
  { id: "thursday", label: "Thu", fullLabel: "Thursday" },
  { id: "friday", label: "Fri", fullLabel: "Friday" },
  { id: "saturday", label: "Sat", fullLabel: "Saturday" },
  { id: "sunday", label: "Sun", fullLabel: "Sunday" },
];

const TIME_OPTIONS = [
  "00:00", "01:00", "02:00", "03:00", "04:00", "05:00",
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00", "23:00",
];

export function AvailabilitySchedule({
  locksmithId,
  onUpdate,
}: AvailabilityScheduleProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schedule state
  const [enabled, setEnabled] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("20:00");
  const [selectedDays, setSelectedDays] = useState<string[]>([
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]);

  // Fetch current schedule
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const response = await fetch(
          `/api/locksmith/availability/schedule?locksmithId=${locksmithId}`
        );
        const data = await response.json();

        if (data.success && data.schedule) {
          setEnabled(data.schedule.enabled || false);
          setStartTime(data.schedule.startTime || "08:00");
          setEndTime(data.schedule.endTime || "20:00");
          setSelectedDays(
            data.schedule.days?.length > 0
              ? data.schedule.days
              : ["monday", "tuesday", "wednesday", "thursday", "friday"]
          );
        }
      } catch (err) {
        console.error("Error fetching schedule:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedule();
  }, [locksmithId]);

  const toggleDay = (dayId: string) => {
    setSelectedDays((prev) =>
      prev.includes(dayId)
        ? prev.filter((d) => d !== dayId)
        : [...prev, dayId]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/locksmith/availability/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locksmithId,
          enabled,
          timezone: "Europe/London",
          startTime,
          endTime,
          days: selectedDays,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
        onUpdate?.();
      } else {
        setError(data.error || "Failed to save schedule");
      }
    } catch (err) {
      setError("Failed to save schedule. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const selectWeekdays = () => {
    setSelectedDays(["monday", "tuesday", "wednesday", "thursday", "friday"]);
  };

  const selectAllDays = () => {
    setSelectedDays(DAYS_OF_WEEK.map((d) => d.id));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                Scheduled Availability
              </h3>
              <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
                Automatically set your availability based on working hours
              </p>
            </div>
          </div>

          {/* Enable/Disable Toggle */}
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative inline-flex h-7 w-14 items-center rounded-full transition-all duration-300 flex-shrink-0 ${
              enabled
                ? "bg-indigo-500"
                : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-flex items-center justify-center h-5 w-5 transform rounded-full bg-white shadow-md transition-all duration-300 ${
                enabled ? "translate-x-8" : "translate-x-1"
              }`}
            >
              {enabled ? (
                <Check className="h-3 w-3 text-indigo-500" />
              ) : (
                <Clock className="h-3 w-3 text-slate-400" />
              )}
            </span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        className={`transition-all duration-300 ${
          enabled ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        }`}
      >
        <div className="p-4 sm:p-6 space-y-6">
          {/* Working Hours */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-3">
              Working Hours
            </label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Sun className="w-5 h-5 text-amber-600" />
                </div>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>

              <span className="text-slate-400 hidden sm:block">to</span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Moon className="w-5 h-5 text-indigo-600" />
                </div>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all text-sm"
                >
                  {TIME_OPTIONS.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Working Days */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">
                Working Days
              </label>
              <div className="flex gap-2">
                <button
                  onClick={selectWeekdays}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Weekdays
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={selectAllDays}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  All Days
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`py-2 sm:py-3 rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                    selectedDays.includes(day.id)
                      ? "bg-indigo-500 text-white shadow-md"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  <span className="sm:hidden">{day.label.charAt(0)}</span>
                  <span className="hidden sm:inline">{day.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-indigo-50 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-700">
                <p className="font-medium mb-1">How it works</p>
                <p className="text-indigo-600/80">
                  Your availability will automatically turn ON at{" "}
                  <strong>{startTime}</strong> and OFF at{" "}
                  <strong>{endTime}</strong> on selected days. You can still
                  manually override at any time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50">
        <div className="flex items-center justify-between gap-4">
          {/* Status Message */}
          <div className="flex-1 min-w-0">
            {showSuccess && (
              <div className="flex items-center gap-2 text-emerald-600 text-sm">
                <Check className="w-4 h-4" />
                <span>Schedule saved successfully!</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span className="truncate">{error}</span>
              </div>
            )}
            {!showSuccess && !error && !enabled && (
              <p className="text-slate-500 text-sm">
                Enable to set automatic working hours
              </p>
            )}
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-indigo-500 hover:bg-indigo-600 text-white px-6"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Schedule"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
