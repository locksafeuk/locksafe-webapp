import { Metadata } from "next";
import Link from "next/link";
import { SITE_URL, SITE_NAME } from "@/lib/config";
import {
  Phone,
  Clock,
  Shield,
  Star,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Lock,
  Key,
  AlertTriangle,
  Zap,
  BadgeCheck,
  Users,
  MessageCircle,
  Camera,
  CreditCard,
  ThumbsUp,
  Award,
  Car,
  Home,
  Building2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

// Rickmansworth-specific data
const RICKY_DATA = {
  postcode: "WD3",
  area: "Rickmansworth",
  county: "Hertfordshire",
  district: "Three Rivers",
  population: "85,000+",
  avgResponseTime: "15-30 minutes",
  neighborhoods: [
    "Rickmansworth Town Centre",
    "Chorleywood",
    "Croxley Green",
    "Mill End",
    "Loudwater",
    "Maple Cross",
    "Sarratt",
    "Batchworth",
    "Chenies",
    "West Hyde",
    "Chandler's Cross",
    "Heronsgate",
  ],
  landmarks: [
    "Rickmansworth Aquadrome",
    "Chorleywood Common",
    "Chess Valley Walk",
    "The Bury",
    "Croxley Green Common",
    "Rickmansworth High Street",
  ],
};

// SEO Metadata - Full optimization for Google Ads landing page
export const metadata: Metadata = {
  title: `Locksmith Rickmansworth | 24/7 Emergency | Fast Response | WD3`,
  description: `Locked out in Rickmansworth? Our verified WD3 locksmiths typically arrive in 15-30 minutes. Transparent pricing with assessment fees from £25. Trusted by 2,847+ local homeowners. Call now.`,
  keywords: [
    "locksmith rickmansworth",
    "emergency locksmith wd3",
    "24 hour locksmith rickmansworth",
    "locksmith near me rickmansworth",
    "locked out rickmansworth",
    "locksmith chorleywood",
    "locksmith croxley green",
    "rickmansworth lock repair",
    "wd3 locksmith",
    "locksmith three rivers",
  ],
  openGraph: {
    title: "Locked Out in Rickmansworth? Help Typically Arrives in 15-30 Minutes",
    description: "24/7 verified locksmiths covering all WD3 areas. Transparent pricing with upfront assessment fees. See your work quote before accepting.",
    url: `${SITE_URL}/locksmith-rickmansworth`,
    type: "website",
    locale: "en_GB",
    siteName: SITE_NAME,
  },
  twitter: {
    card: "summary_large_image",
    title: "Emergency Locksmith Rickmansworth | 15-30 Min Response",
    description: "24/7 verified locksmiths. Trusted by 2,847+ locals. Call now.",
  },
  alternates: {
    canonical: `${SITE_URL}/locksmith-rickmansworth`,
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Schema Markup for SEO/AEO
function generateSchemas() {
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/locksmith-rickmansworth#business`,
    name: "LockSafe Locksmith Rickmansworth",
    description: "24/7 emergency locksmith services in Rickmansworth, WD3. Verified locksmiths with transparent pricing and anti-fraud protection.",
    url: `${SITE_URL}/locksmith-rickmansworth`,
    telephone: "+447818333989",
    priceRange: "££",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Rickmansworth",
      addressRegion: "Hertfordshire",
      postalCode: "WD3",
      addressCountry: "GB",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: 51.6400,
      longitude: -0.4730,
    },
    areaServed: RICKY_DATA.neighborhoods.map((area) => ({
      "@type": "City",
      name: area,
    })),
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      opens: "00:00",
      closes: "23:59",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "847",
      bestRating: "5",
      worstRating: "1",
    },
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Locksmith Services",
      itemListElement: [
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Emergency Lockout Service",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Lock Repair & Replacement",
          },
        },
        {
          "@type": "Offer",
          itemOffered: {
            "@type": "Service",
            name: "Security Upgrades",
          },
        },
      ],
    },
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How quickly can a locksmith get to Rickmansworth?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Our verified locksmiths typically arrive within 15-30 minutes to any location in Rickmansworth, Chorleywood, Croxley Green, and surrounding WD3 areas. Response times may vary based on locksmith availability and time of day. You'll see the exact ETA when you book.",
        },
      },
      {
        "@type": "Question",
        name: "What is the cost of an emergency locksmith in Rickmansworth?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Locksmiths set their own assessment fee (typically £25-£49) which covers their travel to you and diagnosing the problem. Once on-site, you'll receive a separate quote for the work. You can accept or decline the work quote - if you decline, you only pay the assessment fee. No hidden fees.",
        },
      },
      {
        "@type": "Question",
        name: "Are your Rickmansworth locksmiths vetted?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, all LockSafe locksmiths are DBS-checked, fully insured, and verified before joining our network. Every job includes GPS tracking, timestamped photos, and digital signatures for complete transparency and your protection.",
        },
      },
      {
        "@type": "Question",
        name: "Do you cover Chorleywood and Croxley Green?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Absolutely. We provide 24/7 locksmith services across all WD3 areas including Chorleywood, Croxley Green, Mill End, Loudwater, Maple Cross, Sarratt, and the entire Three Rivers district.",
        },
      },
    ],
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Emergency Locksmith Service Rickmansworth",
    description: "24/7 emergency locksmith services covering Rickmansworth and all WD3 postcodes",
    provider: {
      "@type": "LocalBusiness",
      name: "LockSafe",
    },
    areaServed: {
      "@type": "City",
      name: "Rickmansworth",
    },
    serviceType: "Emergency Locksmith",
  };

  return { localBusinessSchema, faqSchema, serviceSchema };
}

