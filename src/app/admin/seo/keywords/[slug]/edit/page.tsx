import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { KeywordTemplateForm } from "@/components/admin/KeywordTemplateForm";
import { loadKeywordTemplateBySlug } from "@/lib/keyword-templates-store";
import { prisma } from "@/lib/db";
import { ukCitiesData } from "@/lib/uk-cities-data";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit keyword template",
};

export default async function EditKeywordTemplatePage({ params }: Props) {
  const { slug } = await params;
  const tpl = await loadKeywordTemplateBySlug(slug);
  if (!tpl) notFound();
  const dbRow = await prisma.keywordTemplate.findUnique({ where: { slug } });

  const cities = Object.values(ukCitiesData)
    .map((c) => ({ slug: c.slug, name: c.name, region: c.region }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <KeywordTemplateForm
          initial={tpl}
          cities={cities}
          source={dbRow ? "db" : "static"}
        />
      </div>
    </AdminSidebar>
  );
}
