import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Activity, ExternalLink, FileText, AlertTriangle, CheckCircle2, Edit3 } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { loadAllIntentLandings } from "@/lib/intent-landings-store";
import { ukCitiesData } from "@/lib/uk-cities-data";
import { SERVICE_CATALOG } from "@/lib/services-catalog";
import { postcodeData } from "@/lib/postcode-data";
import { prisma as _prisma } from "@/lib/db";
import { REGENERATE_AFTER_DAYS } from "@/lib/district-landing/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Coverage matrix",
};

// Real ServiceSlug values (see src/lib/services-catalog.ts). Keep in sync
// with src/app/sitemap.ts and src/app/locksmith-area/[slug]/[service]/page.tsx.
const POSTCODE_PILLAR_SERVICES = [
  "emergency-locksmith",
  "lock-change",
  "burglary-lock-repair",
  "car-key-replacement",
  "commercial-locksmith",
] as const;

export default async function AdminSeoCoveragePage() {
  const landings = await loadAllIntentLandings();
  const cities = Object.values(ukCitiesData);

  // ── District landing pages ─────────────────────────────────────────
  let districtPages: Array<{
    id:            string;
    district:      string;
    slug:          string;
    anchorTown:    string | null;
    contentSource: string;
    llmModel:      string | null;
    isPublished:   boolean;
    generatedAt:   Date | null;
    updatedAt:     Date;
  }> = [];
  let districtDbError = false;
  try {
    districtPages = await prisma.districtLandingPage.findMany({
      select: {
        id: true, district: true, slug: true,
        anchorTown: true, contentSource: true,
        llmModel: true, isPublished: true,
        generatedAt: true, updatedAt: true,
      },
      orderBy: { district: "asc" },
    });
  } catch (err) {
    // Degrade gracefully: the rest of the page (intent/service/city matrices,
    // all sourced from static TS) still renders. A DB hiccup on this one
    // query must not take down the whole dashboard with a misleading 404.
    districtDbError = true;
    console.error(
      "[admin/seo/coverage] districtLandingPage query failed:",
      err instanceof Error ? err.message : err,
    );
  }

  const now = Date.now();
  const staleMs = REGENERATE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const staleCount       = districtPages.filter(p => p.generatedAt && (now - p.generatedAt.getTime()) > staleMs).length;
  const needsRefreshCount = districtPages.filter(p => p.contentSource === "needs_refresh").length;
  const manualCount       = districtPages.filter(p => p.contentSource === "manual_override").length;
  const publishedCount    = districtPages.filter(p => p.isPublished).length;

  const totalCells =
    landings.length * cities.length +
    SERVICE_CATALOG.length * cities.length +
    cities.reduce((n, c) => n + c.areas.length, 0) +
    Object.keys(postcodeData).length * POSTCODE_PILLAR_SERVICES.length +
    districtPages.length;

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <Link
          href="/admin/seo"
          className="text-sm text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Intent SEO
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2 mb-1">
          <Activity className="w-7 h-7 text-amber-500" />
          Coverage matrix
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          {totalCells.toLocaleString()} cells across all programmatic surfaces.
        </p>

        {/* Intent × City */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">
            Intent × City
            <span className="text-sm font-normal text-slate-500 ml-2">
              ({landings.length * cities.length} pages)
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-slate-50 z-10">
                    Intent
                  </th>
                  {cities.map((c) => (
                    <th key={c.slug} className="text-center px-2 py-2 whitespace-nowrap">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {landings.map((l) => (
                  <tr key={l.slug}>
                    <td className="px-3 py-2 font-medium text-slate-900 sticky left-0 bg-white whitespace-nowrap">
                      {l.title}
                    </td>
                    {cities.map((c) => (
                      <td key={c.slug} className="text-center px-2 py-2">
                        <a
                          href={`/intent/${l.slug}/in/${c.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block w-5 h-5 rounded-sm bg-emerald-100 hover:bg-emerald-200 text-emerald-700 transition-colors"
                          title={`${l.title} in ${c.name}`}
                          aria-label={`${l.title} in ${c.name}`}
                        >
                          <span className="sr-only">Open</span>
                        </a>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Service × City */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">
            Service × City
            <span className="text-sm font-normal text-slate-500 ml-2">
              ({SERVICE_CATALOG.length * cities.length} pages)
            </span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-3 py-2 sticky left-0 bg-slate-50 z-10">
                    Service
                  </th>
                  {cities.map((c) => (
                    <th key={c.slug} className="text-center px-2 py-2 whitespace-nowrap">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {SERVICE_CATALOG.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-medium text-slate-900 sticky left-0 bg-white whitespace-nowrap">
                      {s.title}
                    </td>
                    {cities.map((c) => (
                      <td key={c.slug} className="text-center px-2 py-2">
                        <a
                          href={`/services/${s.id}/in/${c.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block w-5 h-5 rounded-sm bg-sky-100 hover:bg-sky-200 text-sky-700 transition-colors"
                          title={`${s.title} in ${c.name}`}
                          aria-label={`${s.title} in ${c.name}`}
                        >
                          <span className="sr-only">Open</span>
                        </a>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cities & areas summary */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Cities & areas</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">City</th>
                  <th className="text-left px-4 py-3">Region</th>
                  <th className="text-right px-4 py-3">Areas</th>
                  <th className="text-right px-4 py-3">Postcode prefixes</th>
                  <th className="text-right px-4 py-3">Avg response</th>
                  <th className="text-right px-4 py-3">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cities.map((c) => (
                  <tr key={c.slug}>
                    <td className="px-4 py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-2 text-slate-600">{c.region}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{c.areas.length}</td>
                    <td className="px-4 py-2 text-right text-slate-700">
                      {c.postcodeAreas.join(", ")}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-700">{c.avgResponseTime}</td>
                    <td className="px-4 py-2 text-right">
                      <a
                        href={`/locksmith-city/${c.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 text-xs"
                      >
                        Live <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* District Landing Pages */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">
            District Landing Pages
            <span className="text-sm font-normal text-slate-500 ml-2">
              ({districtPages.length} pages — {publishedCount} published)
            </span>
          </h2>

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-2xl font-bold text-emerald-600">{publishedCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Published</div>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${staleCount > 0 ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white"}`}>
              <div className={`text-2xl font-bold ${staleCount > 0 ? "text-amber-600" : "text-slate-400"}`}>{staleCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Stale (&gt;{REGENERATE_AFTER_DAYS}d)</div>
            </div>
            <div className={`rounded-xl border px-4 py-3 ${needsRefreshCount > 0 ? "border-red-200 bg-red-50" : "border-slate-200 bg-white"}`}>
              <div className={`text-2xl font-bold ${needsRefreshCount > 0 ? "text-red-600" : "text-slate-400"}`}>{needsRefreshCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Needs refresh</div>
            </div>
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
              <div className="text-2xl font-bold text-violet-600">{manualCount}</div>
              <div className="text-xs text-slate-500 mt-0.5">Manual override</div>
            </div>
          </div>

          {districtDbError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm">
              <p className="font-semibold text-red-700 mb-1">
                Couldn&apos;t load district landing pages
              </p>
              <p className="text-red-600">
                The database read for this section failed. The rest of this page is
                still accurate (it&apos;s generated from static config). Check the
                deployment&apos;s function logs for <code>/admin/seo/coverage</code>,
                then reload.
              </p>
            </div>
          ) : districtPages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500 text-sm">
              No district landing pages yet. They are created automatically when a campaign draft is published for a covered district.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-3 py-2">District</th>
                    <th className="text-left px-3 py-2">Town</th>
                    <th className="text-center px-3 py-2">Published</th>
                    <th className="text-left px-3 py-2">Source</th>
                    <th className="text-right px-3 py-2">Age</th>
                    <th className="text-left px-3 py-2 hidden sm:table-cell">Model</th>
                    <th className="text-center px-3 py-2">Live</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {districtPages.map((p) => {
                    const ageDays = p.generatedAt
                      ? Math.floor((now - p.generatedAt.getTime()) / (24 * 60 * 60 * 1000))
                      : null;
                    const isStale = ageDays !== null && ageDays > REGENERATE_AFTER_DAYS;
                    const sourceLabel =
                      p.contentSource === "manual_override" ? "Manual"
                      : p.contentSource === "needs_refresh"  ? "Needs refresh"
                      : "AI";
                    const sourceCls =
                      p.contentSource === "manual_override" ? "bg-violet-100 text-violet-700"
                      : p.contentSource === "needs_refresh"  ? "bg-red-100 text-red-700"
                      : "bg-sky-100 text-sky-700";
                    return (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                          {p.district}
                        </td>
                        <td className="px-3 py-2 text-slate-600">
                          {p.anchorTown ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {p.isPublished ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                          ) : (
                            <span className="inline-block w-4 h-4 rounded-full bg-slate-200" />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceCls}`}>
                            {p.contentSource === "manual_override" && <Edit3 className="w-2.5 h-2.5" />}
                            {p.contentSource === "needs_refresh"   && <AlertTriangle className="w-2.5 h-2.5" />}
                            {p.contentSource === "ai_generated"    && <FileText className="w-2.5 h-2.5" />}
                            {sourceLabel}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${isStale ? "text-amber-600 font-medium" : "text-slate-500"}`}>
                          {ageDays === null ? "—" : ageDays === 0 ? "today" : `${ageDays}d`}
                          {isStale && " ⚠"}
                        </td>
                        <td className="px-3 py-2 text-slate-400 hidden sm:table-cell truncate max-w-[140px]">
                          {p.llmModel ? p.llmModel.replace(/^(ollama|openai):/, "") : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <a
                            href={`/locksmith-in/${p.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-amber-700 hover:text-amber-800"
                            title={`/locksmith-in/${p.slug}`}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminSidebar>
  );
}
