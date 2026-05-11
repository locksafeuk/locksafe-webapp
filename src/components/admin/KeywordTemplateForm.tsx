"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Plus, X, ExternalLink } from "lucide-react";

import type { KeywordTemplate } from "@/lib/keyword-templates";
import type { CityData } from "@/lib/uk-cities-data";

interface CityOption {
  slug: string;
  name: string;
  region: string;
}

interface Props {
  initial: KeywordTemplate;
  /** All UK city options shown in the city-selector. */
  cities: CityOption[];
  source: "db" | "static";
  isNew?: boolean;
}

/**
 * Single-form editor for a KeywordTemplate. Supports:
 * - identity (slug/label/pillar/tags)
 * - city scope (all vs. specific selection)
 * - structured content (title/meta/h1/intro/hero/body)
 * - trust bullets list editor
 * - FAQ list editor
 *
 * Templates use `{city}`, `{region}`, `{areas}`, `{landmarks}`, `{response}`,
 * `{population}` tokens — substituted at render time per city.
 */
export function KeywordTemplateForm({ initial, cities, source, isNew }: Props) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.slug);
  const [label, setLabel] = useState(initial.label);
  const [pillarKeyword, setPillarKeyword] = useState(initial.pillarKeyword ?? "");
  const [intentTags, setIntentTags] = useState((initial.intentTags ?? []).join(", "));
  const [isActive, setIsActive] = useState(initial.isActive !== false);
  const [position, setPosition] = useState(String(initial.position ?? 0));
  const [citiesMode, setCitiesMode] = useState<"all" | "selected">(initial.citiesMode);
  const [selectedCities, setSelectedCities] = useState<string[]>(initial.selectedCities ?? []);
  const [citySearch, setCitySearch] = useState("");

  const c = initial.content;
  const [metaTitle, setMetaTitle] = useState(c.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(c.metaDescription ?? "");
  const [h1, setH1] = useState(c.h1 ?? "");
  const [intro, setIntro] = useState(c.intro ?? "");
  const [emotionalHook, setEmotionalHook] = useState(c.emotionalHook ?? "");
  const [heroSubcopy, setHeroSubcopy] = useState(c.heroSubcopy ?? "");
  const [seoCopy, setSeoCopy] = useState(c.seoCopy ?? "");
  const [ctaLabel, setCtaLabel] = useState(c.ctaLabel ?? "");
  const [trustBullets, setTrustBullets] = useState<string[]>(c.trustBullets ?? []);
  const [faqs, setFaqs] = useState<Array<{ question: string; answer: string }>>(
    c.faqs ?? [],
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pageCount =
    citiesMode === "all" ? cities.length : selectedCities.length;

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q),
    );
  }, [cities, citySearch]);

  function toggleCity(slug: string) {
    setSelectedCities((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const body = {
      slug: slug.trim().toLowerCase(),
      label: label.trim(),
      pillarKeyword: pillarKeyword.trim() || undefined,
      intentTags: intentTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      isActive,
      position: Number(position) || 0,
      citiesMode,
      selectedCities,
      content: {
        metaTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        h1: h1.trim() || undefined,
        intro: intro.trim() || undefined,
        emotionalHook: emotionalHook.trim() || undefined,
        heroSubcopy: heroSubcopy.trim() || undefined,
        seoCopy: seoCopy.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        trustBullets: trustBullets.filter((b) => b.trim().length > 0),
        faqs: faqs.filter((f) => f.question.trim() && f.answer.trim()),
      },
    };

    const url = isNew
      ? "/api/admin/keyword-templates"
      : `/api/admin/keyword-templates/${initial.slug}`;
    const method = isNew ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `Request failed (${res.status})`);
      return;
    }

    router.push("/admin/seo/keywords");
    router.refresh();
  }

  async function handleRevert() {
    if (
      !window.confirm(
        "Remove the DB override and revert this keyword to its static seed (or delete it entirely if no seed exists)?",
      )
    )
      return;
    const res = await fetch(`/api/admin/keyword-templates/${initial.slug}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `Request failed (${res.status})`);
      return;
    }
    router.push("/admin/seo/keywords");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/seo/keywords"
          className="text-sm text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> All keyword templates
        </Link>
        {!isNew && pageCount > 0 && cities[0] && (
          <a
            href={`/${initial.slug}-in-${
              selectedCities[0] && citiesMode === "selected"
                ? selectedCities[0]
                : cities[0].slug
            }`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            View live sample <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {isNew ? "New keyword template" : `Edit: ${initial.label}`}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Source:{" "}
          <span
            className={
              source === "db" ? "text-amber-700 font-medium" : "text-slate-600 font-medium"
            }
          >
            {source}
          </span>
          . Generates <span className="font-semibold text-slate-900">{pageCount}</span>{" "}
          landing pages at <code className="text-amber-700">/{slug || "your-slug"}-in-[city]</code>.
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
          Identity
        </legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Slug (kebab-case)" required>
            <input
              required
              disabled={!isNew}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm font-mono disabled:bg-slate-100"
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              placeholder="locksmith-near-me"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Full URL: /{slug || "your-slug"}-in-london
            </p>
          </Field>
          <Field label="Label" required>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm"
              placeholder="Locksmith Near Me"
            />
          </Field>
          <Field label="Pillar keyword">
            <input
              value={pillarKeyword}
              onChange={(e) => setPillarKeyword(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm"
              placeholder="emergency-locksmith"
            />
          </Field>
          <Field label="Intent tags (comma separated)">
            <input
              value={intentTags}
              onChange={(e) => setIntentTags(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm"
              placeholder="near-me, urgent"
            />
          </Field>
          <Field label="Position">
            <input
              type="number"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
          <Field label="Status">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Active (generates pages)
            </label>
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
          City scope
        </legend>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={citiesMode === "all"}
              onChange={() => setCitiesMode("all")}
            />
            All UK cities ({cities.length})
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio"
              checked={citiesMode === "selected"}
              onChange={() => setCitiesMode("selected")}
            />
            Specific cities ({selectedCities.length} selected)
          </label>
        </div>
        {citiesMode === "selected" && (
          <div className="rounded-lg border border-slate-200 p-3 max-h-72 overflow-y-auto">
            <input
              type="search"
              placeholder="Search cities…"
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              className="w-full mb-2 rounded-md border-slate-300 text-sm"
            />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
              {filteredCities.map((c) => (
                <label
                  key={c.slug}
                  className="inline-flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedCities.includes(c.slug)}
                    onChange={() => toggleCity(c.slug)}
                  />
                  <span className="font-medium text-slate-800">{c.name}</span>
                  <span className="text-slate-400 truncate">{c.region}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
          Content (tokens: {"{city}"}, {"{region}"}, {"{areas}"}, {"{landmarks}"}, {"{response}"}, {"{population}"})
        </legend>
        <Field label="Meta title">
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className="w-full rounded-lg border-slate-300 text-sm"
            placeholder="Locksmith Near Me in {city} | LockSafe UK"
          />
        </Field>
        <Field label="Meta description">
          <textarea
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border-slate-300 text-sm"
          />
        </Field>
        <Field label="H1">
          <input
            value={h1}
            onChange={(e) => setH1(e.target.value)}
            className="w-full rounded-lg border-slate-300 text-sm"
            placeholder="Locksmith Near Me in {city}"
          />
        </Field>
        <Field label="Intro">
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={3}
            className="w-full rounded-lg border-slate-300 text-sm"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Emotional hook">
            <textarea
              value={emotionalHook}
              onChange={(e) => setEmotionalHook(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
          <Field label="Hero subcopy">
            <textarea
              value={heroSubcopy}
              onChange={(e) => setHeroSubcopy(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
        </div>
        <Field label="Long-form SEO body (300–700 words)">
          <textarea
            value={seoCopy}
            onChange={(e) => setSeoCopy(e.target.value)}
            rows={8}
            className="w-full rounded-lg border-slate-300 text-sm"
          />
        </Field>
        <Field label="CTA label">
          <input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="w-full rounded-lg border-slate-300 text-sm"
            placeholder="Find a locksmith in {city}"
          />
        </Field>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
        <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
          Trust bullets
        </legend>
        {trustBullets.map((b, i) => (
          <div key={i} className="flex items-start gap-2">
            <input
              value={b}
              onChange={(e) => {
                const next = [...trustBullets];
                next[i] = e.target.value;
                setTrustBullets(next);
              }}
              className="flex-1 rounded-lg border-slate-300 text-sm"
              placeholder="e.g. {response} response across {region}"
            />
            <button
              type="button"
              onClick={() => setTrustBullets(trustBullets.filter((_, j) => j !== i))}
              className="text-slate-400 hover:text-red-600 p-2"
              aria-label="Remove"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setTrustBullets([...trustBullets, ""])}
          className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium"
        >
          <Plus className="w-4 h-4" />
          Add bullet
        </button>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
          FAQs (FAQPage schema)
        </legend>
        {faqs.map((f, i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-3 bg-slate-50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">FAQ #{i + 1}</span>
              <button
                type="button"
                onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}
                className="text-slate-400 hover:text-red-600"
                aria-label="Remove"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              value={f.question}
              onChange={(e) => {
                const next = [...faqs];
                next[i] = { ...next[i], question: e.target.value };
                setFaqs(next);
              }}
              className="w-full rounded-lg border-slate-300 text-sm"
              placeholder="Question (e.g. How fast in {city}?)"
            />
            <textarea
              value={f.answer}
              onChange={(e) => {
                const next = [...faqs];
                next[i] = { ...next[i], answer: e.target.value };
                setFaqs(next);
              }}
              rows={3}
              className="w-full rounded-lg border-slate-300 text-sm"
              placeholder="Answer"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
          className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 font-medium"
        >
          <Plus className="w-4 h-4" />
          Add FAQ
        </button>
      </fieldset>

      <div className="flex items-center justify-between gap-4 pt-2">
        <div>
          {!isNew && source === "db" && (
            <button
              type="button"
              onClick={handleRevert}
              className="inline-flex items-center gap-1 text-sm text-red-700 hover:text-red-800"
            >
              <Trash2 className="w-4 h-4" />
              Revert / remove DB override
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2"
        >
          <Save className="w-4 h-4" />
          {saving
            ? "Saving…"
            : isNew
              ? `Create + generate ${pageCount} pages`
              : `Save (regenerates ${pageCount} pages)`}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
