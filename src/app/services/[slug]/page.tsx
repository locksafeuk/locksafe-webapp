import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/config";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  Phone,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  getAllServiceSlugs,
  getServiceBySlug,
  type ServiceSlug,
} from "@/lib/services-catalog";
import { ViewContentTracker } from "./ViewContentTracker";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllServiceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    return { title: `Service Not Found | ${SITE_NAME}` };
  }

  return {
    title: `${service.title} | ${SITE_NAME}`,
    description: service.shortDescription,
    keywords: service.keywords,
    alternates: { canonical: service.link },
    openGraph: {
      type: "website",
      url: service.link,
      title: `${service.title} | ${SITE_NAME}`,
      description: service.shortDescription,
      images: [{ url: service.image_link, width: 1080, height: 1080, alt: service.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${service.title} | ${SITE_NAME}`,
      description: service.shortDescription,
      images: [service.image_link],
    },
  };
}

const guarantees = [
  {
    icon: ShieldCheck,
    title: "Verified Professionals",
    description: "Every locksmith is DBS checked, insured, and vetted.",
  },
  {
    icon: FileCheck,
    title: "Digital Paper Trail",
    description: "GPS tracking, timestamped photos, and PDF report.",
  },
  {
    icon: Zap,
    title: "No Hidden Fees",
    description: "See the full quote before any work begins.",
  },
  {
    icon: Clock,
    title: "Rapid Response",
    description: "15–30 minute average arrival time, 24/7.",
  },
];

export default async function ServiceSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const service = getServiceBySlug(slug);

  if (!service) {
    notFound();
  }

  // Build a JSON-LD Service block so search engines understand the page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    serviceType: service.title,
    description: service.shortDescription,
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: "https://locksafe.uk",
    },
    areaServed: { "@type": "Country", name: "United Kingdom" },
    url: service.link,
    image: service.image_link,
    offers: {
      "@type": "Offer",
      url: service.link,
      availability: "https://schema.org/InStock",
      priceCurrency: "GBP",
      price: "0.00",
      priceSpecification: {
        "@type": "PriceSpecification",
        priceCurrency: "GBP",
        price: service.priceHint,
      },
    },
  };

  return (
    <>
      <Header />
      <ViewContentTracker slug={service.id as ServiceSlug} title={service.title} />
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted, serialized server-side
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        {/* Hero */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-slate-900 to-slate-800 text-white">
          <div className="section-container">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 rounded-full px-4 py-2 text-sm font-medium mb-6">
                {service.title.toUpperCase()}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                {service.hero}
              </h1>
              <p className="text-lg md:text-xl text-slate-200 mb-8">
                {service.subhead}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href={`/request?service=${service.id}`}>
                  <Button className="btn-primary px-8">
                    Get Help Now
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="tel:07818333989">
                  <Button variant="outline" className="border-slate-300 text-white hover:text-slate-900 px-8">
                    <Phone className="w-4 h-4" />
                    Call 07818 333 989
                  </Button>
                </a>
              </div>
              <div className="mt-6 text-sm text-slate-300">
                Indicative pricing: <span className="font-semibold text-white">{service.priceHint}</span>
                {" · "}quote agreed before any work starts.
              </div>
            </div>
          </div>
        </section>

        {/* Body copy + what's included */}
        <section className="py-16 bg-white">
          <div className="section-container">
            <div className="grid md:grid-cols-2 gap-12">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4">
                  How LockSafe handles {service.title.toLowerCase()}
                </h2>
                {service.longDescription.map((para, i) => (
                  <p key={i} className="text-slate-600 mb-4 leading-relaxed">
                    {para}
                  </p>
                ))}
              </div>
              <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200">
                <h3 className="text-xl font-bold text-slate-900 mb-4">
                  What's included
                </h3>
                <ul className="space-y-3">
                  {service.whatsIncluded.map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <Link href={`/request?service=${service.id}`} className="block mt-6">
                  <Button className="btn-primary w-full">
                    Post Your Job
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Guarantees */}
        <section className="py-16 bg-slate-900 text-white">
          <div className="section-container">
            <h2 className="text-3xl font-bold text-center mb-12">
              Every job comes with
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {guarantees.map((item) => (
                <div key={item.title} className="text-center">
                  <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-lg mb-2">{item.title}</h3>
                  <p className="text-slate-400 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 md:py-24 bg-white">
          <div className="section-container text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              Ready to get this sorted?
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Post your job in 60 seconds. Verified locksmiths quote you upfront — you choose who, when, and at what price.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href={`/request?service=${service.id}`}>
                <Button className="btn-primary px-8">
                  Get Help Now
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link href="/services">
                <Button variant="outline" className="border-slate-300 px-8">
                  Browse all services
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
