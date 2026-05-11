"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, ExternalLink } from "lucide-react";

import type { IntentLanding } from "@/lib/intent-landing";

interface Props {
  initial: IntentLanding;
  /** "db" means a DB override exists; "static" means seed-only. */
  source: "db" | "static";
  /** When true, this is a brand-new landing (POST). */
  isNew?: boolean;
}

/**
 * Single-form CMS editor for an intent landing. Stores the full content
 * object as JSON for nested blocks/faqs/serviceFilter — keeps the UI
 * tiny while letting power users tune every field. (Mademoiselle pattern.)
 */
export function IntentLandingForm({ initial, source, isNew }: Props) {
  const router = useRouter();
  const [slug, setSlug] = useState(initial.slug);
  const [title, setTitle] = useState(initial.title);
  const [pillarKeyword, setPillarKeyword] = useState(initial.pillarKeyword ?? "");
  const [intentTags, setIntentTags] = useState((initial.intentTags ?? []).join(", "));
  const [isActive, setIsActive] = useState(initial.isActive !== false);
  const [position, setPosition] = useState(String(initial.position ?? 0));
  const [intro, setIntro] = useState(initial.intro ?? "");
  const [h1, setH1] = useState(initial.h1 ?? initial.title);
  const [emotionalHook, setEmotionalHook] = useState(initial.emotionalHook ?? "");
  const [heroSubcopy, setHeroSubcopy] = useState(initial.heroSubcopy ?? "");
  const [emotionalHookB, setEmotionalHookB] = useState(initial.emotionalHookB ?? "");
  const [heroSubcopyB, setHeroSubcopyB] = useState(initial.heroSubcopyB ?? "");
  const [metaTitle, setMetaTitle] = useState(initial.metaTitle ?? "");
  const [metaDescription, setMetaDescription] = useState(initial.metaDescription ?? "");
  const [seoCopy, setSeoCopy] = useState(initial.seoCopy ?? "");
  const [heroImageUrl, setHeroImageUrl] = useState(initial.heroImageUrl ?? "");
  const [blocksJson, setBlocksJson] = useState(JSON.stringify(initial.blocks, null, 2));
  const [faqsJson, setFaqsJson] = useState(JSON.stringify(initial.faqs ?? [], null, 2));
  const [serviceFilterJson, setServiceFilterJson] = useState(
    JSON.stringify(initial.serviceFilter ?? { serviceSlugs: [] }, null, 2),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    let blocks: unknown;
    let faqs: unknown;
    let serviceFilter: unknown;
    try {
      blocks = JSON.parse(blocksJson);
      faqs = JSON.parse(faqsJson);
      serviceFilter = JSON.parse(serviceFilterJson);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      setSaving(false);
      return;
    }

    const body = {
      slug: slug.trim().toLowerCase(),
      title: title.trim(),
      pillarKeyword: pillarKeyword.trim() || undefined,
      intentTags: intentTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      isActive,
      position: Number(position) || 0,
      intro: intro.trim() || undefined,
      h1: h1.trim() || undefined,
      emotionalHook: emotionalHook.trim() || undefined,
      heroSubcopy: heroSubcopy.trim() || undefined,
      emotionalHookB: emotionalHookB.trim() || undefined,
      heroSubcopyB: heroSubcopyB.trim() || undefined,
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      seoCopy: seoCopy.trim() || undefined,
      heroImageUrl: heroImageUrl.trim() || undefined,
      blocks,
      faqs,
      serviceFilter,
    };

    const url = isNew
      ? "/api/admin/intent-landings"
      : `/api/admin/intent-landings/${initial.slug}`;
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

    router.push("/admin/seo/intents");
    router.refresh();
  }

  async function handleRevert() {
    if (
      !window.confirm(
        "Remove the DB override and revert this landing to its static-seed version?",
      )
    )
      return;
    const res = await fetch(`/api/admin/intent-landings/${initial.slug}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setError(j.error ?? `Request failed (${res.status})`);
      return;
    }
    router.push("/admin/seo/intents");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/seo/intents"
          className="text-sm text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> All landings
        </Link>
        {!isNew && (
          <a
            href={`/intent/${initial.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
          >
            View live <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          {isNew ? "New intent landing" : `Edit: ${initial.title}`}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Source:{" "}
          <span
            className={
              source === "db"
                ? "text-amber-700 font-medium"
                : "text-slate-600 font-medium"
            }
          >
            {source}
          </span>
          . Saving creates/updates a DB override; static seed remains as fallback.
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
            />
          </Field>
          <Field label="Title" required>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
          <Field label="H1">
            <input
              value={h1}
              onChange={(e) => setH1(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
          <Field label="Pillar keyword">
            <input
              value={pillarKeyword}
              onChange={(e) => setPillarKeyword(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
          <Field label="Intent tags (comma separated)">
            <input
              value={intentTags}
              onChange={(e) => setIntentTags(e.target.value)}
              className="w-full rounded-lg border-slate-300 text-sm"
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
              Active (live on /intent/[slug])
            </label>
          </Field>
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
          Hero & intro
        </legend>
        <Field label="Intro">
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={3}
            className="w-full rounded-lg border-slate-300 text-sm"
          />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Emotional hook (variant A)">
            <textarea
              value={emotionalHook}
              onChange={(e) => setEmotionalHook(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
          <Field label="Hero subcopy (variant A)">
            <textarea
              value={heroSubcopy}
              onChange={(e) => setHeroSubcopy(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
          <Field label="Emotional hook (variant B — optional A/B)">
            <textarea
              value={emotionalHookB}
              onChange={(e) => setEmotionalHookB(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
          <Field label="Hero subcopy (variant B)">
            <textarea
              value={heroSubcopyB}
              onChange={(e) => setHeroSubcopyB(e.target.value)}
              rows={2}
              className="w-full rounded-lg border-slate-300 text-sm"
            />
          </Field>
        </div>
        <Field label="Hero image URL">
          <input
            value={heroImageUrl}
            onChange={(e) => setHeroImageUrl(e.target.value)}
            className="w-full rounded-lg border-slate-300 text-sm"
          />
        </Field>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
          SEO
        </legend>
        <Field label="Meta title">
          <input
            value={metaTitle}
            onChange={(e) => setMetaTitle(e.target.value)}
            className="w-full rounded-lg border-slate-300 text-sm"
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
        <Field label="SEO body copy (long-form, optional)">
          <textarea
            value={seoCopy}
            onChange={(e) => setSeoCopy(e.target.value)}
            rows={4}
            className="w-full rounded-lg border-slate-300 text-sm"
          />
        </Field>
      </fieldset>

      <fieldset className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <legend className="px-2 text-xs uppercase tracking-wider text-slate-500">
          Structured content (JSON)
        </legend>
        <p className="text-xs text-slate-500">
          Use the existing static landing as a template. Validation runs on save.
        </p>
        <Field label="blocks (segments, trust, socialProof, relatedClusters)">
          <textarea
            value={blocksJson}
            onChange={(e) => setBlocksJson(e.target.value)}
            rows={14}
            className="w-full rounded-lg border-slate-300 text-xs font-mono"
            spellCheck={false}
          />
        </Field>
        <Field label="faqs (Array<{ question, answer }>)">
          <textarea
            value={faqsJson}
            onChange={(e) => setFaqsJson(e.target.value)}
            rows={8}
            className="w-full rounded-lg border-slate-300 text-xs font-mono"
            spellCheck={false}
          />
        </Field>
        <Field label="serviceFilter">
          <textarea
            value={serviceFilterJson}
            onChange={(e) => setServiceFilterJson(e.target.value)}
            rows={4}
            className="w-full rounded-lg border-slate-300 text-xs font-mono"
            spellCheck={false}
          />
        </Field>
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
              Revert to static seed
            </button>
          )}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : isNew ? "Create landing" : "Save changes"}
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
