import { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import {
  postcodeData,
  getAllPostcodes,
  generateLocalFAQ,
  generateLocalBusinessSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
  generateHowToSchema,
  getLocalServices,
  type PostcodeData,
} from "@/lib/postcode-data";
import {
  ArrowRight,
  Shield,
  Clock,
  MapPin,
  Star,
  Phone,
  CheckCircle2,
  Key,
  Lock,
  Wrench,
  Building,
  Car,
  Home,
  BadgeCheck,
  FileText,
  CreditCard,
  MessageCircle,
} from "lucide-react";

type Props = {
  params: Promise<{ slug: string }>;
};

// Get postcode data from slug
function getPostcodeFromSlug(slug: string): PostcodeData | undefined {
  const postcode = slug.split("-")[0]?.toLowerCase();
  return postcodeData[postcode];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = getPostcodeFromSlug(slug);

  if (!data) {
    return {
      title: "Location Not Found | LockSafe UK",
    };
  }

  const title = `Emergency Locksmith ${data.postcode} ${data.area} | 24/7 Service | ${SITE_NAME}`;
  const description = `Need an emergency locksmith in ${data.postcode} ${data.area}? LockSafe provides 24/7 verified locksmiths covering ${data.neighborhoods.slice(0, 5).join(", ")} with transparent pricing, GPS tracking & anti-fraud protection. Average response: ${data.avgResponseTime}.`;

  return {
    title,
    description,
    keywords: [
      `locksmith ${data.postcode}`,
      `emergency locksmith ${data.area.toLowerCase()}`,
      `locksmith ${data.mainTown.toLowerCase()}`,
      `24 hour locksmith ${data.postcode}`,
      `locksmith near me ${data.area.toLowerCase()}`,
      `locked out ${data.area.toLowerCase()}`,
      `lock repair ${data.postcode}`,
      ...data.neighborhoods.slice(0, 5).map((n) => `locksmith ${n.toLowerCase()}`),
    ],
    openGraph: {
      title: `Emergency Locksmith ${data.postcode} ${data.area} | ${SITE_NAME}`,
      description: `24/7 verified locksmiths in ${data.postcode} ${data.area}, ${data.county}. ${data.avgResponseTime} response. Transparent pricing & anti-fraud protection.`,
      url: `${SITE_URL}/emergency-locksmith-${slug}`,
      type: "website",
      locale: "en_GB",
    },
    twitter: {
      card: "summary_large_image",
      title: `Emergency Locksmith ${data.postcode} ${data.area}`,
      description: `24/7 verified locksmiths in ${data.area}. ${data.avgResponseTime} response.`,
    },
    alternates: {
      canonical: `${SITE_URL}/emergency-locksmith-${slug}`,
    },
  };
}

export async function generateStaticParams() {
  const postcodes = getAllPostcodes();
  return postcodes.map((postcode) => ({
    slug: postcodeData[postcode].slug,
  }));
}

// Icon map for services
const serviceIcons: Record<string, typeof Key> = {
  key: Key,
  lock: Lock,
  wrench: Wrench,
  shield: Shield,
  building: Building,
  car: Car,
};

export default async function EmergencyLocksmithPage({ params }: Props) {
  const { slug } = await params;
  const data = getPostcodeFromSlug(slug);

  if (!data) {
    notFound();
  }

  const faqs = generateLocalFAQ(data);
  const services = getLocalServices();
  const localBusinessSchema = generateLocalBusinessSchema(data, SITE_URL);
  const faqSchema = generateFAQSchema(data);
  const breadcrumbSchema = generateBreadcrumbSchema(data, SITE_URL);
  const howToSchema = generateHowToSchema(data);

  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
      />

      <Header />

      <main>
        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-16 md:py-24 overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          <div className="section-container relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                {/* Breadcrumb */}
                <nav className="flex items-center gap-2 text-sm text-slate-400 mb-6">
                  <Link href="/" className="hover:text-white transition-colors">Home</Link>
                  <span>/</span>
                  <Link href="/request" className="hover:text-white transition-colors">Locksmith Services</Link>
                  <span>/</span>
                  <span className="text-orange-400">{data.area}</span>
                </nav>

                <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-2 text-sm text-orange-300 mb-6">
                  <MapPin className="w-4 h-4" />
                  Covering {data.postcode} • {data.district}, {data.county}
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                  Emergency Locksmith
                  <br />
                  <span className="text-orange-500">{data.postcode} {data.area}</span>
                </h1>

                <p className="text-xl text-slate-300 mb-8 max-w-2xl">
                  Locked out in {data.area}? Our verified locksmiths know {data.description} inside out.
                  Get help in <span className="text-orange-400 font-semibold">{data.avgResponseTime}</span> with
                  complete anti-fraud protection and transparent pricing.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 mb-8">
                  <Link href="/request">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg rounded-full w-full sm:w-auto">
                      Get Emergency Help Now
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                  <a href="tel:07818333989">
                    <Button className="bg-white text-slate-900 hover:bg-slate-100 px-8 py-6 text-lg rounded-full w-full sm:w-auto border-0">
                      <Phone className="w-5 h-5 mr-2" />
                      07818 333 989
                    </Button>
                  </a>
                </div>

                {/* Trust Indicators */}
                <div className="flex flex-wrap gap-6 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    {data.avgResponseTime} response
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-orange-500" />
                    Anti-Fraud Protected
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                    4.9/5 Rating (847 reviews)
                  </div>
                </div>
              </div>

              {/* Quick Info Card */}
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                <h3 className="text-xl font-bold mb-4">Quick Facts for {data.postcode}</h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium">Average Response Time</p>
                      <p className="text-slate-400">{data.avgResponseTime} to {data.area}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium">Areas Covered</p>
                      <p className="text-slate-400">{data.neighborhoods.slice(0, 3).join(", ")}, + more</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Home className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <p className="font-medium">Population</p>
                      <p className="text-slate-400">Serving {data.population} residents</p>
                    </div>
                  </div>
                  {data.trainStations.length > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building className="w-4 h-4 text-orange-400" />
                      </div>
                      <div>
                        <p className="font-medium">Transport Links</p>
                        <p className="text-slate-400">{data.trainStations.slice(0, 2).join(", ")}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Local Tips */}
                <div className="mt-6 pt-6 border-t border-white/10">
                  <p className="text-sm text-orange-400 font-medium mb-2">Our locksmiths know:</p>
                  <ul className="space-y-1 text-sm text-slate-300">
                    {data.localTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Neighborhoods Covered */}
        <section className="py-16 bg-white">
          <div className="section-container">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Areas We Cover in {data.postcode}
            </h2>
            <p className="text-slate-600 mb-8 max-w-2xl">
              Our verified locksmiths provide 24/7 emergency services across all neighborhoods
              in {data.area} and the surrounding {data.district} area.
            </p>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {data.neighborhoods.map((area) => (
                <div
                  key={area}
                  className="bg-slate-50 rounded-xl px-4 py-3 hover:bg-orange-50 hover:border-orange-200 border border-transparent transition-all"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    <span className="font-medium text-slate-700">{area}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Nearby Postcodes */}
            {data.nearbyPostcodes.length > 0 && (
              <div className="mt-8 pt-8 border-t border-slate-200">
                <p className="text-slate-600 mb-4">
                  Also serving nearby postcodes:
                </p>
                <div className="flex flex-wrap gap-3">
                  {data.nearbyPostcodes.map((pc) => {
                    const nearbyData = postcodeData[pc.toLowerCase()];
                    if (!nearbyData) return null;
                    return (
                      <Link
                        key={pc}
                        href={`/emergency-locksmith-${nearbyData.slug}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-orange-100 rounded-full text-sm font-medium text-slate-700 hover:text-orange-700 transition-colors"
                      >
                        {pc} - {nearbyData.area}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Services Section */}
        <section className="py-16 bg-slate-50">
          <div className="section-container">
            <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">
              Locksmith Services in {data.postcode}
            </h2>
            <p className="text-slate-600 mb-12 text-center max-w-2xl mx-auto">
              Professional locksmith services available 24/7 across {data.area} and {data.county}.
              All work documented with our anti-fraud system.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service) => {
                const Icon = serviceIcons[service.icon] || Key;
                return (
                  <div
                    key={service.title}
                    className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-slate-100"
                  >
                    <div className="w-14 h-14 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                      <Icon className="w-7 h-7 text-orange-600" />
                    </div>
                    <h3 className="font-bold text-lg mb-2 text-slate-900">{service.title}</h3>
                    <p className="text-slate-600">{service.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 bg-white">
          <div className="section-container">
            <h2 className="text-3xl font-bold text-slate-900 mb-4 text-center">
              Why Choose LockSafe in {data.postcode}?
            </h2>
            <p className="text-slate-600 mb-12 text-center max-w-2xl mx-auto">
              The UK's only locksmith platform with complete anti-fraud protection.
              Every job is documented for your security.
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BadgeCheck className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">Verified Locksmiths</h3>
                <p className="text-slate-600 text-sm">
                  All {data.area} locksmiths are DBS-checked and insured before joining our platform.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">Digital Documentation</h3>
                <p className="text-slate-600 text-sm">
                  GPS tracking, timestamped photos, and digital signatures for every job.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">Transparent Pricing</h3>
                <p className="text-slate-600 text-sm">
                  See quotes before work begins. No hidden fees. Accept or decline any quote.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-bold text-lg mb-2">24/7 Support</h3>
                <p className="text-slate-600 text-sm">
                  Real help anytime. Our team monitors every job in {data.postcode} around the clock.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Local Landmarks */}
        {data.landmarks.length > 0 && (
          <section className="py-16 bg-slate-50">
            <div className="section-container">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">
                Locksmiths Near {data.area} Landmarks
              </h2>
              <p className="text-slate-600 mb-8 max-w-2xl">
                Our locksmiths are familiar with all areas of {data.postcode}, from residential streets
                to these well-known {data.area} locations.
              </p>

              <div className="flex flex-wrap gap-3">
                {data.landmarks.map((landmark) => (
                  <span
                    key={landmark}
                    className="px-4 py-2 bg-white rounded-full text-sm font-medium text-slate-700 border border-slate-200"
                  >
                    {landmark}
                  </span>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* FAQ Section */}
        <section className="py-16 bg-white">
          <div className="section-container">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
                Locksmith {data.postcode} {data.area} FAQ
              </h2>

              <div className="space-y-6">
                {faqs.map((faq, index) => (
                  <div key={index} className="border-b border-slate-200 pb-6">
                    <h3 className="font-semibold text-lg mb-2 text-slate-900">
                      {faq.question}
                    </h3>
                    <p className="text-slate-600">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 bg-gradient-to-r from-orange-500 to-orange-600">
          <div className="section-container text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Need a Locksmith in {data.postcode} {data.area}?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
              Get help from a verified locksmith in {data.avgResponseTime}. 24/7 availability
              across {data.emergencyContext}.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/request">
                <Button className="bg-white text-orange-600 hover:bg-slate-100 px-8 py-6 text-lg rounded-full">
                  Get Emergency Help Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="tel:07818333989">
                <Button className="bg-slate-900 text-white hover:bg-slate-800 px-8 py-6 text-lg rounded-full border-0">
                  <Phone className="w-5 h-5 mr-2" />
                  07818 333 989
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
