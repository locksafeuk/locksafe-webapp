import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Activity, ExternalLink } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { loadAllIntentLandings } from "@/lib/intent-landings-store";
import { ukCitiesData } from "@/lib/uk-cities-data";
import { SERVICE_CATALOG } from "@/lib/services-catalog";
import { postcodeData } from "@/lib/postcode-data";

export const metadata: Metadata = {
  title: "Coverage matrix",
};

const POSTCODE_PILLAR_SERVICES = [
  "emergency-locksmith",
  "lock-change",
  "burglary-repair",
  "auto-locksmith",
  "commercial-locksmith",
] as const;

export default async function AdminSeoCoveragePage() {
  const landings = await loadAllIntentLandings();
  const cities = Object.values(ukCitiesData);
  const totalCells =
    landings.length * cities.length +
    SERVICE_CATALOG.length * cities.length +
    cities.reduce((n, c) => n + c.areas.length, 0) +
    Object.keys(postcodeData).length * POSTCODE_PILLAR_SERVICES.length;

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
                        href={`/locksmith-${c.slug}`}
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
      </div>
    </AdminSidebar>
  );
}
