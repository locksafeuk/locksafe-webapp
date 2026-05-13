"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
  CheckCircle2,
  Info,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { AdminSidebar } from "@/components/layout/AdminSidebar";

interface ValueListItem {
  id: string;
  value: string;
  created: number;
}

interface ManagedList {
  alias: string;
  name: string;
  item_type: string;
  description: string;
  exists: boolean;
  id: string | null;
  items: ValueListItem[];
  itemCount: number;
}

interface RecommendedRule {
  id: string;
  action: string;
  predicate: string;
  label: string;
  description: string;
  dashboardOnly: boolean;
  priority: "high" | "medium" | "low";
}

interface RadarData {
  managedLists: ManagedList[];
  recommendedRules: RecommendedRule[];
  dashboardUrl: string;
}

const ACTION_COLOR: Record<string, string> = {
  block: "bg-red-100 text-red-700",
  review: "bg-amber-100 text-amber-700",
  allow: "bg-green-100 text-green-700",
};

const PRIORITY_COLOR: Record<string, string> = {
  high: "bg-red-50 border-red-200",
  medium: "bg-amber-50 border-amber-200",
  low: "bg-gray-50 border-gray-200",
};

export default function SecurityRadarPage() {
  const { toast, toasts, dismiss } = useToast();
  const [data, setData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Add item state
  const [addingTo, setAddingTo] = useState<string | null>(null); // list alias
  const [newValue, setNewValue] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/security/radar");
      const json = await res.json();
      if (json.success) setData(json);
      else toast({ title: "Error loading Radar data", description: json.error, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSyncLists = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/security/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_lists" }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Value lists synced", description: json.results.join(" · ") });
        fetchData();
      } else {
        toast({ title: "Error", description: json.error, variant: "error" });
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleAddItem = async (listAlias: string) => {
    if (!newValue.trim()) return;
    setAddingItem(true);
    try {
      const res = await fetch("/api/admin/security/radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_item", listAlias, value: newValue.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Item added" });
        setNewValue("");
        setAddingTo(null);
        fetchData();
      } else {
        toast({ title: "Error", description: json.error, variant: "error" });
      }
    } finally {
      setAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId: string, value: string) => {
    if (!confirm(`Remove "${value}" from the list?`)) return;
    const res = await fetch("/api/admin/security/radar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_item", itemId }),
    });
    const json = await res.json();
    if (json.success) {
      toast({ title: "Item removed" });
      fetchData();
    } else {
      toast({ title: "Error", description: json.error, variant: "error" });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <AdminSidebar>
    <div className="p-6 max-w-5xl mx-auto">
      <Toaster toasts={toasts} dismiss={dismiss} />

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" /> Stripe Radar
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage fraud prevention rules and blocklists
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-1.5"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </Button>
          <a
            href={data?.dashboardUrl ?? "https://dashboard.stripe.com/radar/rules"}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm" className="gap-1.5">
              <ExternalLink className="w-3.5 h-3.5" /> Stripe Dashboard
            </Button>
          </a>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : !data ? null : (
        <div className="space-y-8">

          {/* ── Recommended Rules ───────────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Recommended Rules</h2>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-blue-50 px-3 py-1.5 rounded-full">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                Copy predicates and add in the Stripe Dashboard
              </div>
            </div>

            <div className="space-y-3">
              {data.recommendedRules.map((rule) => (
                <div
                  key={rule.id}
                  className={`border rounded-xl p-4 ${PRIORITY_COLOR[rule.priority] ?? "bg-gray-50 border-gray-200"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${ACTION_COLOR[rule.action] ?? "bg-gray-100 text-gray-600"}`}
                        >
                          {rule.action}
                        </span>
                        <span className="font-medium text-gray-900 text-sm">{rule.label}</span>
                        {rule.priority === "high" && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">
                            High priority
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-white/70 border border-gray-200 px-2.5 py-1.5 rounded-lg font-mono text-gray-700 flex-1 truncate">
                          {rule.predicate}
                        </code>
                        <button
                          onClick={() => copyToClipboard(rule.predicate)}
                          className="text-gray-400 hover:text-gray-700 shrink-0"
                          title="Copy predicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <a
                      href="https://dashboard.stripe.com/radar/rules"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 whitespace-nowrap"
                    >
                      Add in Stripe <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Blocklists / Value Lists ─────────────────────────────────── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900">Blocklists</h2>
              <Button
                size="sm"
                onClick={handleSyncLists}
                disabled={syncing}
                className="gap-1.5"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Sync Lists to Stripe
              </Button>
            </div>

            {data.managedLists.every((l) => !l.exists) && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-800">No value lists set up yet</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Click &ldquo;Sync Lists to Stripe&rdquo; to create them in your Stripe account. Then add items below
                    and reference them in your Radar rules in the Stripe Dashboard.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {data.managedLists.map((list) => (
                <div key={list.alias} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {list.exists ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{list.name}</p>
                        <p className="text-xs text-gray-500">{list.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-0.5 rounded">
                        {list.item_type}
                      </span>
                      {list.exists && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setAddingTo(addingTo === list.alias ? null : list.alias);
                            setNewValue("");
                          }}
                        >
                          <Plus className="w-3 h-3" /> Add
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Add form */}
                  {addingTo === list.alias && (
                    <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
                      <Input
                        className="h-8 text-sm flex-1"
                        placeholder={
                          list.item_type === "card_fingerprint"
                            ? "Card fingerprint (from payment details)"
                            : list.item_type === "email"
                            ? "customer@example.com"
                            : "cus_XXXX..."
                        }
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddItem(list.alias);
                          if (e.key === "Escape") setAddingTo(null);
                        }}
                        autoFocus
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => handleAddItem(list.alias)}
                        disabled={addingItem || !newValue.trim()}
                      >
                        {addingItem ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add"}
                      </Button>
                      <button onClick={() => setAddingTo(null)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Items */}
                  {list.exists && list.items.length === 0 && (
                    <p className="px-5 py-3 text-sm text-gray-400">No items yet</p>
                  )}
                  {list.items.length > 0 && (
                    <ul className="divide-y divide-gray-50">
                      {list.items.map((item) => (
                        <li key={item.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-gray-50">
                          <span className="text-sm font-mono text-gray-700 truncate">{item.value}</span>
                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className="text-xs text-gray-400">
                              {new Date(item.created * 1000).toLocaleDateString()}
                            </span>
                            <button
                              onClick={() => handleRemoveItem(item.id, item.value)}
                              className="text-gray-300 hover:text-red-500 transition-colors"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {!list.exists && (
                    <p className="px-5 py-3 text-sm text-amber-600 italic">
                      Not created yet — sync to Stripe first
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── How to apply rules in Stripe ────────────────────────────── */}
          <section className="bg-blue-50 border border-blue-200 rounded-xl p-5">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" /> How to activate rules in Stripe
            </h3>
            <ol className="text-sm text-blue-800 space-y-1.5 list-decimal list-inside">
              <li>Click <strong>Sync Lists to Stripe</strong> above to create the value lists in your Stripe account</li>
              <li>Open the <strong>Stripe Dashboard → Radar → Rules</strong></li>
              <li>Click <strong>Add rule</strong> and paste one of the predicates from above</li>
              <li>Set the action (Block / Review / Allow) and save</li>
              <li>Add blocklist items here — they take effect immediately in Radar</li>
            </ol>
          </section>
        </div>
      )}
    </div>
    </AdminSidebar>
  );
}
