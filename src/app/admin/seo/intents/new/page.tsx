import type { Metadata } from "next";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { IntentLandingForm } from "@/components/admin/IntentLandingForm";
import type { IntentLanding } from "@/lib/intent-landing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New intent landing",
};

const TEMPLATE: IntentLanding = {
  slug: "",
  title: "",
  pillarKeyword: "",
  intentTags: [],
  isActive: true,
  position: 100,
  h1: "",
  intro: "",
  emotionalHook: "",
  heroSubcopy: "",
  metaTitle: "",
  metaDescription: "",
  seoCopy: "",
  serviceFilter: { serviceSlugs: [] },
  faqs: [],
  blocks: {
    segments: [],
    aiSearchQA: [],
    trustConfidence: [],
    socialProofClusters: [],
    relatedClusters: [],
  },
};

export default function NewIntentLandingPage() {
  return (
    <AdminSidebar>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <IntentLandingForm initial={TEMPLATE} source="db" isNew />
      </div>
    </AdminSidebar>
  );
}
