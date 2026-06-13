/**
 * /admin/ai-visibility — are ChatGPT / Gemini / Perplexity citing LockSafe?
 *
 * Share-of-voice per engine + a prompt×engine matrix + which competitors get
 * cited instead. The weekly cron populates it; "Run now" triggers on demand.
 */

"use client";

import { useEffect, useState } from "react";

type EngineCell = {
  status: string;
  cited: boolean;
  position: number | null;
  competitors: string[];
} | null;

interface MatrixRow {
  id: string;
  text: string;
  category: string;
  engines: Record<string, EngineCell>;
}
interface Sov {
  ok: number; cited: number; pct: number; lastRunAt: string | null;
}
interface Data {
  hasAnyData: boolean;
  shareOfVoice: Record<string, Sov>;
  matrix: MatrixRow[];
  competitorsCitedInstead: { name: string; count: number }[];
  promptCount: number;
}

const ENGINES = ["chatgpt", "gemini", "perplexity"] as const;
const ENGINE_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT", gemini: "Gemini", perplexity: "Perplexity",
};

function Cell({ c }: { c: EngineCell }) {
  if (!c) return <span className="text-gray-300">—</span>;
  if (c.status === "skipped") return <span className="text-gray-400" title="No API key">key?</span>;
  if (c.status === "error") return <span className="text-red-500" title="API error">err</span>;
  if (c.cited) return <span className="text-emerald-600 font-semibold">✓{c.position ? ` #${c.position}` : ""}</span>;
  return <span className="text-gray-400">✗</span>;
}

export default function AiVisibilityPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/ai-visibility", { credentials: "include", cache: "no-store" });
      if (r.ok) setData(await r.json());
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const runNow = async () => {
    if (!confirm("Run an AI-visibility check now? Calls each engine that has an API key for every tracked prompt.")) return;
    setRunning(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/ai-visibility", { method: "POST", credentials: "include" });
      const j = await r.json();
      setMsg(j.success
        ? `Done — ${j.cited}/${j.ok} answers cited LockSafe (${j.skipped} skipped, ${j.errors} errors).`
        : `Failed: ${j.error}`);
      await load();
    } catch (e) {
      setMsg(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setRunning(false); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-baseline justify-between mb-2">
        <h1 className="text-2xl font-bold">AI Visibility — are the engines citing us?</h1>
        <button
          onClick={runNow}
          disabled={running}
          className="px-3 py-1 text-sm bg-amber-500 text-white rounded hover:bg-amber-600 disabled:opacity-50"
        >
          {running ? "Running…" : "Run now"}
        </button>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Weekly check of whether ChatGPT &amp; Gemini (and Perplexity) recommend LockSafe for the
        questions customers actually ask. This is the &quot;replace ad clicks&quot; KPI: share of voice.
      </p>

      {loading && <p>Loading…</p>}
      {msg && <div className="mb-4 p-3 bg-gray-100 rounded text-sm">{msg}</div>}

      {data && !data.hasAnyData && (
        <div className="mb-6 p-4 border border-amber-300 bg-amber-50 rounded text-sm text-amber-900">
          No checks have run yet. Click <strong>Run now</strong>. Engines without an API key are
          recorded as &quot;key?&quot; and skipped: <code>OPENAI_API_KEY</code> (ChatGPT, already set),
          <code> GEMINI_API_KEY</code> (Gemini), <code> PERPLEXITY_API_KEY</code> (Perplexity).
        </div>
      )}

      {data && (
        <>
          {/* Share of voice */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {ENGINES.map((e) => {
              const s = data.shareOfVoice[e];
              return (
                <div key={e} className="border rounded-xl p-4 bg-white">
                  <div className="text-xs uppercase text-gray-500">{ENGINE_LABEL[e]} — share of voice</div>
                  <div className="text-3xl font-bold">{s?.pct ?? 0}%</div>
                  <div className="text-xs text-gray-500 mt-1">
                    cited in {s?.cited ?? 0} of {s?.ok ?? 0} answers
                  </div>
                </div>
              );
            })}
          </div>

          {/* Prompt × engine matrix */}
          <h2 className="text-lg font-semibold mb-2">Prompt coverage ({data.promptCount} prompts)</h2>
          <div className="overflow-x-auto border rounded mb-8">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left">
                  <th className="p-2">Prompt</th>
                  <th className="p-2">Cat</th>
                  {ENGINES.map((e) => <th key={e} className="p-2 text-center">{ENGINE_LABEL[e]}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row) => (
                  <tr key={row.id} className="border-t align-top">
                    <td className="p-2 max-w-md">{row.text}</td>
                    <td className="p-2 text-xs text-gray-500">{row.category}</td>
                    {ENGINES.map((e) => (
                      <td key={e} className="p-2 text-center"><Cell c={row.engines[e]} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mb-8">
            ✓ = cited (with source rank if known) · ✗ = not cited · key? = engine has no API key ·
            err = API error. Gemini answers inside Google Search (AI Overviews) aren&apos;t covered here —
            only the Gemini app/API.
          </p>

          {/* Competitors cited instead */}
          {data.competitorsCitedInstead.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-2">Cited instead of us</h2>
              <p className="text-sm text-gray-500 mb-3">
                When an engine answered without LockSafe, these got named. Each is a content gap to
                target with an answer-first page.
              </p>
              <div className="flex flex-wrap gap-2">
                {data.competitorsCitedInstead.map((c) => (
                  <span key={c.name} className="px-3 py-1 rounded-full bg-slate-100 text-sm">
                    {c.name} <span className="text-gray-500">×{c.count}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
