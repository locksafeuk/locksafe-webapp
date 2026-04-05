import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SITE_URL } from "@/lib/config";
import {
  ukCitiesData,
  getAllCitySlugs,
  getCityBySlug,
  generateCityFAQ,
  generateCitySchema,
  generateCityFAQSchema,
  generateCityBreadcrumbSchema,
  generateCityServiceSchema,
  getNearbyCities,
} from "@/lib/uk-cities-data";
import { postcodeData } from "@/lib/postcode-data";
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
  AlertTriangle,
  Users,
  FileText,
  Navigation,
  BadgeCheck,
  Banknote,
  MessageCircle,
} from "lucide-react";

type Props = {
  params: Promise<{ city: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const cityData = getCityBySlug(city);

  if (!cityData) {
    return {
      title: "Locksmith Services | LockSafe UK",
      description: "24/7 Emergency locksmith services across the UK.",
    };
  }

  const title = `Emergency Locksmith ${cityData.name} | 24/7 Service | Call 07818 333 989`;
  const description = `Need an emergency locksmith in ${cityData.name}? LockSafe UK provides 24/7 verified locksmiths in ${cityData.areas.slice(0, 5).join(", ")} & all ${cityData.region}. Average ${cityData.avgResponseTime} response. DBS checked, insured, anti-fraud protected.`;

  return {
    title,
    description,
    keywords: [
      `locksmith ${cityData.name.toLowerCase()}`,
      `emergency locksmith ${cityData.name.toLowerCase()}`,
      `24 hour locksmith ${cityData.name.toLowerCase()}`,
      `locksmith near me ${cityData.name.toLowerCase()}`,
      `locked out ${cityData.name.toLowerCase()}`,
      `lock repair ${cityData.name.toLowerCase()}`,
      `lock change ${cityData.name.toLowerCase()}`,
      `upvc lock repair ${cityData.name.toLowerCase()}`,
      `emergency locksmith ${cityData.region.toLowerCase()}`,
      ...cityData.areas.slice(0, 5).map(area => `locksmith ${area.toLowerCase()}`),
    ],
    openGraph: {
      title: `Emergency Locksmith ${cityData.name} | LockSafe UK`,
      description: `24/7 verified locksmiths in ${cityData.name}. ${cityData.avgResponseTime} response, transparent pricing, GPS tracking & anti-fraud protection.`,
      url: `${SITE_URL}/locksmith-${city}`,
      siteName: "LockSafe UK",
      type: "website",
      locale: "en_GB",
    },
    twitter: {
      card: "summary_large_image",
      title: `Emergency Locksmith ${cityData.name} | LockSafe UK`,
      description: `24/7 verified locksmiths in ${cityData.name}. ${cityData.avgResponseTime} response time.`,
    },
    alternates: {
      canonical: `${SITE_URL}/locksmith-${city}`,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

export async function generateStaticParams() {
  return getAllCitySlugs().map((city) => ({ city }));
}

export default async function CityPage({ params }: Props) {
  const { city } = await params;
  const cityData = getCityBySlug(city);

  if (!cityData) {
    return (
      <>
        <Header />
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">City not found</h1>
            <Link href="/">
              <Button>Return Home</Button>
            </Link>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  // Generate all schema data
  const localBusinessSchema = generateCitySchema(cityData, SITE_URL);
  const faqSchema = generateCityFAQSchema(cityData);
  const breadcrumbSchema = generateCityBreadcrumbSchema(cityData, SITE_URL);
  const serviceSchema = generateCityServiceSchema(cityData, SITE_URL);
  const faqs = generateCityFAQ(cityData);
  const nearbyCities = getNearbyCities(city);

  // Find related postcode pages for this city/region
  const relatedPostcodes = Object.entries(postcodeData)
    .filter(([_, data]) =>
      data.county.toLowerCase().includes(cityData.region.toLowerCase()) ||
      cityData.region.toLowerCase().includes(data.county.toLowerCase())
    )
    .slice(0, 8);

  // Services offered
  const services = [
    {
      icon: Key,
      title: "Emergency Lockout",
      description: `Locked out in ${cityData.name}? We'll get you back inside safely within ${cityData.avgResponseTime}.`,
    },
    {
      icon: Lock,
      title: "Lock Replacement",
      description: "British Standard locks for insurance compliance. All major brands supplied and fitted.",
    },
    {
      icon: Wrench,
      title: "Lock Repair",
      description: "UPVC mechanism repairs, euro cylinder replacement, multipoint lock fixes.",
    },
    {
      icon: Shield,
      title: "Security Upgrades",
      description: "Window locks, door chains, smart locks, and comprehensive security assessments.",
    },
    {
      icon: Building,
      title: "Commercial",
      description: "Office lockouts, access control, master key suites, and safe services.",
    },
    {
      icon: Car,
      title: "Auto Locksmith",
      description: "Car lockouts, key cutting, and transponder programming for most vehicles.",
    },
  ];

  // Trust signals
  const trustSignals = [
    { icon: BadgeCheck, text: "All locksmiths DBS checked" },
    { icon: Shield, text: "Fully insured & verified" },
    { icon: Banknote, text: "No hidden fees - transparent pricing" },
    { icon: Navigation, text: "GPS tracked for your safety" },
    { icon: FileText, text: "Digital job reports provided" },
    { icon: Users, text: "4.9/5 from 1,200+ reviews" },
  ];

  return (
    <>
      {/* Structured Data for SEO */}
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />

      <Header />

      <main itemScope itemType="https://schema.org/LocalBusiness">
        <meta itemProp="name" content={`LockSafe ${cityData.name}`} />
        <meta itemProp="telephone" content="+44 7818 333 989" />

        {/* Hero Section */}
        <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-16 md:py-24 overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 -right-40 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-500/5 rounded-full blur-3xl" />
          </div>

          <div className="section-container relative">
            <div className="max-w-4xl">
              {/* Breadcrumb */}
              <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="flex items-center gap-2 text-sm text-slate-400" itemScope itemType="https://schema.org/BreadcrumbList">
                  <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                    <Link href="/" itemProp="item" className="hover:text-white transition-colors">
                      <span itemProp="name">Home</span>
                    </Link>
                    <meta itemProp="position" content="1" />
                  </li>
                  <li className="text-slate-600">/</li>
                  <li itemProp="itemListElement" itemScope itemType="https://schema.org/ListItem">
                    <span itemProp="name" className="text-orange-400">Locksmith {cityData.name}</span>
                    <meta itemProp="position" content="2" />
                  </li>
                </ol>
              </nav>

              {/* Location Badge */}
              <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-4 py-2 text-sm text-orange-300 mb-6">
                <MapPin className="w-4 h-4" />
                <span>Serving {cityData.name} &amp; {cityData.region}</span>
              </div>

              {/* Main Heading - H1 */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                Emergency Locksmith
                <br />
                <span className="text-orange-500" itemProp="areaServed">{cityData.name}</span>
              </h1>

              {/* Subheading */}
              <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-2xl leading-relaxed">
                Locked out in {cityData.name}? Get instant help from <strong>verified, DBS-checked locksmiths</strong> across {cityData.description}.
                24/7 availability, transparent pricing, and complete anti-fraud protection.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <Link href="/request">
                  <Button className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 text-white px-8 py-6 text-lg rounded-full shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/30">
                    Get Emergency Help Now
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <a href="tel:07818333989">
                  <Button variant="outline" className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg rounded-full backdrop-blur-sm">
                    <Phone className="w-5 h-5 mr-2" />
                    07818 333 989
                  </Button>
                </a>
              </div>

              {/* Quick Stats */}
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 backdrop-blur-sm">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span>{cityData.avgResponseTime} avg. response</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 backdrop-blur-sm">
                  <Shield className="w-4 h-4 text-orange-500" />
                  <span>Anti-Fraud Protected</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 backdrop-blur-sm">
                  <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                  <span>4.9/5 Rating</span>
                </div>
                <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-2 backdrop-blur-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>DBS Checked</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Signals Bar */}
        <section className="bg-slate-50 border-y border-slate-200 py-6">
          <div className="section-container">
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-4">
              {trustSignals.map((signal, i) => (
                <div key={i} className="flex items-center gap-2 text-sm text-slate-700">
                  <signal.icon className="w-4 h-4 text-orange-500" />
                  <span>{signal.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Emergency Alert */}
        <section className="py-6 bg-amber-50 border-b border-amber-200">
          <div className="section-container">
            <div className="flex items-center justify-center gap-4 text-amber-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <p className="text-center">
                <strong>Locked out right now?</strong> Our {cityData.name} locksmiths are standing by 24/7.
                <a href="tel:07818333989" className="underline font-semibold ml-1 hover:text-amber-900">
                  Call 07818 333 989
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* Areas Covered Section */}
        <section className="py-16 md:py-20 bg-white">
          <div className="section-container">
            <header className="mb-10">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Areas We Cover in {cityData.name}
              </h2>
              <p className="text-lg text-slate-600 max-w-3xl">
                Our network of verified locksmiths provides 24/7 emergency services across all areas of {cityData.name} and the wider {cityData.region} region.
                No matter where you are, help is just minutes away.
              </p>
            </header>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
              {cityData.areas.map((area) => (
                <article
                  key={area}
                  className="bg-slate-50 rounded-xl px-4 py-3 text-center hover:bg-orange-50 hover:text-orange-700 transition-colors border border-slate-100 hover:border-orange-200"
                >
                  <MapPin className="w-4 h-4 mx-auto mb-1 text-orange-500" />
                  <span className="font-medium text-sm">{area}</span>
                </article>
              ))}
            </div>

            {/* Postcode Areas */}
            <div className="bg-slate-100 rounded-2xl p-6">
              <h3 className="font-semibold text-lg mb-3 text-slate-900">
                Postcode Areas Covered
              </h3>
              <div className="flex flex-wrap gap-2">
                {cityData.postcodeAreas.map((pc) => (
                  <span key={pc} className="bg-white px-3 py-1 rounded-full text-sm font-medium text-slate-700 border border-slate-200">
                    {pc}
                  </span>
                ))}
                {cityData.nearbyPostcodes.slice(0, 5).map((pc) => (
                  <span key={pc} className="bg-slate-200 px-3 py-1 rounded-full text-sm font-medium text-slate-600">
                    {pc}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Services Section */}
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="section-container">
            <header className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Locksmith Services in {cityData.name}
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                From emergency lockouts to security upgrades, our verified {cityData.name} locksmiths handle all your security needs.
              </p>
            </header>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.map((service, i) => (
                <article key={i} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow border border-slate-100">
                  <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-4">
                    <service.icon className="w-6 h-6 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-lg mb-2 text-slate-900">{service.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{service.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Why Choose Us */}
        <section className="py-16 md:py-20 bg-white">
          <div className="section-container">
            <header className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Why Choose LockSafe in {cityData.name}?
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                We're not just another locksmith service. We're your protection against locksmith fraud.
              </p>
            </header>

            <div className="grid md:grid-cols-3 gap-8">
              <article className="text-center p-6">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Clock className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-bold text-xl mb-3">Fastest Response in {cityData.name}</h3>
                <p className="text-slate-600 leading-relaxed">
                  Our network of verified locksmiths across {cityData.name} ensures you get help within {cityData.avgResponseTime}, day or night.
                  {cityData.localTips[0]}.
                </p>
              </article>

              <article className="text-center p-6">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Shield className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-bold text-xl mb-3">Complete Anti-Fraud Protection</h3>
                <p className="text-slate-600 leading-relaxed">
                  Every job is documented with GPS tracking, timestamped before/after photos, and digital signatures.
                  Your protection against price disputes and rogue traders.
                </p>
              </article>

              <article className="text-center p-6">
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="font-bold text-xl mb-3">Verified {cityData.name} Locksmiths</h3>
                <p className="text-slate-600 leading-relaxed">
                  All our {cityData.name} locksmiths are DBS checked, fully insured, and verified before joining our platform.
                  See their ratings and reviews before booking.
                </p>
              </article>
            </div>

            {/* Local expertise */}
            <div className="mt-12 bg-slate-50 rounded-2xl p-8">
              <h3 className="font-bold text-xl mb-4 text-center">Local {cityData.name} Expertise</h3>
              <div className="grid md:grid-cols-3 gap-6">
                {cityData.localTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span className="text-slate-700">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 md:py-20 bg-slate-900 text-white">
          <div className="section-container">
            <header className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                How LockSafe Works in {cityData.name}
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Get help from a verified locksmith in 3 simple steps
              </p>
            </header>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">1</div>
                <h3 className="font-bold text-xl mb-3">Request Help</h3>
                <p className="text-slate-400">
                  Tell us your {cityData.name} location and what you need. It takes 30 seconds.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">2</div>
                <h3 className="font-bold text-xl mb-3">Compare Quotes</h3>
                <p className="text-slate-400">
                  Verified {cityData.name} locksmiths apply with their assessment fee. Choose the best fit.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center mx-auto mb-6 text-2xl font-bold">3</div>
                <h3 className="font-bold text-xl mb-3">Track & Get In</h3>
                <p className="text-slate-400">
                  Track your locksmith via GPS. Get in safely with documented job protection.
                </p>
              </div>
            </div>

            <div className="text-center mt-12">
              <Link href="/request">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-6 text-lg rounded-full">
                  Get Emergency Help in {cityData.name}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Related Postcode Pages */}
        {relatedPostcodes.length > 0 && (
          <section className="py-16 md:py-20 bg-white">
            <div className="section-container">
              <header className="mb-10">
                <h2 className="text-3xl font-bold text-slate-900 mb-4">
                  Local Area Locksmith Pages
                </h2>
                <p className="text-lg text-slate-600">
                  Find locksmith services for specific postcode areas in {cityData.region}
                </p>
              </header>

              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4">
                {relatedPostcodes.map(([_, data]) => (
                  <Link
                    key={data.slug}
                    href={`/emergency-locksmith-${data.slug}`}
                    className="bg-slate-50 rounded-xl p-4 hover:bg-orange-50 hover:border-orange-200 transition-colors border border-slate-100 group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="w-4 h-4 text-orange-500" />
                      <span className="font-bold text-orange-600">{data.postcode}</span>
                    </div>
                    <h3 className="font-medium text-slate-900 group-hover:text-orange-700">
                      {data.area}
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">{data.mainTown}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Nearby Cities */}
        {nearbyCities.length > 0 && (
          <section className="py-12 bg-slate-50 border-t border-slate-200">
            <div className="section-container">
              <h2 className="text-xl font-bold text-slate-900 mb-6">
                Also Serving Nearby
              </h2>
              <div className="flex flex-wrap gap-3">
                {nearbyCities.map((nearbyCity) => (
                  <Link
                    key={nearbyCity.slug}
                    href={`/locksmith-${nearbyCity.slug}`}
                    className="bg-white px-4 py-2 rounded-full text-sm font-medium text-slate-700 hover:text-orange-600 hover:bg-orange-50 transition-colors border border-slate-200"
                  >
                    Locksmith {nearbyCity.name}
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-16 md:py-20 bg-gradient-to-r from-orange-500 to-orange-600">
          <div className="section-container text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Need a Locksmith in {cityData.name}?
            </h2>
            <p className="text-xl text-white/90 mb-8 max-w-xl mx-auto">
              Get help from a verified, DBS-checked locksmith within {cityData.avgResponseTime}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/request">
                <Button className="bg-white text-orange-600 hover:bg-slate-100 px-10 py-6 text-lg rounded-full shadow-lg">
                  Get Emergency Help Now
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="tel:07818333989">
                <Button variant="outline" className="border-white text-white hover:bg-white/10 px-10 py-6 text-lg rounded-full">
                  <Phone className="w-5 h-5 mr-2" />
                  Call Now
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 md:py-20 bg-white" itemScope itemType="https://schema.org/FAQPage">
          <div className="section-container">
            <header className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Locksmith {cityData.name} FAQ
              </h2>
              <p className="text-lg text-slate-600">
                Common questions about our locksmith services in {cityData.name}
              </p>
            </header>

            <div className="max-w-3xl mx-auto space-y-6">
              {faqs.map((faq, i) => (
                <article
                  key={i}
                  className="border-b border-slate-200 pb-6 last:border-0"
                  itemScope
                  itemProp="mainEntity"
                  itemType="https://schema.org/Question"
                >
                  <h3 className="font-semibold text-lg mb-3 text-slate-900" itemProp="name">
                    {faq.question}
                  </h3>
                  <div itemScope itemProp="acceptedAnswer" itemType="https://schema.org/Answer">
                    <p className="text-slate-600 leading-relaxed" itemProp="text">
                      {faq.answer}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-12 bg-slate-900 text-white">
          <div className="section-container">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h2 className="text-2xl font-bold mb-2">
                  Ready for Help in {cityData.name}?
                </h2>
                <p className="text-slate-400">
                  Verified locksmiths. Transparent pricing. No hidden fees.
                </p>
              </div>
              <div className="flex gap-4">
                <Link href="/request">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-full">
                    Request Locksmith
                  </Button>
                </Link>
                <a href="tel:07818333989">
                  <Button variant="outline" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 rounded-full">
                    <Phone className="w-4 h-4 mr-2" />
                    Call Us
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
