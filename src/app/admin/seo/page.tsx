import type { Metadata } from "next";
import Link from "next/link";
import {
  Map,
  Activity,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Globe,
  Layers,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { loadActiveIntentLandings, loadAllIntentLandings } from "@/lib/intent-landings-store";
import {
  loadActiveKeywordTemplates,
  loadAllKeywordTemplates,
  citiesForTemplate,
} from "@/lib/keyword-templates-store";
import { INTENTS, PILLAR_KEYWORDS } from "@/lib/intents-catalog";
import { ukCitiesData } from "@/lib/uk-cities-data";
import { postcodeData } from "@/lib/postcode-data";
import { SERVICE_CATALOG } from "@/lib/services-catalog";

export const metadata: Metadata = {
  title: "Intent SEO",
};

const POSTCODE_PILLAR_COUNT = 5; // mirrors /locksmith-area/[slug]/[service] generator

export default async function AdminSeoPage() {
  const active = await loadActiveIntentLandings();
  const all = await loadAllIntentLandings();
  const activeKeywords = await loadActiveKeywordTemplates();
  const allKeywords = await loadAllKeywordTemplates();
  const keywordPages = activeKeywords.reduce(
    (n, t) => n + citiesForTemplate(t).length,
    0,
  );
  const cityCount = Object.keys(ukCitiesData).length;
  const serviceCount = SERVICE_CATALOG.length;
  const postcodeCount = Object.keys(postcodeData).length;
  const totalAreas = Object.values(ukCitiesData).reduce((n, c) => n + c.areas.length, 0);

  const intentPages = active.length;
  const intentGeoPages = active.length * cityCount;
  const serviceGeoPages = serviceCount * cityCount;
  const cityAreaPages = totalAreas;
  const postcodeServicePages = postcodeCount * POSTCODE_PILLAR_COUNT;
  const totalPages =
    intentPages + intentGeoPages + serviceGeoPages + cityAreaPages + postcodeServicePages + keywordPages;

  // Pillar coverage
  const pillarStats = PILLAR_KEYWORDS.map((pk) => ({
    pillar: pk,
    intents: INTENTS.filter((i) => i.pillarKeyword === pk).length,
    landings: active.filter((l) => l.pillarKeyword === pk).length,
  }));

  // Landings missing for catalogued intents
  const missingLandings = INTENTS.filter(
    (i) => !active.some((l) => l.slug === i.slug),
  );

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
            <Map className="w-7 h-7 text-amber-500" />
            Intent SEO
          </h1>
          <p className="text-slate-600 mt-1 text-sm">
            Programmatic intent / geo / pillar coverage. Data is sourced from static TypeScript
            files — edit those to add intents or cities, then redeploy.
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
          <KpiCard label="Total SSG pages" value={totalPages.toLocaleString()} icon={Layers} accent="amber" />
          <KpiCard label="Intent landings" value={`${intentPages} active`} sub={`${all.length} total`} icon={FileText} />
          <KpiCard label="Keyword landings" value={keywordPages.toLocaleString()} sub={`${activeKeywords.length}/${allKeywords.length} templates`} icon={FileText} />
          <KpiCard label="Intent × city" value={intentGeoPages.toLocaleString()} icon={Globe} />
          <KpiCard label="Service × city" value={serviceGeoPages.toLocaleString()} icon={Globe} />
          <KpiCard label="Postcode × service" value={postcodeServicePages.toLocaleString()} sub={`${postcodeCount} postcodes`} icon={Globe} />
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
          <Link
            href="/admin/seo/intents"
            className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-4"
          >
            <FileText className="w-5 h-5 text-amber-500 mb-2" />
            <p className="font-semibold text-slate-900 text-sm">Intent landings</p>
            <p className="text-xs text-slate-500 mt-0.5">Preview, copy, A/B status</p>
          </Link>
          <Link
            href="/admin/seo/keywords"
            className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-4"
          >
            <FileText className="w-5 h-5 text-amber-500 mb-2" />
            <p className="font-semibold text-slate-900 text-sm">Keyword landings</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {keywordPages.toLocaleString()} pages — /[keyword]-in-[city]
            </p>
          </Link>
          <Link
            href="/admin/seo/coverage"
            className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-4"
          >
            <Activity className="w-5 h-5 text-amber-500 mb-2" />
            <p className="font-semibold text-slate-900 text-sm">Live Ops</p>
            <p className="text-xs text-slate-500 mt-0.5">Pages vs supply — gaps &amp; health</p>
          </Link>
          <a
            href="/sitemap.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-4"
          >
            <ExternalLink className="w-5 h-5 text-amber-500 mb-2" />
            <p className="font-semibold text-slate-900 text-sm">Open sitemap.xml</p>
            <p className="text-xs text-slate-500 mt-0.5">Live URL list (new tab)</p>
          </a>
          <a
            href="/intent"
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm transition-all p-4"
          >
            <ExternalLink className="w-5 h-5 text-amber-500 mb-2" />
            <p className="font-semibold text-slate-900 text-sm">Public intent index</p>
            <p className="text-xs text-slate-500 mt-0.5">/intent — customer-facing</p>
          </a>
        </div>

        {/* Pillar keyword coverage */}
        <section className="mb-10">
          <h2 className="text-lg font-bold text-slate-900 mb-3">Pillar keyword coverage</h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="text-left px-4 py-3">Pillar</th>
                  <th className="text-right px-4 py-3">Intents catalogued</th>
                  <th className="text-right px-4 py-3">Landings live</th>
                  <th className="text-center px-4 py-3">Priority boost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pillarStats.map((row) => (
                  <tr key={row.pillar}>
                    <td className="px-4 py-3 font-medium text-slate-900">{row.pillar}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.intents}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{row.landings}</td>
                    <td className="px-4 py-3 text-center">
                      {row.landings >= 2 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> 0.9
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                          0.8
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Pillars with ≥2 active landings get sitemap priority bumped to <code className="text-amber-700">0.9</code>.
          </p>
        </section>

        {/* Missing landings */}
        {missingLandings.length > 0 && (
          <section className="mb-10">
            <h2 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Intents catalogued but missing landing content
            </h2>
            <p className="text-sm text-slate-600 mb-3">
              These intents are declared in <code className="text-amber-700">src/lib/intents-catalog.ts</code> but
              don't have a full content record yet in <code className="text-amber-700">src/lib/intent-landings.ts</code>.
              They won't generate a page until added.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {missingLandings.map((intent) => (
                <div
                  key={intent.slug}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"
                >
                  <p className="font-medium text-slate-900">{intent.title}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    {intent.pillarKeyword} · {intent.urgency}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">{intent.slug}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* How to edit */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h2 className="text-base font-bold text-slate-900 mb-2">How content is edited</h2>
          <p className="text-sm text-slate-700 mb-3">
            Intent SEO is implemented as <strong>static TypeScript</strong> for build-time generation
            (faster, no DB cost, lower attack surface). To change copy or add a scenario, edit the
            corresponding file and redeploy:
          </p>
          <ul className="text-sm text-slate-700 space-y-1.5">
            <li>
              <code className="text-amber-700">src/lib/intent-landings.ts</code> — full intent content (H1, FAQs, blocks, SEO copy)
            </li>
            <li>
              <code className="text-amber-700">src/lib/intents-catalog.ts</code> — short intent index + pillar keywords
            </li>
            <li>
              <code className="text-amber-700">src/lib/uk-cities-data.ts</code> — cities, areas, postcodes
            </li>
            <li>
              <code className="text-amber-700">src/lib/services-catalog.ts</code> — services + extended content
            </li>
            <li>
              <code className="text-amber-700">src/lib/postcode-data.ts</code> — UK postcode landing data
            </li>
          </ul>
          <p className="text-xs text-slate-500 mt-3">
            After a redeploy, every URL group below regenerates automatically — including
            JSON-LD (FAQ, Service, LocalBusiness, HowTo, Speakable), the sitemap, and A/B
            variant cookies.
          </p>
        </section>
      </div>
    </AdminSidebar>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "amber";
}) {
  return (
    <div
      className={[
        "rounded-xl border bg-white p-4",
        accent === "amber" ? "border-amber-300 ring-1 ring-amber-100" : "border-slate-200",
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-500">{label}</p>
        <Icon className={accent === "amber" ? "w-4 h-4 text-amber-500" : "w-4 h-4 text-slate-400"} />
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}
