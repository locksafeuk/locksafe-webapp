import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SITE_NAME, getFullUrl } from "@/lib/config";
import {
  Lock,
  Home,
  Building2,
  Car,
  Shield,
  Clock,
  Key,
  DoorOpen,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Phone,
  FileCheck,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { SERVICE_CATALOG, type ServiceSlug } from "@/lib/services-catalog";

// Map each catalog slug to a display icon + colour palette for the tile.
const tileStyle: Record<ServiceSlug, { icon: typeof DoorOpen; color: string; bgColor: string; textColor: string }> = {
  "emergency-locksmith": { icon: AlertTriangle, color: "bg-red-500", bgColor: "bg-red-50", textColor: "text-red-700" },
  "locked-out": { icon: DoorOpen, color: "bg-orange-500", bgColor: "bg-orange-50", textColor: "text-orange-700" },
  "lock-change": { icon: Lock, color: "bg-amber-500", bgColor: "bg-amber-50", textColor: "text-amber-700" },
  "broken-key-extraction": { icon: Key, color: "bg-yellow-500", bgColor: "bg-yellow-50", textColor: "text-yellow-700" },
  "upvc-door-lock-repair": { icon: Wrench, color: "bg-teal-500", bgColor: "bg-teal-50", textColor: "text-teal-700" },
  "burglary-lock-repair": { icon: Shield, color: "bg-rose-600", bgColor: "bg-rose-50", textColor: "text-rose-700" },
  "car-key-replacement": { icon: Car, color: "bg-slate-700", bgColor: "bg-slate-50", textColor: "text-slate-700" },
  "safe-opening": { icon: ShieldCheck, color: "bg-indigo-600", bgColor: "bg-indigo-50", textColor: "text-indigo-700" },
  "landlord-lock-change": { icon: Home, color: "bg-blue-500", bgColor: "bg-blue-50", textColor: "text-blue-700" },
  "commercial-locksmith": { icon: Building2, color: "bg-purple-500", bgColor: "bg-purple-50", textColor: "text-purple-700" },
};

export const metadata: Metadata = {
  title: `Locksmith Services | ${SITE_NAME} - Emergency & Scheduled`,
  description:
    "Complete range of professional locksmith services across the UK. Emergency lockouts, lock replacements, security upgrades, commercial services, and more. All with transparent pricing and anti-fraud protection.",
  keywords: [
    "locksmith services UK",
    "emergency locksmith",
    "lock replacement",
    "security upgrade",
    "commercial locksmith",
    "auto locksmith",
    "24/7 locksmith",
  ],
  openGraph: {
    title: `Professional Locksmith Services | ${SITE_NAME}`,
    description:
      "Emergency lockouts, lock changes, security upgrades & more. All with transparent pricing and complete fraud protection.",
    url: getFullUrl("/services"),
  },
};

// Tiles are derived from the catalog (single source of truth). Pixel
// `content_id` === slug === Meta catalog feed id, so dynamic ads work.
const services = SERVICE_CATALOG.map((entry) => {
  const style = tileStyle[entry.id as ServiceSlug];
  return {
    slug: entry.id,
    icon: style.icon,
    title: entry.title,
    description: entry.shortDescription,
    features: entry.whatsIncluded,
    price: entry.priceHint,
    color: style.color,
    bgColor: style.bgColor,
    textColor: style.textColor,
  };
});

const guarantees = [
  {
    icon: ShieldCheck,
    title: "Verified Professionals",
    description: "Every locksmith is DBS checked, insured, and vetted.",
  },
  {
    icon: FileCheck,
    title: "Digital Paper Trail",
    description: "GPS tracking, timestamped photos, and legal PDF report.",
  },
  {
    icon: Zap,
    title: "No Hidden Fees",
    description: "See the full quote before any work begins.",
  },
  {
    icon: Clock,
    title: "Rapid Response",
    description: "15-30 minute average arrival time, 24/7.",
  },
];

export default function ServicesPage() {
  return (
    <>
      <Header />
      <main>
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-slate-50 to-white">
          <div className="section-container">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
                <Wrench className="w-4 h-4" />
                PROFESSIONAL LOCKSMITH SERVICES
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
                Every Lock Problem,{" "}
                <span className="text-orange-500">One Trusted Platform</span>
              </h1>
              <p className="text-lg text-slate-600">
                From emergency lockouts to high-security installations. Every job
                is protected by our anti-fraud system with GPS tracking, digital
                documentation, and verified professionals.
              </p>
            </div>

            {/* Services Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {services.map((service) => (
                <div
                  key={service.title}
                  className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
                >
                  <div
                    className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center mb-4`}
                  >
                    <service.icon className="w-7 h-7 text-white" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 mb-2">
                    {service.title}
                  </h2>
                  <p className="text-slate-600 mb-4 text-sm leading-relaxed">
                    {service.description}
                  </p>
                  <ul className="space-y-2 mb-4">
                    {service.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center gap-2 text-sm text-slate-700"
                      >
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <span className="text-lg font-bold text-slate-900">
                      {service.price}
                    </span>
                    <Link href={`/services/${service.slug}`}>
                      <Button size="sm" className="btn-primary">
                        Learn More
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Guarantees */}
        <section className="py-16 bg-slate-900 text-white">
          <div className="section-container">
            <h2 className="text-3xl font-bold text-center mb-12">
              Every Service Comes With
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
              Need a Locksmith Now?
            </h2>
            <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
              Get connected with a verified, local locksmith in minutes. Every job
              is fully documented and protected.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/request">
                <Button className="btn-primary px-8">
                  Get Emergency Help
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="tel:07818333989">
                <Button variant="outline" className="border-slate-300 px-8">
                  <Phone className="w-4 h-4" />
                  Call 07818 333 989
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