export default function LocksmithRickmansworthPage() {
  const schemas = generateSchemas();

  return (
    <>
      {/* Schema Markup */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schemas.serviceSchema) }}
      />

      {/* Sticky Mobile CTA - Always Visible */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-gradient-to-t from-slate-950 via-slate-950 to-slate-950/95 p-4 border-t border-slate-800">
        <a href="tel:07818333989" className="block">
          <Button className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-6 text-lg font-bold rounded-2xl shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-3">
            <Phone className="w-6 h-6 animate-pulse" />
            Call Now - Get Help Fast
          </Button>
        </a>
        <p className="text-center text-slate-400 text-xs mt-2">
          Typical response: 15-30 minutes in Rickmansworth
        </p>
      </div>

      <Header />

      <main className="pb-24 lg:pb-0">
        {/* ============================================ */}
        {/* HERO SECTION - Above the fold conversion */}
        {/* ============================================ */}
        <section className="relative bg-slate-950 overflow-hidden">
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900" />
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-5"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40' fill='%23ffffff' fill-opacity='1'/%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative section-container py-12 md:py-20 lg:py-24">
            {/* Live availability badge */}
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-4 py-2 backdrop-blur-sm">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="text-emerald-400 text-sm font-medium">
                  Locksmiths available near WD3 right now
                </span>
              </div>
            </div>

            <div className="max-w-4xl mx-auto text-center">
              {/* Pain-focused headline */}
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-black text-white mb-6 leading-[1.1] tracking-tight">
                <span className="text-slate-400 text-2xl md:text-3xl lg:text-4xl font-medium block mb-3">
                  Locked Out in Rickmansworth?
                </span>
                Verified Locksmiths Typically at Your Door in{" "}
                <span className="relative">
                  <span className="bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent">
                    15-30 Minutes
                  </span>
                  <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 200 12" fill="none">
                    <path d="M2 10C50 2 150 2 198 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="text-emerald-500/50"/>
                  </svg>
                </span>
              </h1>

              {/* Value proposition - accurate pricing info */}
              <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl mx-auto leading-relaxed">
                Transparent two-stage pricing. See the assessment fee upfront, then get a{" "}
                <span className="text-white font-medium">separate work quote</span> before any work begins.
                Trusted by{" "}
                <span className="text-emerald-400 font-semibold">2,847+ homeowners</span> across Three Rivers.
              </p>

              {/* Dual CTA - Phone + Request */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                <a href="tel:07818333989" className="group">
                  <Button className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-8 py-7 text-xl font-bold rounded-2xl shadow-xl shadow-emerald-500/25 transition-all duration-300 group-hover:shadow-emerald-500/40 group-hover:scale-[1.02]">
                    <Phone className="w-6 h-6 mr-3" />
                    07818 333 989
                  </Button>
                </a>
                <Link href="/request" className="group">
                  <Button className="w-full sm:w-auto bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white px-8 py-7 text-xl font-bold rounded-2xl border border-white/20 transition-all duration-300 group-hover:border-white/40">
                    Get Instant Quote
                    <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
              </div>

              {/* Trust badges row */}
              <div className="flex flex-wrap justify-center gap-4 md:gap-8 text-sm">
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Clock className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span>24/7 Service</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span>DBS Verified</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Star className="w-4 h-4 text-emerald-400 fill-emerald-400" />
                  </div>
                  <span>4.9/5 Rating</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span>Upfront Pricing</span>
                </div>
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="hidden md:flex justify-center mt-12 animate-bounce">
              <ChevronDown className="w-6 h-6 text-slate-600" />
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* PROBLEM AGITATION SECTION */}
        {/* ============================================ */}
        <section className="py-16 md:py-20 bg-slate-900">
          <div className="section-container">
            <div className="text-center mb-12">
              <span className="inline-block text-amber-400 text-sm font-semibold tracking-wider uppercase mb-4">
                We Understand Your Situation
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                Being Locked Out is{" "}
                <span className="text-amber-400">Stressful</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Whether it's 2 PM or 2 AM, we've helped thousands of Rickmansworth residents
                in these exact situations
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Scenario 1 */}
              <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-700/50 group hover:border-amber-500/30 transition-all duration-300">
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                  <Home className="w-6 h-6 text-slate-900" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Locked Out After the School Run
                </h3>
                <p className="text-slate-400 mb-4">
                  Kids waiting in the car at Rickmansworth Park Primary, bags of shopping
                  from the High Street, and your keys are sitting on the kitchen counter.
                </p>
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Zap className="w-4 h-4" />
                  We'll typically get you inside within 30 minutes
                </div>
              </div>

              {/* Scenario 2 */}
              <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-700/50 group hover:border-amber-500/30 transition-all duration-300">
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                  <Building2 className="w-6 h-6 text-slate-900" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Key Snapped in Your Victorian Lock
                </h3>
                <p className="text-slate-400 mb-4">
                  Those beautiful period properties in Chorleywood come with older locks.
                  When a key breaks inside, you need someone who knows what they're doing.
                </p>
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Zap className="w-4 h-4" />
                  Specialists in heritage property locks
                </div>
              </div>

              {/* Scenario 3 */}
              <div className="relative bg-slate-800/50 backdrop-blur-sm rounded-3xl p-8 border border-slate-700/50 group hover:border-amber-500/30 transition-all duration-300">
                <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform">
                  <AlertTriangle className="w-6 h-6 text-slate-900" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">
                  Late Night at the Aquadrome
                </h3>
                <p className="text-slate-400 mb-4">
                  Evening walk by the lakes, back to your car at 11 PM, and realized
                  you've locked your keys inside. Dark, cold, and no idea who to call.
                </p>
                <div className="flex items-center gap-2 text-emerald-400 font-medium">
                  <Zap className="w-4 h-4" />
                  24/7 service including bank holidays
                </div>
              </div>
            </div>

            {/* Urgency statement */}
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 rounded-full px-6 py-3">
                <Clock className="w-5 h-5 text-amber-400" />
                <span className="text-amber-400 font-medium">
                  Most locksmiths arrive within 15-30 minutes in urban areas. You'll see the exact ETA when booking.
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* HOW IT WORKS - 3 Simple Steps */}
        {/* ============================================ */}
        <section className="py-16 md:py-20 bg-white">
          <div className="section-container">
            <div className="text-center mb-12">
              <span className="inline-block text-emerald-600 text-sm font-semibold tracking-wider uppercase mb-4">
                Simple Process
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                Help in 3 Simple Steps
              </h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                No complicated forms. No waiting on hold. Just fast, reliable help.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8 relative">
              {/* Connection line for desktop */}
              <div className="hidden md:block absolute top-24 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />

              {/* Step 1 */}
              <div className="relative text-center">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25 relative z-10">
                  <span className="text-2xl font-bold text-white">1</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Call or Request Online
                </h3>
                <p className="text-slate-600">
                  Tell us your location in Rickmansworth and what you need.
                  Takes less than 60 seconds.
                </p>
              </div>

              {/* Step 2 */}
              <div className="relative text-center">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25 relative z-10">
                  <span className="text-2xl font-bold text-white">2</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Review Assessment Fee & ETA
                </h3>
                <p className="text-slate-600">
                  Locksmiths apply with their assessment fee (typically £25-£49)
                  and estimated arrival time. You choose who to book.
                </p>
              </div>

              {/* Step 3 */}
              <div className="relative text-center">
                <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/25 relative z-10">
                  <span className="text-2xl font-bold text-white">3</span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Get Work Quote On-Site
                </h3>
                <p className="text-slate-600">
                  Your locksmith arrives, diagnoses the problem, and gives you
                  a work quote. Accept or decline - you're in control.
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-12 text-center">
              <a href="tel:07818333989" className="inline-flex">
                <Button className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg font-bold rounded-2xl">
                  <Phone className="w-5 h-5 mr-2" />
                  Start Step 1 Now
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* RISK REVERSAL - Guarantee Section */}
        {/* ============================================ */}
        <section className="py-16 md:py-20 bg-gradient-to-br from-emerald-600 to-emerald-700 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full border-[40px] border-white" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full border-[40px] border-white" />
          </div>

          <div className="section-container relative">
            <div className="max-w-3xl mx-auto text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl">
                <ThumbsUp className="w-10 h-10 text-emerald-600" />
              </div>

              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
                The "No Nasty Surprises" Guarantee
              </h2>

              <p className="text-xl text-emerald-100 mb-8 leading-relaxed">
                We're so confident in our locksmiths that we guarantee it.
                If your locksmith doesn't arrive within their quoted ETA + 30 minutes, your
                <span className="font-bold text-white"> assessment fee is fully refunded</span>.
              </p>

              <div className="grid sm:grid-cols-3 gap-6 mb-10">
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <CheckCircle2 className="w-8 h-8 text-white mx-auto mb-3" />
                  <p className="text-white font-medium">Two-Stage Pricing</p>
                  <p className="text-emerald-200 text-sm">Assessment fee, then work quote</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <CheckCircle2 className="w-8 h-8 text-white mx-auto mb-3" />
                  <p className="text-white font-medium">Decline Any Quote</p>
                  <p className="text-emerald-200 text-sm">Only pay assessment if you decline</p>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                  <CheckCircle2 className="w-8 h-8 text-white mx-auto mb-3" />
                  <p className="text-white font-medium">12-Month Warranty</p>
                  <p className="text-emerald-200 text-sm">On all parts fitted</p>
                </div>
              </div>

              <a href="tel:07818333989">
                <Button className="bg-white hover:bg-slate-100 text-emerald-700 px-10 py-7 text-xl font-bold rounded-2xl shadow-xl">
                  <Phone className="w-6 h-6 mr-3" />
                  Get Protected Help Now
                </Button>
              </a>
            </div>
          </div>
        </section>

        {/* SOCIAL PROOF - Reviews Section */}
        <section className="py-16 md:py-20 bg-slate-50">
          <div className="section-container">
            <div className="text-center mb-12">
              <span className="inline-block text-emerald-600 text-sm font-semibold tracking-wider uppercase mb-4">
                Real Reviews from Real Neighbours
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                Join 2,847+ Happy Customers in Three Rivers
              </h2>
              <div className="flex items-center justify-center gap-2 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-6 h-6 text-amber-400 fill-amber-400" />
                ))}
                <span className="text-slate-700 font-bold ml-2">4.9/5</span>
                <span className="text-slate-500">(847 Google reviews)</span>
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Review 1 */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed">
                  "Locked myself out after walking the dog at the Aquadrome. Called LockSafe
                  and Martin was at my door in{" "}
                  <span className="font-semibold text-slate-900">about 20 minutes</span>.
                  The assessment fee was clear upfront, and the work quote was fair. Exactly what you need at 9 PM!"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 font-bold">SH</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Sarah H.</p>
                    <p className="text-slate-500 text-sm">Rickmansworth Town Centre</p>
                  </div>
                </div>
              </div>

              {/* Review 2 */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed">
                  "Key snapped in our 1930s front door lock in Chorleywood. The locksmith
                  knew exactly how to handle it without damaging the original mechanism.
                  <span className="font-semibold text-slate-900">Professional and careful</span>.
                  Highly recommend."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 font-bold">JM</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">James M.</p>
                    <p className="text-slate-500 text-sm">Chorleywood</p>
                  </div>
                </div>
              </div>

              {/* Review 3 */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed">
                  "After a break-in attempt on our Croxley Green home, needed emergency
                  lock changes at midnight. They came out immediately, secured everything,
                  and gave us peace of mind.{" "}
                  <span className="font-semibold text-slate-900">Can't thank them enough</span>."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-700 font-bold">PT</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Priya T.</p>
                    <p className="text-slate-500 text-sm">Croxley Green</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trust badges */}
            <div className="mt-12 flex flex-wrap justify-center items-center gap-8 opacity-60">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-slate-600" />
                <span className="text-slate-600 font-medium">MLA Approved</span>
              </div>
              <div className="flex items-center gap-2">
                <BadgeCheck className="w-6 h-6 text-slate-600" />
                <span className="text-slate-600 font-medium">Which? Trusted Trader</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6 text-slate-600" />
                <span className="text-slate-600 font-medium">Fully Insured</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-slate-600" />
                <span className="text-slate-600 font-medium">DBS Checked</span>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* SERVICES SECTION */}
        {/* ============================================ */}
        <section className="py-16 md:py-20 bg-white">
          <div className="section-container">
            <div className="text-center mb-12">
              <span className="inline-block text-emerald-600 text-sm font-semibold tracking-wider uppercase mb-4">
                Full Service Locksmith
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                Locksmith Services in Rickmansworth
              </h2>
              <p className="text-slate-600 text-lg max-w-2xl mx-auto">
                From emergency lockouts to security upgrades, our WD3 locksmiths handle it all
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Service 1 */}
              <div className="group bg-slate-50 hover:bg-emerald-50 rounded-3xl p-8 transition-all duration-300 border border-transparent hover:border-emerald-200">
                <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                  <Lock className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Emergency Lockout
                </h3>
                <p className="text-slate-600 mb-4">
                  Locked out of your home, car, or business? We'll get you back in fast
                  with minimal disruption to your locks.
                </p>
                <p className="text-emerald-600 font-semibold">Assessment from £25</p>
              </div>

              {/* Service 2 */}
              <div className="group bg-slate-50 hover:bg-emerald-50 rounded-3xl p-8 transition-all duration-300 border border-transparent hover:border-emerald-200">
                <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                  <Key className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Lock Replacement
                </h3>
                <p className="text-slate-600 mb-4">
                  Broken lock? Lost keys? Moving into a new property? We fit high-security
                  locks to British Standards.
                </p>
                <p className="text-emerald-600 font-semibold">Work quote on-site</p>
              </div>

              {/* Service 3 */}
              <div className="group bg-slate-50 hover:bg-emerald-50 rounded-3xl p-8 transition-all duration-300 border border-transparent hover:border-emerald-200">
                <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                  <Shield className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Security Upgrades
                </h3>
                <p className="text-slate-600 mb-4">
                  Upgrade to anti-snap, anti-pick, anti-drill locks. Insurance-approved
                  security solutions for Rickmansworth homes.
                </p>
                <p className="text-emerald-600 font-semibold">Work quote on-site</p>
              </div>

              {/* Service 4 */}
              <div className="group bg-slate-50 hover:bg-emerald-50 rounded-3xl p-8 transition-all duration-300 border border-transparent hover:border-emerald-200">
                <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                  <Car className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Car Lockout
                </h3>
                <p className="text-slate-600 mb-4">
                  Locked your keys in the car? Our auto locksmiths can get you back on
                  the road without damaging your vehicle.
                </p>
                <p className="text-emerald-600 font-semibold">Assessment from £35</p>
              </div>

              {/* Service 5 */}
              <div className="group bg-slate-50 hover:bg-emerald-50 rounded-3xl p-8 transition-all duration-300 border border-transparent hover:border-emerald-200">
                <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                  <Building2 className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  Commercial Locksmith
                </h3>
                <p className="text-slate-600 mb-4">
                  Shop lockout? Office access control? We help Rickmansworth businesses
                  with all commercial security needs.
                </p>
                <p className="text-emerald-600 font-semibold">Quote on request</p>
              </div>

              {/* Service 6 */}
              <div className="group bg-slate-50 hover:bg-emerald-50 rounded-3xl p-8 transition-all duration-300 border border-transparent hover:border-emerald-200">
                <div className="w-14 h-14 bg-emerald-100 group-hover:bg-emerald-200 rounded-2xl flex items-center justify-center mb-6 transition-colors">
                  <Camera className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  UPVC & Window Locks
                </h3>
                <p className="text-slate-600 mb-4">
                  Faulty door handles, broken window locks, or patio door repairs.
                  Complete UPVC multipoint lock specialists.
                </p>
                <p className="text-emerald-600 font-semibold">Work quote on-site</p>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* AREAS COVERED */}
        {/* ============================================ */}
        <section className="py-16 md:py-20 bg-slate-900">
          <div className="section-container">
            <div className="text-center mb-12">
              <span className="inline-block text-emerald-400 text-sm font-semibold tracking-wider uppercase mb-4">
                Full WD3 Coverage
              </span>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4">
                Covering All of Rickmansworth & Surrounds
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Our locksmiths know every street, every estate, every neighbourhood in Three Rivers
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {RICKY_DATA.neighborhoods.map((area) => (
                <div
                  key={area}
                  className="bg-slate-800/50 hover:bg-emerald-900/30 backdrop-blur-sm rounded-2xl px-5 py-4 border border-slate-700/50 hover:border-emerald-500/30 transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-emerald-400" />
                    <span className="text-white font-medium">{area}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Local landmarks */}
            <div className="mt-12 pt-8 border-t border-slate-700">
              <p className="text-center text-slate-400 mb-6">
                Also covering areas near these Rickmansworth landmarks:
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                {RICKY_DATA.landmarks.map((landmark) => (
                  <span
                    key={landmark}
                    className="px-4 py-2 bg-slate-800/50 rounded-full text-sm text-slate-300 border border-slate-700/50"
                  >
                    {landmark}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* FAQ SECTION - AEO Optimized */}
        {/* ============================================ */}
        <section className="py-16 md:py-20 bg-white" id="faq">
          <div className="section-container">
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-12">
                <span className="inline-block text-emerald-600 text-sm font-semibold tracking-wider uppercase mb-4">
                  Common Questions
                </span>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                  Rickmansworth Locksmith FAQ
                </h2>
              </div>

              <div className="space-y-6">
                {/* FAQ 1 */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    How quickly can a locksmith get to Rickmansworth?
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Our verified locksmiths typically arrive within <strong>15-30 minutes</strong> to
                    locations in Rickmansworth, Chorleywood, Croxley Green, and surrounding WD3 areas.
                    Response times may vary based on locksmith availability and time of day.
                    You'll see the exact ETA when a locksmith applies for your job.
                  </p>
                </div>

                {/* FAQ 2 */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    What is the cost of an emergency locksmith in Rickmansworth?
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    LockSafe uses <strong>transparent two-stage pricing</strong>. First, locksmiths set their own
                    assessment fee (typically £25-£49) which covers their travel and diagnosis. Once on-site,
                    they'll provide a separate work quote. You can accept or decline the work quote — if you
                    decline, you've only paid the assessment fee. No hidden fees ever.
                  </p>
                </div>

                {/* FAQ 3 */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    Are your Rickmansworth locksmiths vetted and insured?
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Yes, all LockSafe locksmiths are <strong>DBS-checked, fully insured</strong>, and
                    verified before joining our network. Every job includes GPS tracking, timestamped
                    photos, and digital signatures for complete transparency and your protection.
                    This is our anti-fraud system that other services don't offer.
                  </p>
                </div>

                {/* FAQ 4 */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    Do you cover Chorleywood, Croxley Green, and Mill End?
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Absolutely. We provide <strong>24/7 locksmith services across all WD3 areas</strong> including
                    Chorleywood, Croxley Green, Mill End, Loudwater, Maple Cross, Sarratt, Batchworth,
                    Chenies, West Hyde, and the entire Three Rivers district. Our locksmiths know the
                    local area inside out.
                  </p>
                </div>

                {/* FAQ 5 */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    Can you handle old Victorian and period property locks?
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Yes! Chorleywood and Rickmansworth have many beautiful period properties with
                    older locks. Our locksmiths are <strong>specialists in heritage property locks</strong> and
                    can repair, service, or replace them while maintaining the original character of
                    your doors.
                  </p>
                </div>

                {/* FAQ 6 */}
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="text-lg font-bold text-slate-900 mb-3">
                    What happens if the locksmith doesn't arrive on time?
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    You're protected by our <strong>automatic refund guarantee</strong>. If your locksmith doesn't
                    arrive within their quoted ETA plus a 30-minute grace period, you can request a full refund
                    of your assessment fee. All work comes with a 12-month warranty on parts fitted.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================ */}
        {/* FINAL CTA SECTION */}
        {/* ============================================ */}
        <section className="py-16 md:py-24 bg-slate-950 relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[100px] rounded-full" />
          </div>

          <div className="section-container relative">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6">
                Locked Out Right Now?
              </h2>
              <p className="text-xl text-slate-400 mb-8 leading-relaxed">
                Don't wait in the cold. Our Rickmansworth locksmiths are ready to help you
                <span className="text-emerald-400 font-semibold"> right now</span>.
                One call and help is on the way.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
                <a href="tel:07818333989" className="group">
                  <Button className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white px-10 py-7 text-xl font-bold rounded-2xl shadow-xl shadow-emerald-500/25 transition-all duration-300 group-hover:shadow-emerald-500/40">
                    <Phone className="w-6 h-6 mr-3 animate-pulse" />
                    07818 333 989
                  </Button>
                </a>
                <Link href="/request">
                  <Button className="w-full sm:w-auto bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white px-10 py-7 text-xl font-bold rounded-2xl border border-white/20">
                    Request Online
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
              </div>

              <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Assessment fee from £25
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Typically 15-30 min response
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Work quote before accepting
                </span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
