"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { SERVICE_SLUGS, type ServiceSlug } from "@/lib/services-catalog";
import { Loader2, Rocket, ExternalLink, AlertTriangle } from "lucide-react";

interface LaunchResponse {
  success?: boolean;
  campaignId?: string;
  approvalId?: string | null;
  summary?: { slugs: string[]; dailyBudget: number; durationDays: number; totalAds: number };
  error?: string;
}

const SLUG_LABELS: Record<ServiceSlug, string> = {
  "emergency-locksmith": "Emergency Locksmith",
  "locked-out": "Locked Out",
  "lock-change": "Lock Change",
  "broken-key-extraction": "Broken Key Extraction",
  "upvc-door-lock-repair": "uPVC Door Lock Repair",
  "burglary-lock-repair": "Burglary Lock Repair",
  "car-key-replacement": "Car Key Replacement",
  "safe-opening": "Safe Opening",
  "landlord-lock-change": "Landlord Lock Change",
  "commercial-locksmith": "Commercial Locksmith",
};

export function LaunchEngineClient() {
  const [selected, setSelected] = useState<Set<ServiceSlug>>(new Set(["locked-out", "emergency-locksmith"]));
  const [dailyBudget, setDailyBudget] = useState("5");
  const [durationDays, setDurationDays] = useState("14");
  const [city, setCity] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<LaunchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (slug: ServiceSlug) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/ads/launch-catalog-campaign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slugs: Array.from(selected),
          dailyBudget: Number(dailyBudget),
          durationDays: Number(durationDays),
          city: city.trim() || undefined,
          requestApproval: true,
          initiator: "admin",
        }),
      });
      const json = (await res.json()) as LaunchResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Launch failed");
      }
      setResult(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const totalAds = selected.size * 2 * 4; // 2 adsets × 4 variants per slug

  return (
    <AdminSidebar>
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Rocket className="size-6 text-orange-500" />
            Launch Acquisition Engine
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Builds a catalog-driven Meta campaign with 2 ad sets (prospecting + 180-day retargeting) and 4 direct-response
            ad variants per service. Drafted as paused; goes live when you approve at{" "}
            <Link href="/admin/agents/approvals" className="text-orange-600 hover:underline">
              /admin/agents/approvals
            </Link>
            .
          </p>
        </header>

        <form onSubmit={submit} className="space-y-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-slate-700">Services</label>
            <p className="mt-0.5 text-xs text-slate-500">
              Each selected service gets 4 DR copy variants (urgency / social proof / risk reversal / authority).
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SERVICE_SLUGS.map((slug) => (
                <label
                  key={slug}
                  className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm ${
                    selected.has(slug) ? "border-orange-400 bg-orange-50" : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selected.has(slug)}
                    onChange={() => toggle(slug)}
                  />
                  <span>
                    <span className="font-medium">{SLUG_LABELS[slug]}</span>
                    <span className="block font-mono text-[11px] text-slate-500">{slug}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Daily budget (£)</label>
              <input
                type="number"
                min={1}
                step={0.5}
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Duration (days)</label>
              <input
                type="number"
                min={1}
                max={90}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">City (optional)</label>
              <input
                type="text"
                placeholder="London"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span>
              Will draft <strong>{selected.size}</strong> service(s) × 2 ad sets × 4 DR variants = <strong>{totalAds}</strong> ads
            </span>
            <span className="text-slate-400">PAUSED until approved</span>
          </div>

          <button
            type="submit"
            disabled={submitting || selected.size === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
            {submitting ? "Generating DR variants…" : "Launch acquisition engine"}
          </button>
        </form>

        {error && (
          <div className="flex items-start gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {result?.success && (
          <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p className="font-medium text-emerald-800">Draft created. Awaiting approval.</p>
            <ul className="space-y-1 text-emerald-700">
              <li>Services: {result.summary?.slugs.join(", ")}</li>
              <li>
                Daily budget: £{result.summary?.dailyBudget.toFixed(2)} · Duration: {result.summary?.durationDays} days
              </li>
              <li>Total ads: {result.summary?.totalAds}</li>
            </ul>
            <div className="flex flex-wrap gap-3 pt-2">
              {result.campaignId && (
                <Link
                  href={`/admin/ads/${result.campaignId}`}
                  className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-3 py-1.5 text-emerald-700 hover:bg-emerald-100"
                >
                  View draft <ExternalLink className="size-3" />
                </Link>
              )}
              <Link
                href="/admin/agents/approvals"
                className="inline-flex items-center gap-1 rounded bg-orange-500 px-3 py-1.5 font-medium text-white hover:bg-orange-600"
              >
                Go to approvals
              </Link>
            </div>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}
