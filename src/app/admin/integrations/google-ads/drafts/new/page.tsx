"use client";

/**
 * Admin → Integrations → Google Ads → Ad Drafts → Create custom draft.
 *
 * Lets the admin manually compose every part of a Google Ads Search campaign
 * (RSA creative + keywords + targeting) and create a draft that flows through
 * the existing APPROVE → PUBLISH lifecycle. After a successful publish, the
 * server auto-snapshots the live campaign so the configuration can be reused
 * by future automations.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface KeywordRow {
  text: string;
  matchType: "EXACT" | "PHRASE" | "BROAD";
}

interface AccountOption {
  id: string;
  name: string;
  customerId: string;
}

const DEFAULT_HEADLINES = [
  "Locked Out? 15 Min Response",
  "Verified UK Locksmiths",
  "24/7 Emergency Locksmith",
];

const DEFAULT_DESCRIPTIONS = [
  "Vetted, insured locksmiths to your door in under 30 minutes.",
  "Fixed price. No surprise call-out fees. Book in 60 seconds.",
];

export default function ManualCreateGoogleAdsDraftPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("LockSafe | Manual Search Campaign");
  const [dailyBudget, setDailyBudget] = useState("5");
  const [biddingStrategy, setBiddingStrategy] = useState("MAXIMIZE_CONVERSIONS");
  const [targetCpa, setTargetCpa] = useState("");
  const [finalUrl, setFinalUrl] = useState("https://www.locksafe.uk/");
  const [geoTargets, setGeoTargets] = useState("2826"); // UK
  const [languageTargets, setLanguageTargets] = useState("1000"); // English
  const [headlines, setHeadlines] = useState<string[]>(DEFAULT_HEADLINES);
  const [descriptions, setDescriptions] = useState<string[]>(DEFAULT_DESCRIPTIONS);
  const [keywords, setKeywords] = useState<KeywordRow[]>([
    { text: "emergency locksmith", matchType: "EXACT" },
    { text: "locked out of house", matchType: "PHRASE" },
  ]);
  const [negativeKeywords, setNegativeKeywords] = useState("locksmith training, locksmith jobs, locksmith course");
  const [approveImmediately, setApproveImmediately] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/google-ads/accounts");
        if (res.ok) {
          const data = await res.json();
          const list: AccountOption[] = data.accounts ?? [];
          setAccounts(list);
          if (list.length > 0 && !accountId) setAccountId(list[0].id);
        }
      } catch {
        // non-fatal — backend will fall back to first active account if blank
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateAt<T>(arr: T[], idx: number, value: T): T[] {
    const next = [...arr];
    next[idx] = value;
    return next;
  }
  function removeAt<T>(arr: T[], idx: number): T[] {
    return arr.filter((_, i) => i !== idx);
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        accountId: accountId || undefined,
        name: name.trim(),
        dailyBudget: Number(dailyBudget),
        biddingStrategy,
        targetCpa: targetCpa ? Number(targetCpa) : null,
        channel: "SEARCH",
        geoTargets: geoTargets.split(",").map((s) => s.trim()).filter(Boolean),
        languageTargets: languageTargets.split(",").map((s) => s.trim()).filter(Boolean),
        headlines: headlines.map((h) => h.trim()).filter(Boolean),
        descriptions: descriptions.map((d) => d.trim()).filter(Boolean),
        finalUrl: finalUrl.trim(),
        keywords: keywords
          .map((k) => ({ text: k.text.trim().toLowerCase(), matchType: k.matchType }))
          .filter((k) => k.text.length > 0),
        negativeKeywords: negativeKeywords
          .split(/[,\n]/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        approveImmediately,
        notes: notes.trim() || undefined,
      };
      const res = await fetch("/api/admin/google-ads/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create draft");
      router.push(`/admin/integrations/google-ads/drafts/${data.draftId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create custom Google Ads campaign</h1>
        <Link
          href="/admin/integrations/google-ads/drafts"
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back to drafts
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Manually compose every part of a Search campaign. The draft enters the
        same approve → publish lifecycle as AI-generated drafts and is spend-
        guard checked at publish time. After a successful publish, the live
        Google Ads state is automatically extracted and stored as a snapshot
        you can re-use for future automations.
      </p>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Basics</h2>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span>Account</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="w-full rounded border px-2 py-1"
            >
              {accounts.length === 0 && <option value="">(first active)</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.customerId}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span>Campaign name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm space-y-1">
            <span>Daily budget (£)</span>
            <input
              type="number"
              min="1"
              step="0.5"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              className="w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm space-y-1">
            <span>Bidding strategy</span>
            <select
              value={biddingStrategy}
              onChange={(e) => setBiddingStrategy(e.target.value)}
              className="w-full rounded border px-2 py-1"
            >
              <option value="MAXIMIZE_CONVERSIONS">MAXIMIZE_CONVERSIONS</option>
              <option value="TARGET_CPA">TARGET_CPA</option>
              <option value="MAXIMIZE_CLICKS">MAXIMIZE_CLICKS</option>
            </select>
          </label>
          {biddingStrategy === "TARGET_CPA" && (
            <label className="text-sm space-y-1">
              <span>Target CPA (£)</span>
              <input
                type="number"
                step="0.5"
                value={targetCpa}
                onChange={(e) => setTargetCpa(e.target.value)}
                className="w-full rounded border px-2 py-1"
              />
            </label>
          )}
          <label className="text-sm space-y-1 col-span-2">
            <span>Final URL</span>
            <input
              value={finalUrl}
              onChange={(e) => setFinalUrl(e.target.value)}
              className="w-full rounded border px-2 py-1"
            />
          </label>
          <label className="text-sm space-y-1">
            <span>Geo targets (comma-separated geo IDs)</span>
            <input
              value={geoTargets}
              onChange={(e) => setGeoTargets(e.target.value)}
              className="w-full rounded border px-2 py-1"
            />
            <span className="text-xs text-muted-foreground">2826 = United Kingdom</span>
          </label>
          <label className="text-sm space-y-1">
            <span>Language IDs</span>
            <input
              value={languageTargets}
              onChange={(e) => setLanguageTargets(e.target.value)}
              className="w-full rounded border px-2 py-1"
            />
            <span className="text-xs text-muted-foreground">1000 = English</span>
          </label>
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Headlines ({headlines.length}) — min 3, max 15, ≤30 chars</h2>
          <button
            type="button"
            disabled={headlines.length >= 15}
            onClick={() => setHeadlines([...headlines, ""])}
            className="text-sm rounded border px-2 py-1 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {headlines.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={h}
                onChange={(e) => setHeadlines(updateAt(headlines, i, e.target.value))}
                maxLength={30}
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
              <span className="text-xs text-muted-foreground w-12 text-right">{h.length}/30</span>
              <button
                type="button"
                onClick={() => setHeadlines(removeAt(headlines, i))}
                disabled={headlines.length <= 3}
                className="text-xs text-red-600 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Descriptions ({descriptions.length}) — min 2, max 4, ≤90 chars</h2>
          <button
            type="button"
            disabled={descriptions.length >= 4}
            onClick={() => setDescriptions([...descriptions, ""])}
            className="text-sm rounded border px-2 py-1 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {descriptions.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={d}
                onChange={(e) => setDescriptions(updateAt(descriptions, i, e.target.value))}
                maxLength={90}
                className="flex-1 rounded border px-2 py-1 text-sm"
              />
              <span className="text-xs text-muted-foreground w-12 text-right">{d.length}/90</span>
              <button
                type="button"
                onClick={() => setDescriptions(removeAt(descriptions, i))}
                disabled={descriptions.length <= 2}
                className="text-xs text-red-600 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Keywords ({keywords.length})</h2>
          <button
            type="button"
            onClick={() => setKeywords([...keywords, { text: "", matchType: "PHRASE" }])}
            className="text-sm rounded border px-2 py-1"
          >
            + Add
          </button>
        </div>
        <div className="space-y-2">
          {keywords.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={k.matchType}
                onChange={(e) =>
                  setKeywords(
                    updateAt(keywords, i, { ...k, matchType: e.target.value as KeywordRow["matchType"] }),
                  )
                }
                className="rounded border px-2 py-1 text-sm"
              >
                <option value="EXACT">EXACT</option>
                <option value="PHRASE">PHRASE</option>
                <option value="BROAD">BROAD</option>
              </select>
              <input
                value={k.text}
                onChange={(e) => setKeywords(updateAt(keywords, i, { ...k, text: e.target.value }))}
                className="flex-1 rounded border px-2 py-1 text-sm"
                placeholder="keyword text"
              />
              <button
                type="button"
                onClick={() => setKeywords(removeAt(keywords, i))}
                disabled={keywords.length <= 1}
                className="text-xs text-red-600 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Negative keywords</h2>
        <textarea
          value={negativeKeywords}
          onChange={(e) => setNegativeKeywords(e.target.value)}
          rows={3}
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="comma or newline separated"
        />
      </section>

      <section className="rounded border p-4 space-y-3">
        <h2 className="font-semibold">Notes (optional)</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Why are we running this? Tags for future search."
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={approveImmediately}
            onChange={(e) => setApproveImmediately(e.target.checked)}
          />
          Skip review queue and mark as APPROVED immediately (still needs explicit Publish click).
        </label>
      </section>

      <div className="flex items-center justify-end gap-3">
        <Link
          href="/admin/integrations/google-ads/drafts"
          className="rounded border px-4 py-2 text-sm"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create draft"}
        </button>
      </div>
    </div>
  );
}
