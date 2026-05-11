import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Tag, FileText } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  INTENT_LANDINGS,
  getIntentLandingBySlug,
} from "@/lib/intent-landings";
import { ukCitiesData } from "@/lib/uk-cities-data";

export const metadata: Metadata = {
  title: "Intent landings",
};

export default function AdminIntentsListPage() {
  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
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
            {INTENT_LANDINGS.length} landings — preview, inspect blocks, see A/B status.
          </p>
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
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {INTENT_LANDINGS.map((l) => (
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
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/admin/seo/intents/${l.slug}`}
                        className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                      >
                        Inspect
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
