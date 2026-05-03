import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { AiSummaryBlock } from "@/components/services/AiSummaryBlock";
import { ComparisonTable } from "@/components/services/ComparisonTable";
import { FaqAccordion } from "@/components/services/FaqAccordion";
import { FinalCtaBlock } from "@/components/services/FinalCtaBlock";
import { HowItWorksTimeline } from "@/components/services/HowItWorksTimeline";
import { KeyFactsStrip } from "@/components/services/KeyFactsStrip";
import { PainAgitateBlock } from "@/components/services/PainAgitateBlock";
import { RelatedServices } from "@/components/services/RelatedServices";
import { RiskReversalBanner } from "@/components/services/RiskReversalBanner";
import { ServiceBreadcrumbs } from "@/components/services/ServiceBreadcrumbs";
import { ServiceHero } from "@/components/services/ServiceHero";
import { SocialProofGrid } from "@/components/services/SocialProofGrid";
import { StickyMobileCta } from "@/components/services/StickyMobileCta";
import { ValueStackList } from "@/components/services/ValueStackList";
import { SITE_NAME } from "@/lib/config";
import {
  buildBreadcrumbJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
  buildServiceJsonLd,
  buildSpeakableJsonLd,
} from "@/lib/service-jsonld";
import {
  type ServiceSlug,
  getAllServiceSlugs,
  getServiceBySlug,
} from "@/lib/services-catalog";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ViewContentTracker } from "./ViewContentTracker";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    return { title: `Service Not Found | ${SITE_NAME}` };
  }

  const title = `${service.title} | ${SITE_NAME} – Verified, DBS-Checked`;

  return {
    title,
    description: service.shortDescription,
    keywords: service.keywords,
    alternates: { canonical: service.link },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-snippet": -1,
        "max-image-preview": "large",
        "max-video-preview": -1,
      },
    },
    openGraph: {
      type: "website",
      url: service.link,
      siteName: SITE_NAME,
      title,
      description: service.shortDescription,
      images: [
        {
          url: service.image_link,
          width: 1080,
          height: 1080,
          alt: service.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: service.shortDescription,
      images: [service.image_link],
    },
    other: {
      "article:section": "Locksmith Services",
    },
  };
}

export default async function ServiceSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  const serviceLd = buildServiceJsonLd(service);
  const faqLd = buildFaqJsonLd(service);
  const breadcrumbLd = buildBreadcrumbJsonLd(service);
  const speakableLd = buildSpeakableJsonLd(service.link);
  const howToLd = buildHowToJsonLd(service);

  return (
    <>
      <Header />
      <ViewContentTracker
        slug={service.id as ServiceSlug}
        title={service.title}
      />

      {/* JSON-LD: Service + FAQ + Breadcrumb + Speakable (+ optional HowTo) */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
        dangerouslySetInnerHTML={{ __html: JSON.stringify(speakableLd) }}
      />
      {howToLd && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, server-serialized
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToLd) }}
        />
      )}

      <main className="pb-24 md:pb-0">
        <ServiceBreadcrumbs title={service.title} />
        <ServiceHero service={service} />
        <KeyFactsStrip service={service} />
        <AiSummaryBlock service={service} />
        <PainAgitateBlock service={service} />

        {/* Long-form explainer */}
        <article aria-labelledby="explain-heading" className="py-16 bg-white">
          <div className="section-container">
            <div className="max-w-3xl">
              <h2
                id="explain-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-6"
              >
                How LockSafe handles {service.title.toLowerCase()}
              </h2>
              {service.longDescription.map((para) => (
                <p
                  key={para.slice(0, 40)}
                  className="text-slate-700 mb-4 leading-relaxed text-lg"
                >
                  {para}
                </p>
              ))}
            </div>
          </div>
        </article>

        <ValueStackList service={service} />
        <HowItWorksTimeline service={service} />
        <ComparisonTable service={service} />
        <SocialProofGrid service={service} />
        <RiskReversalBanner service={service} />
        <FaqAccordion service={service} />
        <RelatedServices service={service} />
        <FinalCtaBlock service={service} />
      </main>

      <Footer />
      <StickyMobileCta serviceId={service.id} />
    </>
  );
}
