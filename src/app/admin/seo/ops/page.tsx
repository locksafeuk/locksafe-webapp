import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft, Activity, ExternalLink, FileText, AlertTriangle,
  CheckCircle2, MapPin, Users, Layers, AlertCircle, ChevronRight,
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

type City = (typeof ukCitiesData)[keyof typeof ukCitiesData];

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

  // Map every postcode-area prefix (e.g. "M", "EC", "WD") → its city, so a
  // coverage district can be resolved to a city by its outward-code prefix.
  // This is the reliable match (the denormalised `city` field on coverage
  // rows is often blank / inconsistent).
  const cityByPrefix = new Map<string, City>();
  for (const c of cities) {
    for (const area of c.postcodeAreas) cityByPrefix.set(area.toUpperCase(), c);
  }
  const districtToCity = (district: string): City | undefined => {
    const prefix = district.toUpperCase().match(/^[A-Z]+/)?.[0] ?? "";
    return cityByPrefix.get(prefix);
  };

  // ── Supply side: LocksmithCoverage (resilient) ─────────────────────────
  let coverageRows: Array<{
    postcodeDistrict: string;
    isPaused:         boolean;
    weeklyCapacity:   number;
    locksmithId:      string;
  }> = [];
  let coverageDbError = false;
  try {
    coverageRows = await prisma.locksmithCoverage.findMany({
      select: { postcodeDistrict: true, isPaused: true, weeklyCapacity: true, locksmithId: true },
    });
  } catch (err) {
    coverageDbError = true;
    console.error("[admin/seo/ops] locksmithCoverage query failed:", err instanceof Error ? err.message : err);
  }

  const activeRows = coverageRows.filter((r) => !r.isPaused);
  const activeDistricts = new Set(activeRows.map((r) => r.postcodeDistrict.toUpperCase()));
  const activeLocksmiths = new Set(activeRows.map((r) => r.locksmithId));
  const totalCapacity = activeRows.reduce((n, r) => n + (r.weeklyCapacity ?? 0), 0);

  // Supply grouped by city (via postcode-prefix match).
  const supplyByCity = new Map<string, { locksmiths: Set<string>; capacity: number; districts: Set<string> }>();
  const unmatchedDistricts = new Set<string>();
  for (const r of activeRows) {
    const city = districtToCity(r.postcodeDistrict);
    if (!city) { unmatchedDistricts.add(r.postcodeDistrict.toUpperCase()); continue; }
    if (!supplyByCity.has(city.slug)) supplyByCity.set(city.slug, { locksmiths: new Set(), capacity: 0, districts: new Set() });
    const b = supplyByCity.get(city.slug)!;
    b.locksmiths.add(r.locksmithId);
    b.capacity += r.weeklyCapacity ?? 0;
    b.districts.add(r.postcodeDistrict.toUpperCase());
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
    console.error("[admin/seo/ops] districtLandingPage query failed:", err instanceof Error ? err.message : err);
  }

  const now = Date.now();
  const staleMs = REGENERATE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  const staleCount        = districtPages.filter((p) => p.generatedAt && (now - p.generatedAt.getTime()) > staleMs).length;
  const needsRefreshCount = districtPages.filter((p) => p.contentSource === "needs_refresh").length;
  const publishedCount    = districtPages.filter((p) => p.isPublished).length;
  const publishedDistricts = new Set(districtPages.filter((p) => p.isPublished).map((p) => p.district.toUpperCase()));

  // ── GAP ANALYSIS ───────────────────────────────────────────────────────
  const coveredNoPage = [...activeDistricts].filter((d) => !publishedDistricts.has(d)).sort();
  const pageNoCoverage = districtPages.filter((p) => p.isPublished && !activeDistricts.has(p.district.toUpperCase()));
  const cityRows = cities.map((c) => {
    const supply = supplyByCity.get(c.slug);
    const perCityPages = intentPages + serviceCount + 1 + c.areas.length;
    return {
      name: c.name, region: c.region, pages: perCityPages,
      locksmiths: supply ? supply.locksmiths.size : 0,
      capacity: supply ? supply.capacity : 0,
      districts: supply ? supply.districts.size : 0,
      healthy: !!supply && supply.locksmiths.size > 0,
    };
  });
  const citiesNoSupply = cityRows.filter((c) => !c.healthy);
  const citiesHealthy = cityRows.filter((c) => c.healthy);
  const missingLandings = INTENTS.filter((i) => !landings.some((l) => l.slug === i.slug));
  const weakPillars = PILLAR_KEYWORDS.map((pk) => ({
    pillar: pk, landings: landings.filter((l) => l.pillarKeyword === pk).length,
  })).filter((p) => p.landings < 2);

  const anyDbError = coverageDbError || districtDbError;

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <Link href="/admin/seo" className="text-sm text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 mb-2">
          <ArrowLeft className="w-4 h-4" /> Back to Intent SEO
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2 mb-1">
          <Activity className="w-7 h-7 text-amber-500" /> SEO Live Ops
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          Pages are generated for every area automatically — the gaps that matter are <strong>supply</strong>.
          Headline numbers and gaps are up top; expand any section for the full list.
        </p>

        {anyDbError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Some live data couldn&apos;t be loaded
              {coverageDbError && " (locksmith coverage)"}{coverageDbError && districtDbError && " and"}{districtDbError && " (district pages)"}.
              Static page counts are still accurate; supply/gap figures may be incomplete. Reload to retry.
            </span>
          </div>
        )}

        {/* ── KPI strip — always visible ── */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          <KpiCard label="Total SSG pages" value={totalPages.toLocaleString()} icon={Layers} accent="amber" />
          <KpiCard label="Active locksmiths" value={activeLocksmiths.size.toLocaleString()} sub={`${totalCapacity} jobs/wk`} icon={Users} />
          <KpiCard label="Districts covered" value={activeDistricts.size.toLocaleString()} icon={MapPin} />
          <KpiCard label="District pages live" value={publishedCount.toLocaleString()} icon={FileText} />
          <KpiCard label="Cities with supply" value={`${citiesHealthy.length}/${cityCount}`} icon={CheckCircle2} accent={citiesNoSupply.length > 0 ? "warn" : undefined} />
          <KpiCard label="Covered, no page" value={coveredNoPage.length.toLocaleString()} icon={AlertTriangle} accent={coveredNoPage.length > 0 ? "warn" : undefined} />
        </div>

        {/* ── Action gaps — compact cards, lists collapsed ── */}
        <h2 className="text-lg font-bold text-slate-900 mb-3">Gaps that need action</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <GapCard
            tone={citiesNoSupply.length > 0 ? "warn" : "ok"}
            value={citiesNoSupply.length}
            title="Cities: demand, no supply"
            blurb="Full page set live (maybe drawing ad spend) but no active locksmith to fulfil. Recruit or pause spend here."
          >
            {coverageDbError ? <Muted>Coverage data unavailable.</Muted>
              : citiesNoSupply.length === 0 ? <Muted>Every city has active supply. ✓</Muted>
              : (
                <div className="flex flex-wrap gap-1.5">
                  {citiesNoSupply.map((c) => (
                    <span key={c.name} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">{c.name}</span>
                  ))}
                </div>
              )}
          </GapCard>

          <GapCard
            tone={coveredNoPage.length > 0 ? "warn" : "ok"}
            value={coveredNoPage.length}
            title="Covered districts, no page"
            blurb="Districts you cover with no /locksmith-in landing page. Buildable backlog — district pages only auto-generate when an ad draft publishes (gated)."
          >
            {coverageDbError ? <Muted>Coverage data unavailable.</Muted>
              : coveredNoPage.length === 0 ? <Muted>Every covered district has a page. ✓</Muted>
              : (
                <div className="flex flex-wrap gap-1.5 max-h-64 overflow-y-auto">
                  {coveredNoPage.map((d) => (
                    <span key={d} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-mono font-semibold text-amber-800">{d}</span>
                  ))}
                </div>
              )}
          </GapCard>

          <GapCard
            tone={(pageNoCoverage.length + staleCount + needsRefreshCount) > 0 ? "warn" : "ok"}
            value={pageNoCoverage.length + staleCount + needsRefreshCount}
            title="District pages needing attention"
            blurb="Published pages with no active coverage, plus stale or refresh-flagged pages."
          >
            {districtDbError ? <Muted>District page data unavailable.</Muted> : (
              <ul className="text-xs text-slate-700 space-y-1">
                <li className="flex justify-between"><span>Published, no active supply</span><span className="tabular-nums font-medium">{pageNoCoverage.length}</span></li>
                <li className="flex justify-between"><span>Stale (&gt;{REGENERATE_AFTER_DAYS}d)</span><span className="tabular-nums font-medium">{staleCount}</span></li>
                <li className="flex justify-between"><span>Needs refresh</span><span className="tabular-nums font-medium">{needsRefreshCount}</span></li>
                <li className="flex justify-between text-slate-500"><span>Published total</span><span className="tabular-nums">{publishedCount}</span></li>
              </ul>
            )}
          </GapCard>
        </div>

        {/* ── Content gaps — compact, visible ── */}
        <h2 className="text-lg font-bold text-slate-900 mb-3">Content coverage</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-8">
          <MiniCard title="Intents missing content" ok={missingLandings.length === 0} okLabel={`All ${INTENTS.length} intents have content. ✓`}>
            {missingLandings.map((i) => <li key={i.slug} className="font-mono text-xs text-amber-800">{i.slug}</li>)}
          </MiniCard>
          <MiniCard title="Weak pillars (<2 landings)" ok={weakPillars.length === 0} okLabel="Every pillar has ≥2 landings. ✓">
            {weakPillars.map((p) => (
              <li key={p.pillar} className="flex justify-between text-xs"><span className="font-mono">{p.pillar}</span><span className="text-amber-700">{p.landings}/2</span></li>
            ))}
          </MiniCard>
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

        {/* ── Detail tables — collapsed by default to keep the page short ── */}
        <h2 className="text-lg font-bold text-slate-900 mb-3">Detail</h2>
        <div className="space-y-3">

          <Foldout summary={`Supply vs demand by city — ${citiesHealthy.length}/${cityCount} cities with active supply`}>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="text-left px-4 py-2">City</th>
                    <th className="text-left px-4 py-2">Region</th>
                    <th className="text-right px-4 py-2">Pages</th>
                    <th className="text-right px-4 py-2">Locksmiths</th>
                    <th className="text-right px-4 py-2">Districts</th>
                    <th className="text-right px-4 py-2">Cap/wk</th>
                    <th className="text-center px-4 py-2">Status</th>
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
                        {c.healthy
                          ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Healthy</span>
                          : <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><AlertTriangle className="w-3 h-3" /> No supply</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {unmatchedDistricts.size > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                {unmatchedDistricts.size} covered district(s) didn&apos;t map to a catalogued city by postcode prefix:{" "}
                <span className="text-slate-700">{[...unmatchedDistricts].slice(0, 16).join(", ")}{unmatchedDistricts.size > 16 ? "…" : ""}</span>.
              </p>
            )}
          </Foldout>

          <Foldout summary={`District landing page health — ${districtPages.length} pages, ${publishedCount} published`}>
            {districtDbError ? (
              <Muted>District page data unavailable — check the function logs for <code>/admin/seo/ops</code> and reload.</Muted>
            ) : districtPages.length === 0 ? (
              <Muted>No district landing pages yet. They are created when a campaign draft is published for a covered district.</Muted>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
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
                      const sourceLabel = p.contentSource === "manual_override" ? "Manual" : p.contentSource === "needs_refresh" ? "Needs refresh" : "AI";
                      const sourceCls = p.contentSource === "manual_override" ? "bg-violet-100 text-violet-700" : p.contentSource === "needs_refresh" ? "bg-red-100 text-red-700" : "bg-sky-100 text-sky-700";
                      return (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-mono font-semibold text-slate-900">{p.district}</td>
                          <td className="px-3 py-2 text-slate-600">{p.anchorTown ?? "—"}</td>
                          <td className="px-3 py-2 text-center">{p.isPublished ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" /> : <span className="inline-block w-4 h-4 rounded-full bg-slate-200" />}</td>
                          <td className="px-3 py-2 text-center">{coverageDbError ? <span className="text-slate-300">—</span> : hasSupply ? <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" /> : <AlertTriangle className="w-4 h-4 text-amber-500 inline" />}</td>
                          <td className="px-3 py-2"><span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${sourceCls}`}>{sourceLabel}</span></td>
                          <td className={`px-3 py-2 text-right tabular-nums ${isStale ? "text-amber-600 font-medium" : "text-slate-500"}`}>{ageDays === null ? "—" : ageDays === 0 ? "today" : `${ageDays}d`}{isStale && " ⚠"}</td>
                          <td className="px-3 py-2 text-center"><a href={`/locksmith-in/${p.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-amber-700 hover:text-amber-800"><ExternalLink className="w-3.5 h-3.5" /></a></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Foldout>

          <Foldout summary={`Programmatic matrices — Intent × City (${intentPages * cityCount}) and Service × City (${serviceCount * cityCount})`}>
            <div className="space-y-8">
              <MatrixTable caption="Intent × City" rows={landings.map((l) => ({ key: l.slug, label: l.title, href: (c: string) => `/intent/${l.slug}/in/${c}` }))} cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} cellClass="bg-emerald-100 hover:bg-emerald-200" />
              <MatrixTable caption="Service × City" rows={SERVICE_CATALOG.map((s) => ({ key: s.id, label: s.title, href: (c: string) => `/services/${s.id}/in/${c}` }))} cities={cities.map((c) => ({ slug: c.slug, name: c.name }))} cellClass="bg-sky-100 hover:bg-sky-200" />
            </div>
          </Foldout>
        </div>
      </div>
    </AdminSidebar>
  );
}

// ── Presentational helpers ─────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon: Icon, accent }: {
  label: string; value: string; sub?: string;
  icon: React.ComponentType<{ className?: string }>; accent?: "amber" | "warn";
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

function GapCard({ tone, value, title, blurb, children }: {
  tone: "warn" | "ok"; value: number; title: string; blurb: string; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" ? "border-amber-200 bg-amber-50/50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-2 mb-0.5">
        {tone === "warn" ? <AlertTriangle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
        <span className={`text-2xl font-bold ${tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>{value}</span>
        <span className="text-sm font-semibold text-slate-900">{title}</span>
      </div>
      <p className="text-xs text-slate-500 mb-3">{blurb}</p>
      {value > 0 ? (
        <details className="group">
          <summary className="cursor-pointer select-none text-xs font-medium text-amber-700 hover:text-amber-800 inline-flex items-center gap-0.5">
            <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" /> Show list
          </summary>
          <div className="mt-2">{children}</div>
        </details>
      ) : <div>{children}</div>}
    </div>
  );
}

function MiniCard({ title, ok, okLabel, children }: {
  title: string; ok: boolean; okLabel: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900 mb-2">{title}</p>
      {ok ? <p className="text-sm text-emerald-700">{okLabel}</p> : <ul className="space-y-1">{children}</ul>}
    </div>
  );
}

function Foldout({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-slate-900 text-sm flex items-center gap-2">
        <ChevronRight className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-90" />
        {summary}
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>;
}

function MatrixTable({ caption, rows, cities, cellClass }: {
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
              {cities.map((c) => <th key={c.slug} className="text-center px-2 py-2 whitespace-nowrap">{c.name}</th>)}
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
