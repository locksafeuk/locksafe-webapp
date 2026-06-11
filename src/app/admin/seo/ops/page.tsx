import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, Activity, ExternalLink, FileText, AlertTriangle,
  CheckCircle2, Edit3, MapPin, Users, Layers, AlertCircle,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { loadActiveIntentLandings } from "@/lib/intent-landings-store";
import {
  loadActiveKeywordTemplates,
  citiesForTemplate,
} from "@/lib/keyword-templates-store";
import { INTENTS, PILLAR_KEYWORDS } from "@/lib/intents-catalog";
import { ukCitiesData } from "@/lib/uk-cities-data";
import { SERVICE_CATALOG } from "@/lib/services-catalog";
import { postcodeData } from "@/lib/postcode-data";
import { prisma as _prisma } from "@/lib/db";
import { REGENERATE_AFTER_DAYS } from "@/lib/district-landing/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = _prisma as any;

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SEO Live Ops",
};

const POSTCODE_PILLAR_COUNT = 5; // mirrors /locksmith-area/[slug]/[service] generator
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();

export default async function AdminSeoLiveOpsPage() {
  // ── Static surfaces (always available, no DB) ──────────────────────────
  const landings = await loadActiveIntentLandings();
  const activeKeywords = await loadActiveKeywordTemplates();
  const cities = Object.values(ukCitiesData);
  const cityCount = cities.length;
  const serviceCount = SERVICE_CATALOG.length;
  const postcodeCount = Object.keys(postcodeData).length;
  const totalAreas = cities.reduce((n, c) => n + c.areas.length, 0);

  const intentPages = landings.length;
  const intentGeoPages = intentPages * cityCount;
  const serviceGeoPages = serviceCount * cityCount;
  const cityAreaPages = totalAreas;
  const postcodeServicePages = postcodeCount * POSTCODE_PILLAR_COUNT;
  const keywordPages = activeKeywords.reduce((n, t) => n + citiesForTemplate(t).length, 0);
  const totalPages =
    intentPages + intentGeoPages + serviceGeoPages + cityAreaPages + postcodeServicePages + keywordPages;

  // ── Supply side: LocksmithCoverage (resilient) ─────────────────────────
  let coverageRows: Array<{
    postcodeDistrict: string;
    city:             string | null;
    region:           string | null;
    isPaused:         boolean;
    weeklyCapacity:   number;
    locksmithId:      string;
  }> = [];
  let coverageDbError = false;
  try {
    coverageRows = await prisma.locksmithCoverage.findMany({
      select: {
        postcodeDistrict: true, city: true, region: true,
        isPaused: true, weeklyCapacity: true, locksmithId: true,
      },
    });
  } catch (err) {
    coverageDbError = true;
    console.error("[admin/seo/coverage] locksmithCoverage query failed:", err instanceof Error ? err.message : err);
  }

  const activeRows = coverageRows.filter((r) => !r.isPaused);
  const activeDistricts = new Set(activeRows.map((r) => r.postcodeDistrict.toUpperCase()));
  const activeLocksmiths = new Set(activeRows.map((r) => r.locksmithId));
  const totalCapacity = activeRows.reduce((n, r) => n + (r.weeklyCapacity ?? 0), 0);

  // Supply grouped by denormalised city name.
  const supplyByCity = new Map<string, { locksmiths: Set<string>; capacity: number; districts: Set<string> }>();
  for (const r of activeRows) {
    const key = norm(r.city);
    if (!key) continue;
    if (!supplyByCity.has(key)) supplyByCity.set(key, { locksmiths: new Set(), capacity: 0, districts: new Set() });
    const bucket = supplyByCity.get(key)!;
    bucket.locksmiths.add(r.locksmithId);
    bucket.capacity += r.weeklyCapacity ?? 0;
    bucket.districts.add(r.postcodeDistrict.toUpperCase());
  }

  // ── District landing pages (resilient) ─────────────────────────────────
  let districtPages: Array<{
    id: string; district: string; slug: string; anchorTown: string | null;
    contentSource: string; llmModel: string | null; isPublished: boolean;
    generatedAt: Date | null; updatedAt: Date;
  }> = [];
  let districtDbError = false;
  try {
    districtPages = await prisma.districtLandingPage.findMany({
      select: {
        id: true, district: true, slug: true, anchorTown: true,
        contentSource: true, llmModel: true, isPublished: true,
        generatedAt: true, updatedAt: true,
      },
      orderBy: { district: "asc" },
    });
  } catch (err) {
    districtDbError = true;
    console.error("[admin/seo/coverage] districtLandingPage query failed:", err instanceof Error ? err.message : err);
  }

  const now = Date.now();
  const staleMs = REGENERATE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const staleCount        = districtPages.filter((p) => p.generatedAt && (now - p.generatedAt.getTime()) > staleMs).length;
  const needsRefreshCount = districtPages.filter((p) => p.contentSource === "needs_refresh").length;
  const manualCount       = districtPages.filter((p) => p.contentSource === "manual_override").length;
  const publishedCount    = districtPages.filter((p) => p.isPublished).length;
  const publishedDistricts = new Set(districtPages.filter((p) => p.isPublished).map((p) => p.district.toUpperCase()));

  // ── GAP ANALYSIS ───────────────────────────────────────────────────────
  // 1. Covered districts with NO published landing page (buildable pages).
  const coveredNoPage = [...activeDistricts].filter((d) => !publishedDistricts.has(d)).sort();
  // 2. Published district pages with NO active coverage (demand, no supply).
  const pageNoCoverage = districtPages.filter((p) => p.isPublished && !activeDistricts.has(p.district.toUpperCase()));
  // 3. Cities (full programmatic page set) with NO active locksmith supply.
  const cityRows = cities.map((c) => {
    const supply = supplyByCity.get(norm(c.name));
    const perCityPages = intentPages + serviceCount + 1 + c.areas.length; // intent×city + service×city + city hub + area pages
    return {
      name: c.name,
      region: c.region,
      pages: perCityPages,
      locksmiths: supply ? supply.locksmiths.size : 0,
      capacity: supply ? supply.capacity : 0,
      districts: supply ? supply.districts.size : 0,
      healthy: !!supply && supply.locksmiths.size > 0,
    };
  });
  const citiesNoSupply = cityRows.filter((c) => !c.healthy);
  // 4. Content gaps.
  const missingLandings = INTENTS.filter((i) => !landings.some((l) => l.slug === i.slug));
  const weakPillars = PILLAR_KEYWORDS.map((pk) => ({
    pillar: pk,
    landings: landings.filter((l) => l.pillarKeyword === pk).length,
  })).filter((p) => p.landings < 2);

  // Districts covered in areas outside our city catalog (supply we don't surface as a city page).
  const coverageCitiesUnknown = [...supplyByCity.keys()].filter(
    (k) => !cities.some((c) => norm(c.name) === k),
  );

  const anyDbError = coverageDbError || districtDbError;

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
          SEO Live Ops
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          Where we have pages, where we have locksmiths, and where the two don&apos;t line up.
          Pages are generated programmatically for every area — the gaps that matter are <strong>supply</strong>.
        </p>

        {anyDbError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Some live data couldn&apos;t be loaded
              {coverageDbError && " (locksmith coverage)"}
              {coverageDbError && districtDbError && " and"}
              {districtDbError && " (district pages)"}.
              The static page counts below are still accurate; supply/gap figures may be incomplete. Reload to retry.
            </span>
          </div>
        )}

        {/* ── KPI strip ── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
          <KpiCard label="Total SSG pages" value={totalPages.toLocaleString()} icon={Layers} accent="amber" />
          <KpiCard label="Active locksmiths" value={activeLocksmiths.size.toLocaleString()} sub={`${totalCapacity} jobs/wk capacity`} icon={Users} />
          <KpiCard label="Districts covered" value={activeDistricts.size.toLocaleString()} icon={MapPin} />
          <KpiCard label="District pages live" value={publishedCount.toLocaleString()} icon={FileText} />
          <KpiCard
            label="Covered, no page"
            value={coveredNoPage.length.toLocaleString()}
            icon={AlertTriangle}
            accent={coveredNoPage.length > 0 ? "warn" : undefined}
          />
          <KpiCard
            label="Pages, no supply"
            value={(citiesNoSupply.length + pageNoCoverage.length).toLocaleString()}
            icon={AlertTriangle}
            accent={(citiesNoSupply.length + pageNoCoverage.length) > 0 ? "warn" : undefined}
          />
        </div>

        {/* ── GAP 1: Covered districts with no landing page ── */}
        <GapSection
          title="Supply with no page"
          subtitle="Postcode districts you actively cover that have no published /locksmith-in landing page. These are buildable pages — district pages currently only auto-generate when an ad draft publishes (gated), so this is your backlog."
          tone={coveredNoPage.length > 0 ? "warn" : "ok"}
        >
          {coverageDbError ? (
            <Muted>Coverage data unavailable — can&apos;t compute this gap right now.</Muted>
          ) : coveredNoPage.length === 0 ? (
            <Muted>Every covered district has a published landing page. ✓</Muted>
          ) : (
            <div className="flex flex-wrap gap-2">
              {coveredNoPage.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-mono font-semibold text-amber-800">
                  {d}
                </span>
              ))}
            </div>
          )}
        </GapSection>

        {/* ── GAP 2: Cities with pages but no supply ── */}
        <GapSection
          title="Demand with no supply"
          subtitle="Cities whose full programmatic page set is live (and may be drawing ad spend) but where you currently have no active locksmith to fulfil a job. Either recruit here or be aware before spending."
          tone={citiesNoSupply.length > 0 ? "warn" : "ok"}
        >
          {coverageDbError ? (
            <Muted>Coverage data unavailable — can&apos;t compute this gap right now.</Muted>
          ) : citiesNoSupply.length === 0 ? (
            <Muted>Every catalogued city has at least one active locksmith. ✓</Muted>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {citiesNoSupply.map((c) => (
                <div key={c.name} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                  <div className="font-medium text-slate-900">{c.name}</div>
                  <div className="text-[11px] text-slate-500">{c.region} · {c.pages.toLocaleString()} pages live</div>
                </div>
              ))}
            </div>
          )}
        </GapSection>

        {/* ── Supply vs demand: full city table ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-1">Supply vs demand by city</h2>
          <p className="text-sm text-slate-600 mb-3">All {cityCount} catalogued cities. Every city has its full page set live; the question is whether you can fulfil.</p>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">City</th>
                  <th className="text-left px-4 py-3">Region</th>
                  <th className="text-right px-4 py-3">Pages live</th>
                  <th className="text-right px-4 py-3">Locksmiths</th>
                  <th className="text-right px-4 py-3">Districts</th>
                  <th className="text-right px-4 py-3">Capacity/wk</th>
                  <th className="text-center px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...cityRows].sort((a, b) => Number(a.healthy) - Number(b.healthy) || a.name.localeCompare(b.name)).map((c) => (
                  <tr key={c.name} className={c.healthy ? "" : "bg-amber-50/40"}>
                    <td className="px-4 py-2 font-medium text-slate-900">{c.name}</td>
                    <td className="px-4 py-2 text-slate-600">{c.region}</td>
                    <td className="px-4 py-2 text-right text-slate-700 tabular-nums">{c.pages.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-slate-700 tabular-nums">{c.locksmiths}</td>
                    <td className="px-4 py-2 text-right text-slate-700 tabular-nums">{c.districts}</td>
                    <td className="px-4 py-2 text-right text-slate-700 tabular-nums">{c.capacity}</td>
                    <td className="px-4 py-2 text-center">
                      {c.healthy ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Healthy
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" /> No supply
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {coverageCitiesUnknown.length > 0 && (
            <p className="text-xs text-slate-500 mt-2">
              You also have active coverage in {coverageCitiesUnknown.length} area(s) outside the city catalog:{" "}
              <span className="text-slate-700">{coverageCitiesUnknown.slice(0, 12).join(", ")}{coverageCitiesUnknown.length > 12 ? "…" : ""}</span>.
            </p>
          )}
        </section>

        {/* ── Content gaps ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Content gaps</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900 mb-2">Intents missing content</p>
              {missingLandings.length === 0 ? (
                <p className="text-sm text-emerald-700">All {INTENTS.length} catalogued intents have content. ✓</p>
              ) : (
                <ul className="text-sm text-slate-700 space-y-1">
                  {missingLandings.map((i) => (
                    <li key={i.slug} className="font-mono text-xs text-amber-800">{i.slug}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900 mb-2">Weak pillars (&lt;2 landings)</p>
              {weakPillars.length === 0 ? (
                <p className="text-sm text-emerald-700">Every pillar has ≥2 landings. ✓</p>
              ) : (
                <ul className="text-sm text-slate-700 space-y-1">
                  {weakPillars.map((p) => (
                    <li key={p.pillar} className="flex justify-between">
                      <span className="font-mono text-xs">{p.pillar}</span>
                      <span className="text-xs text-amber-700">{p.landings}/2</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-semibold text-slate-900 mb-2">Surface totals</p>
              <ul className="text-sm text-slate-700 space-y-1">
                <li className="flex justify-between"><span>Active intents</span><span className="tabular-nums">{intentPages}</span></li>
                <li className="flex justify-between"><span>Services</span><span className="tabular-nums">{serviceCount}</span></li>
                <li className="flex justify-between"><span>Keyword templates</span><span className="tabular-nums">{activeKeywords.length}</span></li>
                <li className="flex justify-between"><span>Postcode landings</span><span className="tabular-nums">{postcodeCount}</span></li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── District landing page health ── */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">
            District landing page health
            <span className="text-sm font-normal text-slate-500 ml-2">
              ({districtPages.length} pages — {publishedCount} published)
            </span>
          </h2>

          {districtDbError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center text-sm">
              <p className="font-semibold text-red-700 mb-1">Couldn&apos;t load district landing pages</p>
              <p className="text-red-600">The database read for this section failed. Everything above sourced from static config is still accurate. Check the function logs for <code>/admin/seo/coverage</code>, then reload.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
                <StatCard value={publishedCount} label="Published" tone="emerald" />
                <StatCard value={staleCount} label={`Stale (>${REGENERATE_AFTER_DAYS}d)`} tone={staleCount > 0 ? "amber" : "slate"} />
                <StatCard value={needsRefreshCount} label="Needs refresh" tone={needsRefreshCount > 0 ? "red" : "slate"} />
                <StatCard value={manualCount} label="Manual override" tone="violet" />
                <StatCard value={pageNoCoverage.length} label="No active supply" tone={pageNoCoverage.length > 0 ? "amber" : "slate"} />
              </div>

              {districtPages.length === 0 ? (
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
                        <th className="text-center px-3 py-2">Supply</th>
                        <th className="text-left px-3 py-2">Source</th>
                        <th className="text-right px-3 py-2">Age</th>
                        <th className="text-center px-3 py-2">Live</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {districtPages.map((p) => {
                        const ageDays = p.generatedAt ? Math.floor((now - p.generatedAt.getTime()) / (24 * 60 * 60 * 1000)) : null;
                        const isStale = ageDays !== null && ageDays > REGENERATE_AFTER_DAYS;
                        const hasSupply = activeDistricts.has(p.district.toUpperCase());
                        const sourceLabel =
                          p.contentSource === "manual_override" ? "Manual"
                          : p.contentSource === "needs_refresh" ? "Needs refresh" : "AI";
                        const sourceCls =
                          p.contentSource === "manual_override" ? "bg-violet-100 text-violet-700"
                          : p.contentSource === "needs_refresh" ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-700";
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 font-mono font-semibold text-slate-900">{p.district}</td>
                            <td className="px-3 py-2 text-slate-600">{p.anchorTown ?? "—"}</td>
                            <td className="px-3 py-2 text-center">
                              {p.isPublished ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" /> : <span className="inline-block w-4 h-4 rounded-full bg-slate-200" />}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {coverageDbError ? (
                                <span className="text-slate-300">—</span>
                              ) : hasSupply ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                              ) : (
                                <span title="Published page with no active coverage" className="inline-flex"><AlertTriangle className="w-4 h-4 text-amber-500 inline" /></span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceCls}`}>
                                {p.contentSource === "manual_override" && <Edit3 className="w-2.5 h-2.5" />}
                                {p.contentSource === "needs_refresh" && <AlertTriangle className="w-2.5 h-2.5" />}
                                {p.contentSource === "ai_generated" && <FileText className="w-2.5 h-2.5" />}
                                {sourceLabel}
                              </span>
                            </td>
                            <td className={`px-3 py-2 text-right tabular-nums ${isStale ? "text-amber-600 font-medium" : "text-slate-500"}`}>
                              {ageDays === null ? "—" : ageDays === 0 ? "today" : `${ageDays}d`}{isStale && " ⚠"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <a href={`/locksmith-in/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-amber-700 hover:text-amber-800" title={`/locksmith-in/${p.slug}`}>
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
            </>
          )}
        </section>

        {/* ── Programmatic matrices (collapsed) ── */}
        <details className="mb-6 rounded-xl border border-slate-200 bg-white">
          <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-slate-900 text-sm">
            Programmatic matrices — Intent × City ({intentPages * cityCount}) and Service × City ({serviceCount * cityCount})
          </summary>
          <div className="px-4 pb-4 space-y-8">
            <MatrixTable
              caption="Intent × City"
              rows={landings.map((l) => ({ key: l.slug, label: l.title, href: (c: string) => `/intent/${l.slug}/in/${c}` }))}
              cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
              cellClass="bg-emerald-100 hover:bg-emerald-200"
            />
            <MatrixTable
              caption="Service × City"
              rows={SERVICE_CATALOG.map((s) => ({ key: s.id, label: s.title, href: (c: string) => `/services/${s.id}/in/${c}` }))}
              cities={cities.map((c) => ({ slug: c.slug, name: c.name }))}
              cellClass="bg-sky-100 hover:bg-sky-200"
            />
          </div>
        </details>
      </div>
    </AdminSidebar>
  );
}

// ── Presentational helpers ─────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "amber" | "warn";
}) {
  const border = accent === "amber" ? "border-amber-300 ring-1 ring-amber-100" : accent === "warn" ? "border-amber-300 bg-amber-50" : "border-slate-200";
  return (
    <div className={`rounded-xl border bg-white p-4 ${border}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className={accent ? "w-4 h-4 text-amber-500" : "w-4 h-4 text-slate-400"} />
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StatCard({ value, label, tone }: { value: number; label: string; tone: "emerald" | "amber" | "red" | "violet" | "slate" }) {
  const map: Record<string, string> = {
    emerald: "text-emerald-600 border-slate-200 bg-white",
    amber: "text-amber-600 border-amber-200 bg-amber-50",
    red: "text-red-600 border-red-200 bg-red-50",
    violet: "text-violet-600 border-violet-200 bg-violet-50",
    slate: "text-slate-400 border-slate-200 bg-white",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${map[tone]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}

function GapSection({ title, subtitle, tone, children }: { title: string; subtitle: string; tone: "warn" | "ok"; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-2 mb-1">
        {tone === "warn" ? <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" /> : <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />}
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <p className="text-sm text-slate-600 mb-4 ml-7">{subtitle}</p>
      <div className="ml-7">{children}</div>
    </section>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

function MatrixTable({
  caption, rows, cities, cellClass,
}: {
  caption: string;
  rows: Array<{ key: string; label: string; href: (citySlug: string) => string }>;
  cities: Array<{ slug: string; name: string }>;
  cellClass: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900 mb-2">{caption} <span className="font-normal text-slate-500">({rows.length * cities.length} pages)</span></h3>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 sticky left-0 bg-slate-50 z-10">{caption.split(" ")[0]}</th>
              {cities.map((c) => (
                <th key={c.slug} className="text-center px-2 py-2 whitespace-nowrap">{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="px-3 py-2 font-medium text-slate-900 sticky left-0 bg-white whitespace-nowrap">{r.label}</td>
                {cities.map((c) => (
                  <td key={c.slug} className="text-center px-2 py-2">
                    <a href={r.href(c.slug)} target="_blank" rel="noopener noreferrer" className={`inline-block w-5 h-5 rounded-sm ${cellClass} transition-colors`} title={`${r.label} in ${c.name}`} aria-label={`${r.label} in ${c.name}`}>
                      <span className="sr-only">Open</span>
                    </a>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
