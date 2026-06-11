import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Tag, FileText, Plus, Pencil } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { loadAllIntentLandings } from "@/lib/intent-landings-store";
import { prisma } from "@/lib/db";
import { ukCitiesData } from "@/lib/uk-cities-data";

export const metadata: Metadata = {
  title: "Intent landings",
};

export const dynamic = "force-dynamic";

export default async function AdminIntentsListPage() {
  const landings = await loadAllIntentLandings();
  // The "DB vs static" badge is a nicety — if the DB read fails, still render
  // the (static-seed-backed) list rather than crashing the whole page.
  let dbRows: Array<{ slug: string }> = [];
  try {
    dbRows = await prisma.intentLanding.findMany({ select: { slug: true } });
  } catch (err) {
    console.error(
      "[admin/seo/intents] DB query failed, showing static seed only:",
      err instanceof Error ? err.message : err,
    );
  }
  const dbSlugs = new Set(dbRows.map((r) => r.slug));

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
              <FileText className="w-7 h-7 text-amber-500" />
              Intent landings
            </h1>
            <p className="text-slate-600 mt-1 text-sm">
              {landings.length} landings — {dbSlugs.size} DB-edited, {landings.length - dbSlugs.size} from static seed.
            </p>
          </div>
          <Link
            href="/admin/seo/intents/new"
            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            New landing
          </Link>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-3">Title</th>
                <th className="text-left px-4 py-3">Pillar</th>
                <th className="text-center px-4 py-3">FAQs</th>
                <th className="text-center px-4 py-3">Segments</th>
                <th className="text-center px-4 py-3">A/B</th>
                <th className="text-center px-4 py-3">Source</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {landings.map((l) => (
                <tr key={l.slug}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{l.title}</p>
                    <p className="text-[11px] text-slate-500 font-mono">{l.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {l.pillarKeyword ? (
                      <span className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
                        <Tag className="w-3 h-3" />
                        {l.pillarKeyword}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-700">{l.faqs.length}</td>
                  <td className="px-4 py-3 text-center text-slate-700">
                    {l.blocks.segments.length}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {l.emotionalHookB ? (
                      <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                        Off
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {dbSlugs.has(l.slug) ? (
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
                    {l.isActive !== false ? (
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
                        href={`/admin/seo/intents/${l.slug}`}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                      >
                        Inspect
                      </Link>
                      <Link
                        href={`/admin/seo/intents/${l.slug}/edit`}
                        className="text-xs text-amber-700 hover:text-amber-800 font-medium inline-flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        Edit
                      </Link>
                      <a
                        href={`/intent/${l.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 mt-3">
          Each landing also generates {Object.keys(ukCitiesData).length} geo-localised pages
          at <code className="text-amber-700">/intent/[slug]/in/[city]</code>.
        </p>
      </div>
    </AdminSidebar>
  );
}
