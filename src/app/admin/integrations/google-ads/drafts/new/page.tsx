"use client";

/**
 * Admin → Integrations → Google Ads → Create Campaign Draft (Phase 2)
 *
 * Full campaign composer: basics, location targeting, ad groups,
 * assets, bid adjustments, negative keywords, notes.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KeywordRow { text: string; matchType: "EXACT" | "PHRASE" | "BROAD" }
interface AccountOption { id: string; name: string; customerId: string }

interface AdGroup {
  name: string;
  keywords: KeywordRow[];
  headlines: string[];
  descriptions: string[];
}

interface SitelinkRow {
  linkText: string;
  finalUrl: string;
  description1: string;
  description2: string;
}

interface ScheduleRow {
  dayOfWeek: string;
  hourStart: number;
  hourEnd: number;
  bidModifier: number;
}

interface NegativeList { id: string; name: string; keywords: string[] }

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_HEADLINES = [
  "Locked Out? 15 Min Response",
  "Verified UK Locksmiths",
  "24/7 Emergency Locksmith",
];
const DEFAULT_DESCRIPTIONS = [
  "Vetted, insured locksmiths to your door in under 30 minutes.",
  "Fixed upfront price agreed before any work starts. Book in 60 seconds.",
];
const DEFAULT_KEYWORDS: KeywordRow[] = [
  { text: "emergency locksmith", matchType: "EXACT" },
  { text: "locked out of house", matchType: "PHRASE" },
];

const SCOTLAND_IDS = ["1006560", "1006561", "1006562", "1006563", "1006568"];
const WALES_IDS    = ["1006573", "1006574", "1006575"];
const NI_IDS       = ["1006585", "1006586"];
const DEFAULT_EXCLUSIONS = [...SCOTLAND_IDS, ...WALES_IDS, ...NI_IDS];

const SUGGESTED_CALLOUTS = [
  "Anti-Fraud Protected", "GPS Tracked", "Money-Back Guarantee", "24/7 Service", "DBS Checked",
];

// ─── Collapsible Panel ────────────────────────────────────────────────────────

function Panel({ title, defaultOpen = false, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded border divide-y">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-gray-400 text-xs">{open ? "▲ Collapse" : "▼ Expand"}</span>
      </button>
      {open && <div className="px-4 py-4 space-y-4">{children}</div>}
    </section>
  );
}

// ─── Chip input (geo IDs) ─────────────────────────────────────────────────────

function ChipInput({ label, values, onChange }: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function add() {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) onChange([...values, trimmed]);
    setInput("");
  }
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="Geo ID (e.g. 1006886)"
          className="flex-1 rounded border px-2 py-1 text-xs"
        />
        <button type="button" onClick={add} className="rounded border px-2 py-1 text-xs">Add</button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {values.map((v) => (
            <span key={v} className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} className="ml-1 text-blue-600 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ad Group Editor ──────────────────────────────────────────────────────────

function AdGroupEditor({ group, onChange }: {
  group: AdGroup;
  onChange: (g: AdGroup) => void;
}) {
  function updateAt<T>(arr: T[], i: number, v: T): T[] { const n = [...arr]; n[i] = v; return n; }
  function removeAt<T>(arr: T[], i: number): T[] { return arr.filter((_, idx) => idx !== i); }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium mb-1">Group name</label>
        <input
          value={group.name}
          onChange={(e) => onChange({ ...group, name: e.target.value })}
          className="w-full rounded border px-2 py-1 text-sm"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">Keywords ({group.keywords.length})</span>
          <button
            type="button"
            onClick={() => onChange({ ...group, keywords: [...group.keywords, { text: "", matchType: "PHRASE" }] })}
            className="text-xs rounded border px-2 py-0.5"
          >
            + Add
          </button>
        </div>
        <div className="space-y-1">
          {group.keywords.map((k, i) => (
            <div key={i} className="flex items-center gap-2">
              <select
                value={k.matchType}
                onChange={(e) => onChange({ ...group, keywords: updateAt(group.keywords, i, { ...k, matchType: e.target.value as KeywordRow["matchType"] }) })}
                className="rounded border px-1 py-0.5 text-xs"
              >
                <option>EXACT</option><option>PHRASE</option><option>BROAD</option>
              </select>
              <input
                value={k.text}
                onChange={(e) => onChange({ ...group, keywords: updateAt(group.keywords, i, { ...k, text: e.target.value }) })}
                placeholder="keyword"
                className="flex-1 rounded border px-2 py-0.5 text-xs"
              />
              <button type="button" onClick={() => onChange({ ...group, keywords: removeAt(group.keywords, i) })} className="text-xs text-red-500">×</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">Headlines ({group.headlines.length}/15)</span>
          <button
            type="button"
            disabled={group.headlines.length >= 15}
            onClick={() => onChange({ ...group, headlines: [...group.headlines, ""] })}
            className="text-xs rounded border px-2 py-0.5 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        <div className="space-y-1">
          {group.headlines.map((h, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={h}
                onChange={(e) => onChange({ ...group, headlines: updateAt(group.headlines, i, e.target.value) })}
                maxLength={30}
                className="flex-1 rounded border px-2 py-0.5 text-xs"
              />
              <span className="text-xs text-gray-400 w-9 text-right">{h.length}/30</span>
              <button type="button" disabled={group.headlines.length <= 3} onClick={() => onChange({ ...group, headlines: removeAt(group.headlines, i) })} className="text-xs text-red-500 disabled:opacity-30">×</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium">Descriptions ({group.descriptions.length}/4)</span>
          <button
            type="button"
            disabled={group.descriptions.length >= 4}
            onClick={() => onChange({ ...group, descriptions: [...group.descriptions, ""] })}
            className="text-xs rounded border px-2 py-0.5 disabled:opacity-50"
          >
            + Add
          </button>
        </div>
        <div className="space-y-1">
          {group.descriptions.map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={d}
                onChange={(e) => onChange({ ...group, descriptions: updateAt(group.descriptions, i, e.target.value) })}
                maxLength={90}
                className="flex-1 rounded border px-2 py-0.5 text-xs"
              />
              <span className="text-xs text-gray-400 w-12 text-right">{d.length}/90</span>
              <button type="button" disabled={group.descriptions.length <= 2} onClick={() => onChange({ ...group, descriptions: removeAt(group.descriptions, i) })} className="text-xs text-red-500 disabled:opacity-30">×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ManualCreateGoogleAdsDraftPage() {
  const router = useRouter();

  // Basics
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountId, setAccountId] = useState("");
  const [name, setName] = useState("LockSafe | Manual Search Campaign");
  const [dailyBudget, setDailyBudget] = useState("5");
  const [biddingStrategy, setBiddingStrategy] = useState("MAXIMIZE_CONVERSIONS");
  const [targetCpa, setTargetCpa] = useState("");
  const [finalUrl, setFinalUrl] = useState("https://www.locksafe.uk/");
  const [languageTargets, setLanguageTargets] = useState("1000");

  // Location targeting
  const [geoTargets, setGeoTargets] = useState<string[]>(["2826"]);
  const [geoExclusions, setGeoExclusions] = useState<string[]>(DEFAULT_EXCLUSIONS);
  const [locationMatchType, setLocationMatchType] = useState<"PRESENCE_ONLY" | "PRESENCE_OR_INTEREST">("PRESENCE_ONLY");

  // Ad groups
  const [adGroups, setAdGroups] = useState<AdGroup[]>([
    { name: "All Keywords", keywords: DEFAULT_KEYWORDS, headlines: DEFAULT_HEADLINES, descriptions: DEFAULT_DESCRIPTIONS },
  ]);
  const [activeGroup, setActiveGroup] = useState(0);

  // Assets
  const [callouts, setCallouts] = useState<string[]>(["Anti-Fraud Protected", "GPS Tracked", "24/7 Service"]);
  const [calloutInput, setCalloutInput] = useState("");
  const [callPhone, setCallPhone] = useState("+44 20 4577 1989");
  const [sitelinks, setSitelinks] = useState<SitelinkRow[]>([
    { linkText: "How It Works", finalUrl: "https://locksafe.uk/how-it-works", description1: "", description2: "" },
    { linkText: "Pricing", finalUrl: "https://locksafe.uk/pricing", description1: "", description2: "" },
  ]);
  const [snippetHeader, setSnippetHeader] = useState("Services");
  const [snippetValues, setSnippetValues] = useState("Lockout, Lock Change, uPVC Repair, Anti-Snap Lock");

  // Bid adjustments
  const [mobileBid, setMobileBid] = useState("25");
  const [tabletBid, setTabletBid] = useState("0");
  const [desktopBid, setDesktopBid] = useState("0");
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([
    { dayOfWeek: "ALL", hourStart: 18, hourEnd: 23, bidModifier: 20 },
  ]);

  // Negatives
  const [negativeKeywords, setNegativeKeywords] = useState("locksmith training, locksmith jobs, locksmith course");
  const [negativeLists, setNegativeLists] = useState<NegativeList[]>([]);
  const [selectedListId, setSelectedListId] = useState("");

  // Notes & submit
  const [notes, setNotes] = useState("");
  const [approveImmediately, setApproveImmediately] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [accRes, listRes] = await Promise.all([
          fetch("/api/admin/google-ads/accounts"),
          fetch("/api/admin/google-ads/shared-negative-lists"),
        ]);
        if (accRes.ok) {
          const data = await accRes.json();
          const list: AccountOption[] = data.accounts ?? [];
          setAccounts(list);
          if (list.length > 0) setAccountId(list[0].id);
        }
        if (listRes.ok) {
          const data = await listRes.json();
          setNegativeLists(data.lists ?? []);
        }
      } catch {
        // non-fatal
      }
    })();
  }, []);

  function updateSitelink(i: number, field: keyof SitelinkRow, value: string) {
    setSitelinks((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }

  function updateScheduleRow(i: number, field: keyof ScheduleRow, value: string | number) {
    setScheduleRows((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
  }

  const ALL_DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

  function expandScheduleRow(row: ScheduleRow): ScheduleRow[] {
    if (row.dayOfWeek !== "ALL") return [row];
    return ALL_DAYS.map((d) => ({ ...row, dayOfWeek: d }));
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      // Build assets array
      const assets: object[] = [];
      if (callPhone.trim()) {
        assets.push({ type: "CALL", phoneNumber: callPhone.trim(), countryCode: "GB" });
      }
      for (const c of callouts.filter(Boolean)) {
        assets.push({ type: "CALLOUT", text: c });
      }
      for (const s of sitelinks) {
        if (s.linkText.trim() && s.finalUrl.trim()) {
          assets.push({
            type: "SITELINK",
            linkText: s.linkText.trim(),
            finalUrl: s.finalUrl.trim(),
            description1: s.description1.trim() || undefined,
            description2: s.description2.trim() || undefined,
          });
        }
      }
      if (snippetValues.trim()) {
        assets.push({
          type: "STRUCTURED_SNIPPET",
          header: snippetHeader,
          values: snippetValues.split(",").map((v) => v.trim()).filter(Boolean),
        });
      }

      // Build expanded schedule
      const expandedSchedule = scheduleRows.flatMap(expandScheduleRow);

      // Flat keywords/headlines/descriptions from first group (backwards compat)
      const firstGroup = adGroups[0];

      const payload = {
        accountId: accountId || undefined,
        name: name.trim(),
        dailyBudget: Number(dailyBudget),
        biddingStrategy,
        targetCpa: targetCpa ? Number(targetCpa) : null,
        channel: "SEARCH",
        geoTargets,
        geoExclusions,
        locationMatchType,
        languageTargets: languageTargets.split(",").map((s) => s.trim()).filter(Boolean),
        // Flat fields (backwards compat + single-group)
        headlines: firstGroup.headlines.map((h) => h.trim()).filter(Boolean),
        descriptions: firstGroup.descriptions.map((d) => d.trim()).filter(Boolean),
        finalUrl: finalUrl.trim(),
        keywords: firstGroup.keywords.map((k) => ({ text: k.text.trim().toLowerCase(), matchType: k.matchType })).filter((k) => k.text),
        negativeKeywords: negativeKeywords.split(/[,\n]/).map((s) => s.trim().toLowerCase()).filter(Boolean),
        sharedNegativeListId: selectedListId || undefined,
        // Phase 2
        adGroups,
        assets,
        deviceBidAdjustments: { mobile: Number(mobileBid), tablet: Number(tabletBid), desktop: Number(desktopBid) },
        adScheduleAdjustments: expandedSchedule,
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

  const selectedList = negativeLists.find((l) => l.id === selectedListId);

  return (
    <div className="container mx-auto max-w-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create Google Ads Campaign</h1>
        <Link href="/admin/integrations/google-ads/drafts" className="text-blue-600 hover:underline text-sm">
          ← Back to drafts
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        Compose a full Search campaign. The draft enters the approve → publish lifecycle and is spend-guard checked at publish time.
      </p>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>
      )}

      {/* ── Basics ─────────────────────────────────────────────────────────── */}
      <Panel title="Basics" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm space-y-1">
            <span className="text-xs font-medium">Account</span>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
              {accounts.length === 0 && <option value="">(first active)</option>}
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} · {a.customerId}</option>
              ))}
            </select>
          </label>
          <label className="text-sm space-y-1">
            <span className="text-xs font-medium">Campaign name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-xs font-medium">Daily budget (£)</span>
            <input type="number" min="1" step="0.5" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
          </label>
          <label className="text-sm space-y-1">
            <span className="text-xs font-medium">Bidding strategy</span>
            <select value={biddingStrategy} onChange={(e) => setBiddingStrategy(e.target.value)} className="w-full rounded border px-2 py-1 text-sm">
              <option value="MAXIMIZE_CONVERSIONS">MAXIMIZE_CONVERSIONS</option>
              <option value="TARGET_CPA">TARGET_CPA</option>
              <option value="MAXIMIZE_CLICKS">MAXIMIZE_CLICKS</option>
            </select>
          </label>
          {biddingStrategy === "TARGET_CPA" && (
            <label className="text-sm space-y-1">
              <span className="text-xs font-medium">Target CPA (£)</span>
              <input type="number" step="0.5" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
            </label>
          )}
          <label className="text-sm space-y-1 col-span-2">
            <span className="text-xs font-medium">Final URL</span>
            <input value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} className="w-full rounded border px-2 py-1 text-sm" />
          </label>
        </div>
      </Panel>

      {/* ── Location Targeting ──────────────────────────────────────────────── */}
      <Panel title="Location Targeting">
        <ChipInput label="Geo Inclusions (target areas)" values={geoTargets} onChange={setGeoTargets} />
        <ChipInput label="Geo Exclusions (excluded areas)" values={geoExclusions} onChange={setGeoExclusions} />
        <p className="text-xs text-gray-500">
          Default exclusions: Scotland ({SCOTLAND_IDS.join(", ")}), Wales ({WALES_IDS.join(", ")}), Northern Ireland ({NI_IDS.join(", ")}).
        </p>

        <div className="space-y-1">
          <span className="block text-xs font-medium">Location Match Type</span>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="locMatch"
              value="PRESENCE_ONLY"
              checked={locationMatchType === "PRESENCE_ONLY"}
              onChange={() => setLocationMatchType("PRESENCE_ONLY")}
            />
            <span>Presence Only <span className="text-green-600 font-medium">(Recommended)</span></span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="locMatch"
              value="PRESENCE_OR_INTEREST"
              checked={locationMatchType === "PRESENCE_OR_INTEREST"}
              onChange={() => setLocationMatchType("PRESENCE_OR_INTEREST")}
            />
            <span>Presence or Interest</span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Presence Only = only people physically in the target area. Prevents spending on people in Scotland searching for Sheffield locksmiths.
          </p>
        </div>
      </Panel>

      {/* ── Ad Groups ──────────────────────────────────────────────────────── */}
      <Panel title="Ad Groups">
        <p className="text-xs text-gray-500">
          When multiple groups are set, each gets its own RSA ad. Keywords in each group should be themed together.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {adGroups.map((g, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveGroup(i)}
              className={`px-3 py-1 text-xs rounded border ${activeGroup === i ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"}`}
            >
              {g.name || `Group ${i + 1}`}
            </button>
          ))}
          {adGroups.length < 5 && (
            <button
              type="button"
              onClick={() => {
                setAdGroups((prev) => [...prev, { name: `Group ${prev.length + 1}`, keywords: [{ text: "", matchType: "PHRASE" }], headlines: [""], descriptions: ["", ""] }]);
                setActiveGroup(adGroups.length);
              }}
              className="px-3 py-1 text-xs rounded border border-dashed hover:bg-gray-50"
            >
              + Add Group
            </button>
          )}
          {adGroups.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setAdGroups((prev) => prev.filter((_, i) => i !== activeGroup));
                setActiveGroup(0);
              }}
              className="px-3 py-1 text-xs rounded border text-red-600 hover:bg-red-50"
            >
              Remove
            </button>
          )}
        </div>

        {adGroups[activeGroup] && (
          <AdGroupEditor
            group={adGroups[activeGroup]}
            onChange={(g) => setAdGroups((prev) => prev.map((x, i) => i === activeGroup ? g : x))}
          />
        )}
      </Panel>

      {/* ── Ad Assets ──────────────────────────────────────────────────────── */}
      <Panel title="Ad Assets (Free CTR boost)">
        {/* Callouts */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Callouts ({callouts.length}/10)</span>
          </div>
          <div className="flex gap-2 mb-1">
            <input
              value={calloutInput}
              onChange={(e) => setCalloutInput(e.target.value)}
              maxLength={25}
              placeholder="Callout text (max 25 chars)"
              className="flex-1 rounded border px-2 py-1 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const v = calloutInput.trim();
                  if (v && callouts.length < 10 && !callouts.includes(v)) {
                    setCallouts([...callouts, v]);
                    setCalloutInput("");
                  }
                }
              }}
            />
            <button
              type="button"
              disabled={callouts.length >= 10}
              onClick={() => {
                const v = calloutInput.trim();
                if (v && !callouts.includes(v)) { setCallouts([...callouts, v]); setCalloutInput(""); }
              }}
              className="rounded border px-2 py-1 text-xs disabled:opacity-50"
            >
              Add
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-1">Suggestions: {SUGGESTED_CALLOUTS.filter((s) => !callouts.includes(s)).join(", ")}</p>
          <div className="flex flex-wrap gap-1">
            {callouts.map((c) => (
              <span key={c} className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
                {c}
                <button type="button" onClick={() => setCallouts(callouts.filter((x) => x !== c))} className="text-orange-600 hover:text-red-600">×</button>
              </span>
            ))}
          </div>
        </div>

        {/* Call extension */}
        <div>
          <label className="block text-xs font-medium mb-1">Call Extension</label>
          <input
            value={callPhone}
            onChange={(e) => setCallPhone(e.target.value)}
            placeholder="+44 20 4577 1989"
            className="w-full rounded border px-2 py-1 text-sm"
          />
        </div>

        {/* Sitelinks */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Sitelinks ({sitelinks.length}/4)</span>
            {sitelinks.length < 4 && (
              <button
                type="button"
                onClick={() => setSitelinks([...sitelinks, { linkText: "", finalUrl: "", description1: "", description2: "" }])}
                className="text-xs rounded border px-2 py-0.5"
              >
                + Add
              </button>
            )}
          </div>
          <div className="space-y-2">
            {sitelinks.map((s, i) => (
              <div key={i} className="rounded border p-2 space-y-1">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Link Text ({s.linkText.length}/25)</label>
                    <input value={s.linkText} onChange={(e) => updateSitelink(i, "linkText", e.target.value)} maxLength={25} className="w-full rounded border px-2 py-0.5 text-xs" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">URL</label>
                    <input value={s.finalUrl} onChange={(e) => updateSitelink(i, "finalUrl", e.target.value)} className="w-full rounded border px-2 py-0.5 text-xs" placeholder="https://" />
                  </div>
                  <button type="button" onClick={() => setSitelinks(sitelinks.filter((_, idx) => idx !== i))} className="text-xs text-red-500 self-end pb-1">×</button>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Desc 1 ({s.description1.length}/35)</label>
                    <input value={s.description1} onChange={(e) => updateSitelink(i, "description1", e.target.value)} maxLength={35} className="w-full rounded border px-2 py-0.5 text-xs" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Desc 2 ({s.description2.length}/35)</label>
                    <input value={s.description2} onChange={(e) => updateSitelink(i, "description2", e.target.value)} maxLength={35} className="w-full rounded border px-2 py-0.5 text-xs" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Structured Snippet */}
        <div>
          <label className="block text-xs font-medium mb-1">Structured Snippet</label>
          <div className="flex gap-2">
            <select value={snippetHeader} onChange={(e) => setSnippetHeader(e.target.value)} className="rounded border px-2 py-1 text-xs">
              {["Services", "Highlights", "Brands", "Types"].map((h) => <option key={h}>{h}</option>)}
            </select>
            <input
              value={snippetValues}
              onChange={(e) => setSnippetValues(e.target.value)}
              placeholder="Comma-separated values"
              className="flex-1 rounded border px-2 py-1 text-xs"
            />
          </div>
        </div>
      </Panel>

      {/* ── Bid Adjustments ────────────────────────────────────────────────── */}
      <Panel title="Bid Adjustments">
        <div>
          <span className="block text-xs font-medium mb-2">Device Adjustments (%)</span>
          <div className="flex gap-4">
            {[
              { label: "Mobile", value: mobileBid, set: setMobileBid },
              { label: "Tablet", value: tabletBid, set: setTabletBid },
              { label: "Desktop", value: desktopBid, set: setDesktopBid },
            ].map(({ label, value, set }) => (
              <label key={label} className="flex flex-col items-center gap-1 text-xs">
                <span>{label}</span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className="w-20 rounded border px-2 py-1 text-sm text-center"
                />
              </label>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-1">Enter percentage adjustment, e.g. 25 = +25% bids on mobile</p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">Schedule Adjustments</span>
            <button
              type="button"
              onClick={() => setScheduleRows([...scheduleRows, { dayOfWeek: "ALL", hourStart: 0, hourEnd: 23, bidModifier: 0 }])}
              className="text-xs rounded border px-2 py-0.5"
            >
              + Add Row
            </button>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b">
                <th className="pb-1">Day</th>
                <th className="pb-1">Start Hour</th>
                <th className="pb-1">End Hour</th>
                <th className="pb-1">Modifier %</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1 pr-2">
                    <select value={r.dayOfWeek} onChange={(e) => updateScheduleRow(i, "dayOfWeek", e.target.value)} className="rounded border px-1 py-0.5 text-xs">
                      <option value="ALL">All Days</option>
                      {ALL_DAYS.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" max="23" value={r.hourStart} onChange={(e) => updateScheduleRow(i, "hourStart", Number(e.target.value))} className="w-16 rounded border px-1 py-0.5 text-xs" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" min="0" max="23" value={r.hourEnd} onChange={(e) => updateScheduleRow(i, "hourEnd", Number(e.target.value))} className="w-16 rounded border px-1 py-0.5 text-xs" />
                  </td>
                  <td className="py-1 pr-2">
                    <input type="number" value={r.bidModifier} onChange={(e) => updateScheduleRow(i, "bidModifier", Number(e.target.value))} className="w-16 rounded border px-1 py-0.5 text-xs" />
                  </td>
                  <td>
                    <button type="button" onClick={() => setScheduleRows(scheduleRows.filter((_, idx) => idx !== i))} className="text-red-500">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-gray-500 mt-1">
            Peak hours for emergency locksmith searches are 6pm-midnight. +20% during these hours typically reduces wasted daytime spend.
          </p>
        </div>
      </Panel>

      {/* ── Negative Keywords ──────────────────────────────────────────────── */}
      <Panel title="Negative Keywords">
        <div>
          <label className="block text-xs font-medium mb-1">Campaign-level negatives</label>
          <textarea
            value={negativeKeywords}
            onChange={(e) => setNegativeKeywords(e.target.value)}
            rows={3}
            className="w-full rounded border px-2 py-1 text-sm"
            placeholder="comma or newline separated"
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">Shared Negative List</label>
          <select
            value={selectedListId}
            onChange={(e) => setSelectedListId(e.target.value)}
            className="w-full rounded border px-2 py-1 text-sm"
          >
            <option value="">(none)</option>
            {negativeLists.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.keywords.length} keywords)</option>
            ))}
          </select>
          {selectedList && (
            <p className="text-xs text-green-700 mt-1">
              {selectedList.keywords.length} negatives will be applied IN ADDITION to campaign-level negatives.
            </p>
          )}
        </div>
      </Panel>

      {/* ── Notes & Submit ─────────────────────────────────────────────────── */}
      <Panel title="Notes & Submit" defaultOpen>
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
      </Panel>

      <div className="flex items-center justify-end gap-3">
        <Link href="/admin/integrations/google-ads/drafts" className="rounded border px-4 py-2 text-sm">
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
