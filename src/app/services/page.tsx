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

const services = [
  {
    icon: DoorOpen,
    title: "Emergency Lockouts",
    description:
      "Locked out of your home, office, or car? Our verified locksmiths respond in 15-30 minutes, 24/7. Non-destructive entry methods used wherever possible.",
    features: [
      "15-30 minute response time",
      "Non-destructive entry preferred",
      "Available 24/7, 365 days",
      "GPS-tracked arrival",
    ],
    price: "From £60",
    color: "bg-red-500",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
  },
  {
    icon: Lock,
    title: "Lock Replacement",
    description:
      "Upgrade or replace cylinder, mortice, and multi-point locks. We use British Standard BS3621 locks for insurance compliance.",
    features: [
      "Cylinder & mortice locks",
      "BS3621 compliant options",
      "Insurance-approved locks",
      "Same-day service available",
    ],
    price: "From £80",
    color: "bg-orange-500",
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
  },
  {
    icon: Shield,
    title: "Security Upgrades",
    description:
      "Anti-snap, anti-bump, and anti-pick lock upgrades. Protect your home with the latest high-security locking systems.",
    features: [
      "Anti-snap cylinders",
      "Anti-bump protection",
      "High-security deadlocks",
      "Security survey included",
    ],
    price: "From £90",
    color: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
  },
  {
    icon: Home,
    title: "Residential Services",
    description:
      "Complete home locksmith services including new-build lock fitting, tenant changeovers, and window lock repairs.",
    features: [
      "Tenant lock changes",
      "Window lock repairs",
      "New-build lock fitting",
      "Patio door locks",
    ],
    price: "From £70",
    color: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
  },
  {
    icon: Building2,
    title: "Commercial Locksmith",
    description:
      "Office lockouts, master key systems, access control installation, and fire door compliance. Serving businesses across the UK.",
    features: [
      "Master key systems",
      "Access control",
      "Fire door compliance",
      "Restricted key profiles",
    ],
    price: "From £100",
    color: "bg-purple-500",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
  },
  {
    icon: Car,
    title: "Auto Locksmith",
    description:
      "Car lockouts, key cutting, transponder programming, and spare key creation. Most vehicle makes and models covered.",
    features: [
      "Car lockouts",
      "Key cutting & programming",
      "Transponder keys",
      "Most makes & models",
    ],
    price: "From £80",
    color: "bg-slate-700",
    bgColor: "bg-slate-50",
    textColor: "text-slate-700",
  },
];

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
                    <Link href="/request">
                      <Button size="sm" className="btn-primary">
                        Get Help
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
