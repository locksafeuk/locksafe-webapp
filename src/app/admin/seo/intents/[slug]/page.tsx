import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import {
  INTENT_LANDINGS,
  getIntentLandingBySlug,
} from "@/lib/intent-landings";
import { ukCitiesData } from "@/lib/uk-cities-data";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return INTENT_LANDINGS.map((l) => ({ slug: l.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const landing = getIntentLandingBySlug(slug);
  return { title: landing ? `${landing.title} · Intent SEO` : "Intent SEO" };
}

export default async function AdminIntentDetailPage({ params }: Props) {
  const { slug } = await params;
  const landing = getIntentLandingBySlug(slug);
  if (!landing) notFound();

  const cityCount = Object.keys(ukCitiesData).length;

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <Link
          href="/admin/seo/intents"
          className="text-sm text-amber-700 hover:text-amber-800 inline-flex items-center gap-1 mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> All intent landings
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{landing.title}</h1>
            <p className="text-slate-500 text-sm mt-1 font-mono">{landing.slug}</p>
          </div>
          <a
            href={`/intent/${landing.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold transition-colors"
          >
            Open live page <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Meta */}
        <Section title="Metadata">
          <Field label="Pillar keyword" value={landing.pillarKeyword || "—"} mono />
          <Field label="Intent tags" value={landing.intentTags.join(", ") || "—"} />
          <Field label="Meta title" value={landing.metaTitle || "—"} />
          <Field label="Meta description" value={landing.metaDescription || "—"} />
          <Field label="Status" value={landing.isActive !== false ? "Live" : "Draft"} />
        </Section>

        {/* Hero copy */}
        <Section title="Hero copy">
          <Field label="H1" value={landing.h1} />
          <Field label="Eyebrow" value={landing.eyebrow || "—"} />
          <Field label="Intro" value={landing.intro || "—"} multiline />
        </Section>

        {/* A/B */}
        <Section title="A/B emotional hook">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Variant A</p>
              <p className="text-sm font-semibold text-slate-900 mb-1">
                {landing.emotionalHook || "—"}
              </p>
              <p className="text-xs text-slate-600">{landing.heroSubcopy || "—"}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
                Variant B {landing.emotionalHookB ? "" : "(inactive)"}
              </p>
              <p className="text-sm font-semibold text-slate-900 mb-1">
                {landing.emotionalHookB || "—"}
              </p>
              <p className="text-xs text-slate-600">{landing.heroSubcopyB || "—"}</p>
            </div>
          </div>
        </Section>

        {/* Blocks summary */}
        <Section title="Blocks">
          <ul className="text-sm text-slate-700 space-y-1.5">
            <li>Segments: <strong>{landing.blocks.segments.length}</strong></li>
            <li>Trust modules: <strong>{landing.blocks.trustConfidence.length}</strong></li>
            <li>Social proof clusters: <strong>{landing.blocks.socialProofClusters.length}</strong></li>
            <li>AI-search Q&amp;A: <strong>{landing.blocks.aiSearchQA.length}</strong></li>
            <li>Related clusters: <strong>{landing.blocks.relatedClusters.length}</strong></li>
            <li>FAQs: <strong>{landing.faqs.length}</strong></li>
          </ul>
        </Section>

        {/* FAQs */}
        <Section title="FAQs">
          <ul className="space-y-2 text-sm">
            {landing.faqs.map((f, i) => (
              <li key={i} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="font-medium text-slate-900 mb-1">{f.question}</p>
                <p className="text-slate-600">{f.answer}</p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Geo coverage */}
        <Section title="Generated pages">
          <ul className="text-sm text-slate-700 space-y-1.5">
            <li>
              <a
                href={`/intent/${landing.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
              >
                /intent/{landing.slug} <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              <strong>{cityCount}</strong> geo-localised pages at{" "}
              <code className="text-amber-700">/intent/{landing.slug}/in/[city]</code>
            </li>
          </ul>
        </Section>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mt-6">
          <p className="text-sm text-slate-700">
            To edit this landing, update the matching record in{" "}
            <code className="text-amber-700">src/lib/intent-landings.ts</code> and redeploy.
          </p>
        </div>
      </div>
    </AdminSidebar>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-base font-bold text-slate-900 mb-2">{title}</h2>
      <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  multiline,
}: {
  label: string;
  value: string;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
      <p
        className={[
          "text-sm text-slate-800",
          mono ? "font-mono" : "",
          multiline ? "whitespace-pre-wrap leading-relaxed" : "",
        ].join(" ")}
      >
        {value}
      </p>
    </div>
  );
}
