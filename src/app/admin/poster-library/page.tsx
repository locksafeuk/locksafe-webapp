"use client";

import { useEffect, useState, useCallback } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RefreshCw, ImageIcon } from "lucide-react";

interface Asset {
  id: string;
  url: string;
  theme: string | null;
  model: string | null;
  visionReason: string | null;
  createdAt: string;
  status: string;
}

const TABS = ["PENDING_REVIEW", "APPROVED", "REJECTED", "USED"] as const;
const TAB_LABEL: Record<string, string> = {
  PENDING_REVIEW: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  USED: "Used",
};

export default function PosterLibraryPage() {
  const [tab, setTab] = useState<string>("PENDING_REVIEW");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/poster-library?status=${status}`, { cache: "no-store" });
      const d = await r.json();
      if (d.success) {
        setAssets(d.assets || []);
        setCounts(d.counts || {});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  async function review(id: string, action: "approve" | "reject") {
    setBusy(id);
    try {
      await fetch("/api/admin/poster-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      setAssets((prev) => prev.filter((a) => a.id !== id));
      setCounts((c) => ({
        ...c,
        [tab]: Math.max(0, (c[tab] || 1) - 1),
        [action === "approve" ? "APPROVED" : "REJECTED"]: (c[action === "approve" ? "APPROVED" : "REJECTED"] || 0) + 1,
      }));
    } finally {
      setBusy(null);
    }
  }

  return (
    <AdminSidebar>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-slate-900">Poster Library</h1>
          <Button variant="outline" size="sm" onClick={() => load(tab)}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
        <p className="text-slate-500 mb-6 max-w-2xl">
          Pre-generated, text-free background images from Draw Things. Approve the keepers — the
          posting agent only uses <span className="font-medium">approved</span> backgrounds and
          overlays the proofread headline/brand on top. Generation runs on the Mac runner.
        </p>

        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              {TAB_LABEL[t]} <span className="opacity-60">({counts[t] ?? 0})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-slate-400 py-20 text-center">Loading…</div>
        ) : assets.length === 0 ? (
          <div className="text-slate-400 py-20 text-center flex flex-col items-center gap-3">
            <ImageIcon className="w-10 h-10" />
            <span>No {TAB_LABEL[tab].toLowerCase()} assets yet.</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {assets.map((a) => (
              <div key={a.id} className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.theme || "poster"} className="w-full aspect-[4/5] object-cover bg-slate-100" />
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">{a.theme || "—"}</span>
                    <span className="text-[10px] text-slate-400">{a.model}</span>
                  </div>
                  {a.visionReason && (
                    <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{a.visionReason}</p>
                  )}
                  {tab === "PENDING_REVIEW" && (
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        disabled={busy === a.id}
                        onClick={() => review(a.id, "approve")}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        disabled={busy === a.id}
                        onClick={() => review(a.id, "reject")}
                      >
                        <XCircle className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}
