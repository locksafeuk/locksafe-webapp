import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, ExternalLink, Plus, Pencil, Tag } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  loadAllKeywordTemplates,
  citiesForTemplate,
} from "@/lib/keyword-templates-store";
import { prisma } from "@/lib/db";
import { ukCitiesData } from "@/lib/uk-cities-data";

export const metadata: Metadata = {
  title: "Keyword landings",
};

export const dynamic = "force-dynamic";

export default async function AdminKeywordsPage() {
  const templates = await loadAllKeywordTemplates();
  // The "DB vs static" badge is a nicety — if the DB read fails, still render
  // the (static-seed-backed) list rather than crashing the whole page.
  let dbRows: Array<{ slug: string }> = [];
  try {
    dbRows = await prisma.keywordTemplate.findMany({ select: { slug: true } });
  } catch (err) {
    console.error(
      "[admin/seo/keywords] DB query failed, showing static seed only:",
      err instanceof Error ? err.message : err,
    );
  }
  const dbSlugs = new Set(dbRows.map((r) => r.slug));
  const totalCities = Object.keys(ukCitiesData).length;
  const totalPages = templates
    .filter((t) => t.isActive !== false)
    .reduce((n, t) => n + citiesForTemplate(t).length, 0);

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/seo"
              className="text-sm text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Intent SEO
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-7 h-7 text-amber-500" />
              Keyword landings
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              {templates.length} keyword templates → <span className="font-semibold">{totalPages.toLocaleString()}</span> live pages
              across {totalCities} UK cities. {dbSlugs.size} DB-edited, {templates.length - dbSlugs.size} from static seed.
            </p>
          </div>
          <Link
            href="/admin/seo/keywords/new"
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            New keyword
          </Link>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 text-sm text-amber-900">
          <p className="font-semibold mb-1">How it works</p>
          <p>
            Each keyword template generates one landing page per UK city at{" "}
            <code>/{"{keyword}-in-{city}"}</code> — e.g.{" "}
            <code>/locksmith-near-me-in-london</code>. Use tokens like{" "}
            <code>{"{city}"}</code>, <code>{"{response}"}</code>, <code>{"{areas}"}</code>{" "}
            inside the content; they're replaced per city at render time.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Keyword</th>
                <th className="text-left px-4 py-3">Pillar</th>
                <th className="text-center px-4 py-3">Cities</th>
                <th className="text-center px-4 py-3">Pages</th>
                <th className="text-center px-4 py-3">FAQs</th>
                <th className="text-center px-4 py-3">Source</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templates.map((t) => {
                const pageCount = citiesForTemplate(t).length;
                const sampleCitySlug = citiesForTemplate(t)[0];
                return (
                  <tr key={t.slug}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{t.label}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{t.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      {t.pillarKeyword ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                          <Tag className="w-3 h-3" />
                          {t.pillarKeyword}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">
                      {t.citiesMode === "all" ? (
                        <span>All ({totalCities})</span>
                      ) : (
                        <span>{t.selectedCities.length} selected</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-900">
                      {pageCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-700">
                      {t.content.faqs?.length ?? 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {dbSlugs.has(t.slug) ? (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          DB
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                          Static
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {t.isActive !== false ? (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          Live
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          Draft
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-3">
                        <Link
                          href={`/admin/seo/keywords/${t.slug}/edit`}
                          className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </Link>
                        {sampleCitySlug && (
                          <a
                            href={`/${t.slug}-in-${sampleCitySlug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                          >
                            Sample <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AdminSidebar>
  );
}
