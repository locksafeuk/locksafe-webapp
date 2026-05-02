"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Save,
  Upload,
  Zap,
} from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";

interface ServiceItem {
  slug: string;
  defaults: {
    title: string;
    description: string;
    image_link: string;
    link: string;
    priceHint: string;
  };
  overrides: {
    imageUrl: string | null;
    customTitle: string | null;
    customDescription: string | null;
  };
  effective: {
    title: string;
    description: string;
    image_link: string;
    link: string;
  };
  sync: {
    metaProductId: string | null;
    lastSyncedAt: string | null;
    lastSyncStatus: string | null;
    lastSyncMessage: string | null;
  } | null;
}

interface CatalogConfig {
  id: string;
  catalogId: string;
  catalogName: string | null;
  isActive: boolean;
  lastFullSyncAt: string | null;
  lastFullSyncStatus: string | null;
  lastFullSyncMessage: string | null;
}

interface MetaCatalog {
  id: string;
  name: string;
  product_count?: number;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export function CatalogManager() {
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [config, setConfig] = useState<CatalogConfig | null>(null);
  const [catalogs, setCatalogs] = useState<MetaCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshingCatalogs, setRefreshingCatalogs] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(
    null,
  );
  const [catalogIdInput, setCatalogIdInput] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c] = await Promise.all([
        fetch("/api/admin/meta-catalog/services").then((r) => r.json()),
        fetch("/api/admin/meta-catalog/config").then((r) => r.json()),
      ]);
      if (s.success) setItems(s.items);
      if (c.success) {
        setConfig(c.config);
        if (c.config?.catalogId) setCatalogIdInput(c.config.catalogId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const refreshCatalogs = async () => {
    setRefreshingCatalogs(true);
    try {
      const res = await fetch("/api/admin/meta-catalog/catalogs").then((r) => r.json());
      if (res.success) setCatalogs(res.catalogs);
      else setGlobalNotice({ kind: "err", msg: res.error || "Failed to load catalogs" });
    } catch (err) {
      setGlobalNotice({ kind: "err", msg: (err as Error).message });
    } finally {
      setRefreshingCatalogs(false);
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    setGlobalNotice(null);
    try {
      const matched = catalogs.find((c) => c.id === catalogIdInput);
      const res = await fetch("/api/admin/meta-catalog/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogId: catalogIdInput, catalogName: matched?.name }),
      }).then((r) => r.json());
      if (res.success) {
        setConfig(res.config);
        setGlobalNotice({ kind: "ok", msg: "Catalog config saved." });
      } else {
        setGlobalNotice({ kind: "err", msg: res.error || "Failed to save" });
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const runFullSync = async () => {
    setSyncing(true);
    setGlobalNotice(null);
    try {
      const res = await fetch("/api/admin/meta-catalog/sync", { method: "POST" }).then((r) =>
        r.json(),
      );
      if (res.success) {
        setGlobalNotice({
          kind: "ok",
          msg: `Synced ${res.synced} items to Meta at ${new Date(res.syncedAt).toLocaleTimeString()}.`,
        });
        await loadAll();
      } else {
        setGlobalNotice({ kind: "err", msg: res.error || "Sync failed" });
      }
    } finally {
      setSyncing(false);
    }
  };

  return (
    <AdminSidebar>
      <div className="p-6 max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Meta Catalog</h1>
          <p className="text-slate-600 mt-1 text-sm">
            Service-intent catalog used by Facebook Dynamic Ads. Item ids ={" "}
            <code className="text-xs bg-slate-100 px-1 rounded">content_ids</code> in the Pixel — keep them
            in sync.
          </p>
          <div className="mt-3 text-sm">
            <Link
              href="/api/meta/catalog-feed"
              target="_blank"
              className="inline-flex items-center gap-1 text-orange-600 hover:underline"
            >
              View live CSV feed <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </header>

        {globalNotice && (
          <div
            className={`mb-4 rounded-lg p-3 text-sm flex items-start gap-2 ${
              globalNotice.kind === "ok"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {globalNotice.kind === "ok" ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5" />
            )}
            <div>{globalNotice.msg}</div>
          </div>
        )}

        {/* Catalog connection panel */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <h2 className="font-semibold text-slate-900 mb-3">Connected Catalog</h2>

          <div className="grid md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">
                Meta Catalog ID
              </label>
              <input
                value={catalogIdInput}
                onChange={(e) => setCatalogIdInput(e.target.value.trim())}
                placeholder="e.g. 1234567890123456"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono"
              />
              {config && (
                <div className="text-xs text-slate-500 mt-1">
                  Active: <span className="font-mono">{config.catalogId}</span>
                  {config.catalogName ? ` (${config.catalogName})` : ""}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={saveConfig}
                disabled={savingConfig || !catalogIdInput}
                className="btn-primary"
              >
                {savingConfig ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Save catalog ID
              </Button>
              <Button onClick={refreshCatalogs} variant="outline" disabled={refreshingCatalogs}>
                {refreshingCatalogs ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                List my catalogs
              </Button>
            </div>
          </div>

          {catalogs.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <div className="text-sm font-medium text-slate-700 mb-2">
                Catalogs in your Meta business
              </div>
              <ul className="grid sm:grid-cols-2 gap-2 text-sm">
                {catalogs.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between border border-slate-200 rounded-lg px-3 py-2"
                  >
                    <div>
                      <div className="font-medium text-slate-900">{c.name}</div>
                      <div className="text-xs font-mono text-slate-500">{c.id}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCatalogIdInput(c.id)}
                      className="text-xs text-orange-600 hover:underline"
                    >
                      Use this
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-4 border-t border-slate-100 pt-4 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm">
              <div className="font-medium text-slate-700">Last full sync</div>
              <div className="text-slate-500">
                {formatRelative(config?.lastFullSyncAt ?? null)}
                {config?.lastFullSyncStatus && (
                  <span
                    className={`ml-2 px-2 py-0.5 rounded text-xs ${
                      config.lastFullSyncStatus === "success"
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {config.lastFullSyncStatus}
                  </span>
                )}
              </div>
              {config?.lastFullSyncMessage && (
                <div className="text-xs text-slate-500 mt-1">{config.lastFullSyncMessage}</div>
              )}
            </div>
            <Button
              onClick={runFullSync}
              disabled={syncing || !config}
              className="btn-primary"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Sync all to Meta
            </Button>
          </div>
        </section>

        {/* Services grid */}
        <section>
          <h2 className="font-semibold text-slate-900 mb-3">Catalog Items</h2>
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {items.map((item) => (
                <ServiceCard key={item.slug} item={item} onChanged={loadAll} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AdminSidebar>
  );
}

// ---------------------------------------------------------------------------

function ServiceCard({ item, onChanged }: { item: ServiceItem; onChanged: () => void }) {
  const [title, setTitle] = useState(item.overrides.customTitle ?? "");
  const [desc, setDesc] = useState(item.overrides.customDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const dirty =
    (title || "") !== (item.overrides.customTitle ?? "") ||
    (desc || "") !== (item.overrides.customDescription ?? "");

  const saveText = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/meta-catalog/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: item.slug,
          customTitle: title.trim() || null,
          customDescription: desc.trim() || null,
        }),
      }).then((r) => r.json());
      if (res.success) {
        setNotice({ kind: "ok", msg: "Saved." });
        onChanged();
      } else {
        setNotice({ kind: "err", msg: res.error || "Save failed" });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", item.slug);
      const res = await fetch("/api/admin/meta-catalog/upload", {
        method: "POST",
        body: fd,
      }).then((r) => r.json());
      if (res.success) {
        setNotice({ kind: "ok", msg: "Image updated." });
        onChanged();
      } else {
        setNotice({ kind: "err", msg: res.error || "Upload failed" });
      }
    } finally {
      setUploading(false);
    }
  };

  const clearImage = async () => {
    setUploading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/meta-catalog/services", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.slug, imageUrl: null }),
      }).then((r) => r.json());
      if (res.success) {
        setNotice({ kind: "ok", msg: "Reverted to default image." });
        onChanged();
      } else {
        setNotice({ kind: "err", msg: res.error || "Failed" });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex">
        <div className="w-32 h-32 bg-slate-100 relative flex-shrink-0">
          {/* Use a plain <img> so we can render Vercel Blob + same-origin OG without next/image config. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.effective.image_link}
            alt={item.effective.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-3 flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-500 truncate">{item.slug}</div>
              <div className="font-semibold text-slate-900 truncate">{item.effective.title}</div>
            </div>
            {item.sync?.lastSyncStatus === "success" ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700 whitespace-nowrap">
                synced
              </span>
            ) : item.sync?.lastSyncStatus === "error" ? (
              <span className="text-[10px] px-2 py-0.5 rounded bg-red-100 text-red-700 whitespace-nowrap">
                error
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 whitespace-nowrap">
                not synced
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{item.effective.description}</p>
          <div className="text-[11px] text-slate-400 mt-1">
            Last sync: {formatRelative(item.sync?.lastSyncedAt ?? null)}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 p-3 space-y-3">
        {/* Image controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {item.overrides.imageUrl ? "Replace image" : "Upload image"}
          </Button>
          {item.overrides.imageUrl && (
            <Button size="sm" variant="ghost" onClick={clearImage} disabled={uploading}>
              Use default
            </Button>
          )}
          <Link
            href={item.effective.link}
            target="_blank"
            className="text-xs text-slate-500 hover:underline ml-auto inline-flex items-center gap-1"
          >
            Landing page <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {/* Text overrides */}
        <div className="grid gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Title override (default: ${item.defaults.title})`}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm"
          />
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Description override (leave blank for default)"
            rows={2}
            className="w-full border border-slate-200 rounded px-2 py-1.5 text-sm resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            {notice ? (
              <span
                className={`text-xs ${
                  notice.kind === "ok" ? "text-green-700" : "text-red-700"
                }`}
              >
                {notice.msg}
              </span>
            ) : (
              <span className="text-xs text-slate-400">
                {dirty ? "Unsaved changes" : "Up to date"}
              </span>
            )}
            <Button size="sm" onClick={saveText} disabled={saving || !dirty}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save text
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
