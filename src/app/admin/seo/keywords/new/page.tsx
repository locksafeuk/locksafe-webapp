import type { Metadata } from "next";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { KeywordTemplateForm } from "@/components/admin/KeywordTemplateForm";
import { ukCitiesData } from "@/lib/uk-cities-data";
import type { KeywordTemplate } from "@/lib/keyword-templates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New keyword template",
};

const TEMPLATE: KeywordTemplate = {
  slug: "",
  label: "",
  pillarKeyword: "",
  intentTags: [],
  isActive: true,
  position: 100,
  citiesMode: "all",
  selectedCities: [],
  content: {
    metaTitle: "",
    metaDescription: "",
    h1: "",
    intro: "",
    emotionalHook: "",
    heroSubcopy: "",
    seoCopy: "",
    ctaLabel: "",
    trustBullets: [],
    faqs: [],
  },
};

export default function NewKeywordTemplatePage() {
  const cities = Object.values(ukCitiesData)
    .map((c) => ({ slug: c.slug, name: c.name, region: c.region }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <KeywordTemplateForm initial={TEMPLATE} cities={cities} source="db" isNew />
      </div>
    </AdminSidebar>
  );
}
