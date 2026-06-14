"use client";

import { useCallback, useRef, useState } from "react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Play, Pause, Download, MessageSquare, Mail, Tag, CheckCircle2 } from "lucide-react";
import { lookupUkCity, UK_CITY_NAMES, UK_COUNTY_NAMES } from "@/lib/uk-locations";

type Criteria = { keyword: string; city: string; area: string; postcode: string; radiusMiles: string; country: string };
type Config = { maxResults: number; fields: Record<string, boolean> };
type Progress = { status: string; discovered: number; extracted: number; skipped: number; done: boolean };
type Lead = {
  id: string; name: string; contactPerson?: string | null; email?: string | null; phone?: string | null;
  website?: string | null; city: string; rating: number; reviewCount: number; status: string;
};

const FIELD_OPTS = [
  ["phone", "Phone numbers"], ["email", "Emails (when available)"], ["website", "Website URLs"],
  ["rating", "Google rating"], ["reviewCount", "Review count"], ["mapsUrl", "Google Maps URL"],
  ["category", "Business category"], ["address", "Address"],
] as const;

const STEPS = ["Search", "Configure", "Scrape", "Review", "Outreach", "Report"];

export default function ManualScrapePage() {
  const [step, setStep] = useState(0);
  const [criteria, setCriteria] = useState<Criteria>({ keyword: "", city: "", area: "", postcode: "", radiusMiles: "", country: "uk" });
  // Tracks values we auto-filled from the city lookup, so we update them when
  // the city changes but never clobber a value the user typed themselves.
  const autoFilled = useRef<{ area: string; postcode: string }>({ area: "", postcode: "" });
  const onCityChange = (value: string) => {
    setCriteria((prev) => {
      const next = { ...prev, city: value };
      const hit = lookupUkCity(value);
      if (hit) {
        if (!prev.area || prev.area === autoFilled.current.area) next.area = hit.county;
        if (!prev.postcode || prev.postcode === autoFilled.current.postcode) next.postcode = hit.pc;
        autoFilled.current = { area: next.area, postcode: next.postcode };
      }
      return next;
    });
  };
  const [config, setConfig] = useState<Config>({ maxResults: 100, fields: Object.fromEntries(FIELD_OPTS.map(([k]) => [k, true])) as Record<string, boolean> });
  const [estimate, setEstimate] = useState<string | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Progress>({ status: "idle", discovered: 0, extracted: 0, skipped: 0, done: false });
  const pausedRef = useRef(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("createdAt");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 4000); };

  const doEstimate = useCallback(async () => {
    setEstimating(true); setEstimate(null);
    try {
      const r = await fetch("/api/admin/manual-scrape/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(criteria) });
      const j = await r.json();
      setEstimate(r.ok ? `${j.estimate} businesses (first page: ${j.firstPageCount})` : (j.error || "Estimate failed"));
    } catch { setEstimate("Estimate failed"); } finally { setEstimating(false); }
  }, [criteria]);

  const startScrape = useCallback(async () => {
    setStep(2);
    setProgress({ status: "running", discovered: 0, extracted: 0, skipped: 0, done: false });
    pausedRef.current = false;
    const fields = Object.entries(config.fields).filter(([, v]) => v).map(([k]) => k);
    const r = await fetch("/api/admin/manual-scrape/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...criteria, maxResults: config.maxResults, fields }) });
    const j = await r.json();
    if (!r.ok) { flash(j.error || "Could not start"); return; }
    setBatchId(j.batchId);
    runLoop(j.batchId);
  }, [criteria, config]);

  const runLoop = useCallback(async (id: string) => {
    while (!pausedRef.current) {
      const r = await fetch("/api/admin/manual-scrape/process", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ batchId: id }) });
      const j = await r.json();
      if (!r.ok) { flash(j.error || "Scrape error"); break; }
      setProgress({ status: j.status, discovered: j.discovered, extracted: j.extracted, skipped: j.skipped, done: j.done });
      if (j.done || j.status === "paused") break;
      await new Promise((res) => setTimeout(res, 600));
    }
  }, []);

  const pause = async () => { pausedRef.current = true; if (batchId) await fetch(`/api/admin/manual-scrape/${batchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "pause" }) }); setProgress((p) => ({ ...p, status: "paused" })); };
  const resume = async () => { if (!batchId) return; pausedRef.current = false; await fetch(`/api/admin/manual-scrape/${batchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resume" }) }); setProgress((p) => ({ ...p, status: "running" })); runLoop(batchId); };

  const loadLeads = useCallback(async () => {
    if (!batchId) return;
    const p = new URLSearchParams({ q, status: statusFilter, sort, order: "desc", pageSize: "200" });
    const r = await fetch(`/api/admin/manual-scrape/${batchId}/leads?${p}`, { cache: "no-store" });
    const j = await r.json();
    if (r.ok) { setLeads(j.leads); setTotal(j.total); }
  }, [batchId, q, statusFilter, sort]);

  const outreach = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!batchId) return;
    setBusy(action);
    const leadIds = selected.size ? [...selected] : undefined;
    try {
      if (action === "export_csv") {
        const r = await fetch(`/api/admin/manual-scrape/${batchId}/outreach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, leadIds }) });
        const blob = await r.blob(); const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `leads-${batchId}.csv`; a.click(); URL.revokeObjectURL(url);
        flash("CSV downloaded"); return;
      }
      const r = await fetch(`/api/admin/manual-scrape/${batchId}/outreach`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, leadIds, ...extra }) });
      const j = await r.json();
      flash(r.ok ? `Done: ${JSON.stringify(j)}` : (j.error || "Failed"));
      loadLeads();
    } finally { setBusy(null); }
  };

  const loadReport = useCallback(async () => {
    if (!batchId) return;
    const r = await fetch(`/api/admin/manual-scrape/${batchId}/report`, { cache: "no-store" });
    if (r.ok) setReport(await r.json());
  }, [batchId]);

  const pct = config.maxResults ? Math.min(100, Math.round((progress.extracted / config.maxResults) * 100)) : 0;
  const toggleSel = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <AdminSidebar>
      <div className="p-4 md:p-6 max-w-6xl">
        <h1 className="text-2xl font-bold text-slate-900">Manual Lead Scraper</h1>
        <p className="text-sm text-slate-600 mb-5">Keyword → leads → outreach, in a few minutes.</p>

        {/* Stepper */}
        <div className="mb-6 flex flex-wrap gap-2">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i <= step && setStep(i)} className={`rounded-full px-3 py-1 text-xs font-medium ${i === step ? "bg-orange-500 text-white" : i < step ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400"}`}>{i + 1}. {s}</button>
          ))}
        </div>

        {toast && <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">{toast}</div>}

        {/* STEP 1 — Search */}
        {step === 0 && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Business keyword *"><Input value={criteria.keyword} placeholder="locksmith, emergency locksmith…" onChange={(e) => setCriteria({ ...criteria, keyword: e.target.value })} /></Field>
              <Field label="City"><Input list="uk-cities" value={criteria.city} placeholder="Birmingham" onChange={(e) => onCityChange(e.target.value)} /></Field>
              <Field label="Area / County"><Input list="uk-counties" value={criteria.area} placeholder="West Midlands" onChange={(e) => setCriteria({ ...criteria, area: e.target.value })} /></Field>
              <Field label="Postcode (optional)"><Input value={criteria.postcode} placeholder="B1" onChange={(e) => setCriteria({ ...criteria, postcode: e.target.value })} /></Field>
              <Field label="Radius (miles, optional)"><Input value={criteria.radiusMiles} placeholder="10" onChange={(e) => setCriteria({ ...criteria, radiusMiles: e.target.value })} /></Field>
              <Field label="Country"><Input value={criteria.country} onChange={(e) => setCriteria({ ...criteria, country: e.target.value })} /></Field>
              <datalist id="uk-cities">{UK_CITY_NAMES.map((c) => <option key={c} value={c} />)}</datalist>
              <datalist id="uk-counties">{UK_COUNTY_NAMES.map((c) => <option key={c} value={c} />)}</datalist>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={doEstimate} disabled={!criteria.keyword || estimating} className="gap-2">{estimating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Estimate</Button>
              {estimate && <span className="text-sm text-slate-600">≈ {estimate}</span>}
              <Button className="ml-auto" disabled={!criteria.keyword} onClick={() => setStep(1)}>Next →</Button>
            </div>
          </div>
        )}

        {/* STEP 2 — Configure */}
        {step === 1 && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <Field label="Maximum businesses to scrape"><Input type="number" value={config.maxResults} onChange={(e) => setConfig({ ...config, maxResults: Math.max(1, Math.min(500, Number(e.target.value) || 0)) })} className="w-40" /></Field>
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">Fields to capture</div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {FIELD_OPTS.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={config.fields[k]} onChange={(e) => setConfig({ ...config, fields: { ...config.fields, [k]: e.target.checked } })} />{label}
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <b>Summary:</b> “{criteria.keyword}” in {[criteria.postcode, criteria.city, criteria.area].filter(Boolean).join(", ") || "all areas"} · up to {config.maxResults} businesses.
            </div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(0)}>← Back</Button><Button className="ml-auto gap-2" onClick={startScrape}><Play className="h-4 w-4" />Start scraping</Button></div>
          </div>
        )}

        {/* STEP 3 — Scrape progress */}
        {step === 2 && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-slate-700">Status: <Badge className={progress.status === "completed" ? "bg-green-100 text-green-700" : progress.status === "paused" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}>{progress.status}</Badge></div>
              <div className="flex gap-2">
                {progress.status === "running" && <Button size="sm" variant="outline" onClick={pause} className="gap-1"><Pause className="h-3 w-3" />Pause</Button>}
                {progress.status === "paused" && <Button size="sm" variant="outline" onClick={resume} className="gap-1"><Play className="h-3 w-3" />Resume</Button>}
              </div>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-orange-500 transition-all" style={{ width: `${pct}%` }} /></div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Discovered" value={progress.discovered} /><Stat label="Extracted" value={progress.extracted} /><Stat label="Skipped" value={progress.skipped} />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button className="ml-auto" disabled={progress.extracted === 0} onClick={() => { setStep(3); loadLeads(); }}>Review {progress.extracted} leads →</Button>
            </div>
          </div>
        )}

        {/* STEP 4 — Review */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
              <Input value={q} placeholder="Search name / phone / website…" onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm"><option value="all">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="replied">Replied</option><option value="onboarded">Onboarded</option></select>
              <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-md border border-slate-200 px-2 py-1 text-sm"><option value="createdAt">Newest</option><option value="rating">Rating</option><option value="reviewCount">Reviews</option><option value="name">Name</option></select>
              <Button size="sm" variant="outline" onClick={loadLeads}>Apply</Button>
              <span className="ml-auto text-xs text-slate-500">{selected.size} selected · {total} total</span>
              <Button size="sm" onClick={() => setStep(4)} disabled={!leads.length}>Outreach →</Button>
            </div>
            <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500"><tr>
                  <th className="p-2"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? new Set(leads.map((l) => l.id)) : new Set())} /></th>
                  <th className="p-2">Business</th><th className="p-2">Phone</th><th className="p-2">Website</th><th className="p-2">City</th><th className="p-2">Rating</th><th className="p-2">Reviews</th><th className="p-2">Status</th>
                </tr></thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="p-2"><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSel(l.id)} /></td>
                      <td className="p-2 font-medium text-slate-800">{l.name}</td>
                      <td className="p-2">{l.phone || "—"}</td>
                      <td className="p-2 max-w-[160px] truncate">{l.website || "—"}</td>
                      <td className="p-2">{l.city}</td><td className="p-2">{l.rating || "—"}</td><td className="p-2">{l.reviewCount || "—"}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{l.status}</Badge></td>
                    </tr>
                  ))}
                  {!leads.length && <tr><td colSpan={8} className="p-6 text-center text-slate-400">No leads loaded — click Apply.</td></tr>}
                </tbody>
              </table>
            </div>
            <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
          </div>
        )}

        {/* STEP 5 — Outreach */}
        {step === 4 && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            <div className="text-sm text-slate-600">Acting on <b>{selected.size ? `${selected.size} selected` : "all"}</b> leads in this batch. SMS goes via your two-way number (replies captured by Lockie).</div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Action icon={<MessageSquare className="h-4 w-4" />} label="Send SMS campaign" busy={busy === "sms"} onClick={() => outreach("sms")} />
              <Action icon={<Mail className="h-4 w-4" />} label="Send email (if available)" busy={busy === "email"} onClick={() => outreach("email")} />
              <Action icon={<CheckCircle2 className="h-4 w-4" />} label="Mark contacted" busy={busy === "mark_contacted"} onClick={() => outreach("mark_contacted")} />
              <Action icon={<Tag className="h-4 w-4" />} label="Tag 'manual'" busy={busy === "tag"} onClick={() => outreach("tag", { tags: ["manual"] })} />
              <Action icon={<Download className="h-4 w-4" />} label="Export CSV" busy={busy === "export_csv"} onClick={() => outreach("export_csv")} />
            </div>
            <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(3)}>← Back</Button><Button className="ml-auto" onClick={() => { setStep(5); loadReport(); }}>View report →</Button></div>
          </div>
        )}

        {/* STEP 6 — Report */}
        {step === 5 && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
            {!report ? <div className="text-slate-400">Loading…</div> : (
              <>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <Stat label="Extracted" value={report.batch.extracted} /><Stat label="SMS sent" value={report.batch.smsSent} /><Stat label="Emails sent" value={report.batch.emailsSent} />
                </div>
                <div className="text-sm font-medium text-slate-700">This batch funnel</div>
                <FunnelRow f={report.thisBatch} />
                <div className="mt-4 text-sm font-medium text-slate-700">Manual vs Auto (all-time)</div>
                <div className="text-xs text-slate-500">Manual</div><FunnelRow f={report.compare.manual} />
                <div className="text-xs text-slate-500">Auto</div><FunnelRow f={report.compare.auto} />
              </>
            )}
            <Button variant="outline" onClick={() => setStep(4)}>← Back</Button>
          </div>
        )}
      </div>
    </AdminSidebar>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}
function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-slate-50 p-3"><div className="text-2xl font-bold text-slate-900">{value}</div><div className="text-xs text-slate-500">{label}</div></div>;
}
function Action({ icon, label, onClick, busy }: { icon: React.ReactNode; label: string; onClick: () => void; busy: boolean }) {
  return <Button variant="outline" className="justify-start gap-2" disabled={busy} onClick={onClick}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}{label}</Button>;
}
function FunnelRow({ f }: { f: { total: number; byStatus: Record<string, number> } }) {
  return <div className="flex flex-wrap gap-2 text-xs">
    <Badge variant="outline">total {f.total}</Badge>
    {Object.entries(f.byStatus).map(([k, v]) => <Badge key={k} variant="outline">{k} {v as number}</Badge>)}
  </div>;
}
