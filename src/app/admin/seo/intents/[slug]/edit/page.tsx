import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { IntentLandingForm } from "@/components/admin/IntentLandingForm";
import { loadIntentLandingBySlug } from "@/lib/intent-landings-store";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit intent landing",
};

export default async function EditIntentLandingPage({ params }: Props) {
  const { slug } = await params;
  const landing = await loadIntentLandingBySlug(slug);
  if (!landing) notFound();

  const dbRow = await prisma.intentLanding.findUnique({ where: { slug } });

  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <IntentLandingForm
          initial={landing}
          source={dbRow ? "db" : "static"}
        />
      </div>
    </AdminSidebar>
  );
}
