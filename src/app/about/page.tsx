import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { SITE_URL, SITE_NAME, getFullUrl } from "@/lib/config";
import {
  Shield,
  CheckCircle2,
  ArrowRight,
  Target,
  Lightbulb,
  Heart,
  Scale,
  Users,
  Clock,
  FileCheck,
  AlertTriangle,
  Eye,
  Lock,
  Award,
  Zap,
  Phone,
  ShieldCheck,
  TrendingUp,
  MapPin,
  BadgeCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: `About ${SITE_NAME} | UK's First Anti-Fraud Locksmith Platform`,
  description:
    "LockSafe exists because the locksmith industry is broken. Learn how we created the UK's first transparent, fraud-proof locksmith platform with GPS tracking, digital documentation, and verified professionals. Our mission: never let anyone get scammed again.",
  keywords: [
    "about LockSafe",
    "LockSafe UK",
    "locksmith fraud protection",
    "anti-fraud locksmith",
    "transparent locksmith service",
    "verified locksmiths UK",
    "locksmith with GPS tracking",
    "digital locksmith documentation",
    "UK locksmith platform",
    "trustworthy locksmith service",
  ],
  openGraph: {
    title: `About ${SITE_NAME} | We're on a Mission to End Locksmith Scams`,
    description:
      "The UK's locksmith industry has a fraud problem. LockSafe is the solution. GPS tracking, digital paper trails, verified professionals. Learn why we're different.",
    url: getFullUrl("/about"),
    siteName: SITE_NAME,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `About ${SITE_NAME} - UK's First Anti-Fraud Locksmith Platform`,
      },
    ],
    locale: "en_GB",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    site: "@locksafeuk",
    creator: "@locksafeuk",
    title: `About ${SITE_NAME} | Ending Locksmith Scams in the UK`,
    description:
      "We built LockSafe because someone we loved got scammed. Now we protect everyone. GPS tracking. Digital proof. Verified locksmiths.",
    images: ["/twitter-image"],
  },
  alternates: {
    canonical: getFullUrl("/about"),
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

// Organization Schema for SEO
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  description:
    "LockSafe is the UK's first anti-fraud locksmith platform. We connect customers with verified, insured locksmiths while providing complete transparency through GPS tracking, digital documentation, and automatic refund protection.",
  foundingDate: "2024",
  areaServed: {
    "@type": "Country",
    name: "United Kingdom",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: "+44-7818-333-989",
    contactType: "customer service",
    availableLanguage: "English",
    areaServed: "GB",
  },
  sameAs: [
    "https://facebook.com/locksafeuk",
    "https://twitter.com/locksafeuk",
    "https://instagram.com/locksafeuk",
    "https://linkedin.com/company/locksafeuk",
  ],
  slogan: "The UK's First Anti-Fraud Locksmith Platform",
  knowsAbout: [
    "Emergency Locksmith Services",
    "Lock Repair",
    "Lock Replacement",
    "Security Upgrades",
    "Anti-Fraud Protection",
    "GPS Tracking",
    "Digital Documentation",
  ],
};

// AboutPage Schema for AEO/GEO
const aboutPageSchema = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  name: `About ${SITE_NAME}`,
  description:
    "Learn about LockSafe's mission to end locksmith scams in the UK through transparency, verification, and complete digital documentation.",
  url: getFullUrl("/about"),
  mainEntity: {
    "@type": "Organization",
    name: SITE_NAME,
  },
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  },
};

// FAQ Schema for AEO (Answer Engine Optimization)
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is LockSafe?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe is the UK's first anti-fraud locksmith platform. We connect customers with verified, insured locksmiths while providing complete transparency through GPS tracking, timestamped photos, digital signatures, and automatic refund protection. Unlike traditional locksmith services, every job creates a legally-binding digital paper trail.",
      },
    },
    {
      "@type": "Question",
      name: "Why was LockSafe created?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe was created to solve the widespread problem of locksmith fraud in the UK. Too many people, especially vulnerable individuals, have been scammed by unethical locksmiths who quote £50 and charge £300. We built a platform where this cannot happen - with upfront pricing, digital documentation, and complete transparency.",
      },
    },
    {
      "@type": "Question",
      name: "How does LockSafe protect customers from locksmith scams?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe protects customers through multiple layers: (1) All locksmiths are DBS-checked, insured, and verified, (2) You see the assessment fee before booking, (3) You receive a detailed quote BEFORE work starts and can accept or decline, (4) GPS tracking proves arrival times, (5) Timestamped photos document everything, (6) Digital signatures create legal proof, (7) Automatic refunds if locksmiths don't arrive on time.",
      },
    },
    {
      "@type": "Question",
      name: "What makes LockSafe different from other locksmith services?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe is fundamentally different because we created a new category: the anti-fraud locksmith platform. Traditional services connect you with locksmiths and hope for the best. We built technology that makes fraud impossible - GPS tracking, photo verification, digital signatures, and instant PDF reports create an unbreakable chain of evidence that protects everyone.",
      },
    },
    {
      "@type": "Question",
      name: "Is LockSafe available across the UK?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, LockSafe provides 24/7 emergency locksmith services across the entire United Kingdom. We have a growing network of verified locksmiths in all major cities and towns, with average response times of 15-30 minutes in urban areas.",
      },
    },
    {
      "@type": "Question",
      name: "What is LockSafe's mission?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "LockSafe's mission is to make locksmith fraud impossible in the UK. We believe everyone deserves transparent, honest service - especially during emergencies when they're most vulnerable. We won't stop until every locksmith job in the UK is protected by our anti-fraud system.",
      },
    },
  ],
};

// Values data
const values = [
  {
    icon: Eye,
    title: "Radical Transparency",
    description:
      "Every price, every step, every document - visible to you. No hidden fees. No surprises. No excuses.",
    color: "from-orange-500 to-amber-500",
  },
  {
    icon: Shield,
    title: "Protection First",
    description:
      "We built systems that make fraud impossible, not just unlikely. Your safety isn't an afterthought - it's our architecture.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: Heart,
    title: "Human Dignity",
    description:
      "We remember why we started: protecting real people from real harm. Every feature we build passes one test - does it protect the vulnerable?",
    color: "from-rose-500 to-pink-500",
  },
  {
    icon: Scale,
    title: "Fair for Everyone",
    description:
      "Great locksmiths deserve fair payment. Great customers deserve honest service. Our platform protects both sides equally.",
    color: "from-blue-500 to-indigo-500",
  },
];

// How we're different - Category design (Nicholas Cole approach)
const differences = [
  {
    traditional: "No verification - anyone can call themselves a locksmith",
    locksafe: "DBS-checked, insured, professionally qualified - 70% rejection rate",
    icon: BadgeCheck,
  },
  {
    traditional: "Quote changes after they start working",
    locksafe: "See the full quote BEFORE work begins - accept or decline",
    icon: Eye,
  },
  {
    traditional: "Your word against theirs in disputes",
    locksafe: "GPS tracking, photos, signatures - legally-binding evidence",
    icon: FileCheck,
  },
  {
    traditional: "No consequences for no-shows",
    locksafe: "Automatic full refund if locksmith doesn't arrive on time",
    icon: Clock,
  },
  {
    traditional: "Cash payments with no paper trail",
    locksafe: "Secure digital payments with instant PDF receipts",
    icon: Shield,
  },
];

// Stats that matter
const impactStats = [
  { number: "2,500+", label: "Jobs Protected", icon: ShieldCheck },
  { number: "£0", label: "Customer Scam Losses", icon: Scale },
  { number: "100%", label: "Dispute Resolution", icon: Award },
  { number: "15 min", label: "Avg. Response Time", icon: Zap },
];

export default function AboutPage() {
  return (
    <>
      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <Header />

      <main>
        {/* Hero Section - Start with WHY (Simon Sinek) */}
        <section
          className="relative py-16 md:py-24 overflow-hidden"
          aria-labelledby="about-hero-heading"
        >
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50" />

          <div className="section-container relative">
            <div className="max-w-4xl mx-auto text-center">
              {/* Category Label */}
              <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded-full px-4 py-2 text-sm font-medium mb-6">
                <Target className="w-4 h-4" />
                THE UK'S FIRST ANTI-FRAUD LOCKSMITH PLATFORM
              </div>

              <h1
                id="about-hero-heading"
                className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight"
              >
                We Exist Because{" "}
                <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                  Someone Had to
                </span>{" "}
                Fix This
              </h1>

              <p className="text-xl md:text-2xl text-slate-300 mb-8 leading-relaxed max-w-3xl mx-auto">
                The locksmith industry has a fraud problem. People in
                emergencies get taken advantage of every single day. We decided
                that was unacceptable.
              </p>

              {/* Impact Numbers - Quick Social Proof */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-10">
                {impactStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white/5 backdrop-blur-sm rounded-2xl p-4 md:p-6 border border-white/10"
                  >
                    <stat.icon className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                    <div className="text-2xl md:text-3xl font-bold text-white">
                      {stat.number}
                    </div>
                    <div className="text-sm text-slate-400">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/request">
                  <Button className="btn-primary text-lg px-8 py-4 h-auto w-full sm:w-auto">
                    Get Protected Now
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="#our-mission">
                  <Button
                    variant="outline"
                    className="border-white/30 bg-transparent text-white hover:bg-white/10 text-lg px-8 py-4 h-auto w-full sm:w-auto"
                  >
                    Read Our Story
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* The Problem Section - Problem, Agitate, Solution (Russell Brunson) */}
        <section
          id="the-problem"
          className="py-16 md:py-24 bg-slate-50"
          aria-labelledby="problem-heading"
        >
          <div className="section-container">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
                  <AlertTriangle className="w-4 h-4" />
                  THE PROBLEM WE'RE SOLVING
                </div>
                <h2
                  id="problem-heading"
                  className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
                >
                  The Locksmith Industry Is Broken
                </h2>
              </div>

              {/* Story Block - Hook-Story-Offer (Russell Brunson) */}
              <article className="bg-white rounded-3xl p-8 md:p-12 shadow-lg mb-12">
                <div className="prose prose-lg max-w-none">
                  <p className="text-xl text-slate-700 leading-relaxed mb-6">
                    Imagine this: You're locked out at 11pm. You're tired,
                    stressed, maybe even scared. You find a locksmith online who
                    quotes £49. Relief washes over you.
                  </p>

                  <p className="text-xl text-slate-700 leading-relaxed mb-6">
                    Then they arrive. Suddenly it's "more complicated than
                    expected." The price jumps to £150. Then £220. Then £340. By
                    the time they're done, you've paid nearly{" "}
                    <strong className="text-slate-900">7x the original quote</strong>.
                  </p>

                  <p className="text-xl text-slate-700 leading-relaxed mb-6">
                    You complain. They shrug. It's your word against theirs.
                    There's no documentation, no evidence, no recourse.
                  </p>

                  <p className="text-xl text-slate-700 leading-relaxed mb-6 font-semibold text-slate-900">
                    This isn't a rare occurrence. This is the industry standard.
                  </p>

                  {/* The Agitation */}
                  <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-xl my-8">
                    <h3 className="text-xl font-bold text-red-800 mb-3">
                      Here's what makes this worse:
                    </h3>
                    <ul className="space-y-3 text-red-700">
                      <li className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Anyone</strong> can call themselves a
                          locksmith - no qualifications required
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>
                          Scammers specifically <strong>target the vulnerable</strong> -
                          the elderly, single parents, people in emergencies
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>
                          There's <strong>zero accountability</strong> - no
                          paper trail, no proof, no consequences
                        </span>
                      </li>
                      <li className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>
                          Good locksmiths suffer too - they get blamed for an
                          industry's bad reputation
                        </span>
                      </li>
                    </ul>
                  </div>

                  {/* The Solution */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-green-500 p-6 rounded-r-xl">
                    <h3 className="text-xl font-bold text-green-800 mb-3">
                      So we built something different:
                    </h3>
                    <p className="text-green-700">
                      A platform where fraud is{" "}
                      <strong>architecturally impossible</strong>. Where every
                      price is visible upfront. Where GPS tracks arrivals.
                      Where photos document everything. Where digital
                      signatures create legal proof. Where automatic refunds
                      punish no-shows.
                    </p>
                    <p className="text-green-800 font-semibold mt-4">
                      We didn't just improve the process. We re-invented it.
                    </p>
                  </div>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Our Mission - Golden Circle (Simon Sinek) */}
        <section
          id="our-mission"
          className="py-16 md:py-24 bg-white"
          aria-labelledby="mission-heading"
        >
          <div className="section-container">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
                <Lightbulb className="w-4 h-4" />
                START WITH WHY
              </div>
              <h2
                id="mission-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              >
                Our Mission, Our Method, Our Movement
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Everything we do starts with one simple belief.
              </p>
            </div>

            {/* Golden Circle Cards */}
            <div className="grid md:grid-cols-3 gap-6 md:gap-8 max-w-5xl mx-auto">
              {/* WHY */}
              <article className="relative bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-8 text-white overflow-hidden">
                <div className="absolute top-0 right-0 text-[120px] font-bold text-white/10 leading-none">
                  1
                </div>
                <div className="relative">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                    <Heart className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">WHY We Exist</h3>
                  <p className="text-white/90 leading-relaxed">
                    We believe no one should ever be taken advantage of when
                    they're vulnerable. An emergency shouldn't mean you get
                    scammed.
                  </p>
                </div>
              </article>

              {/* HOW */}
              <article className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-8 text-white overflow-hidden">
                <div className="absolute top-0 right-0 text-[120px] font-bold text-white/10 leading-none">
                  2
                </div>
                <div className="relative">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                    <Lock className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">HOW We Do It</h3>
                  <p className="text-white/90 leading-relaxed">
                    We build technology that makes fraud architecturally
                    impossible. Not unlikely - impossible. Every transaction
                    creates an unbreakable evidence chain.
                  </p>
                </div>
              </article>

              {/* WHAT */}
              <article className="relative bg-gradient-to-br from-emerald-500 to-teal-500 rounded-3xl p-8 text-white overflow-hidden">
                <div className="absolute top-0 right-0 text-[120px] font-bold text-white/10 leading-none">
                  3
                </div>
                <div className="relative">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                    <Shield className="w-7 h-7" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4">WHAT We Deliver</h3>
                  <p className="text-white/90 leading-relaxed">
                    The UK's first anti-fraud locksmith platform. Verified
                    professionals, transparent pricing, GPS tracking, and
                    complete digital documentation.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* Category Design Section - Creating a New Category (Nicholas Cole) */}
        <section
          id="new-category"
          className="py-16 md:py-24 bg-slate-900"
          aria-labelledby="category-heading"
        >
          <div className="section-container">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 text-orange-300 rounded-full px-4 py-2 text-sm font-medium mb-4">
                <Target className="w-4 h-4" />
                CATEGORY CREATION
              </div>
              <h2
                id="category-heading"
                className="text-3xl md:text-4xl font-bold text-white mb-4"
              >
                We Didn't Improve Locksmith Services.{" "}
                <br className="hidden md:block" />
                <span className="text-orange-400">We Created a New Category.</span>
              </h2>
              <p className="text-lg text-slate-300 max-w-2xl mx-auto">
                Traditional locksmith directories connect you with someone and
                hope for the best. We built something fundamentally different.
              </p>
            </div>

            {/* Comparison Table */}
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
                {/* Table Header */}
                <div className="grid grid-cols-2 bg-slate-50 border-b">
                  <div className="p-4 md:p-6 text-center border-r border-slate-200">
                    <div className="text-sm text-slate-500 uppercase tracking-wide mb-1">
                      Traditional Services
                    </div>
                    <div className="text-lg font-bold text-slate-700">
                      The Old Way
                    </div>
                  </div>
                  <div className="p-4 md:p-6 text-center bg-orange-50">
                    <div className="text-sm text-orange-600 uppercase tracking-wide mb-1">
                      LockSafe Platform
                    </div>
                    <div className="text-lg font-bold text-orange-700">
                      The New Standard
                    </div>
                  </div>
                </div>

                {/* Comparison Rows */}
                {differences.map((diff, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-2 border-b border-slate-100 last:border-b-0"
                  >
                    <div className="p-4 md:p-6 border-r border-slate-100 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                      <span className="text-slate-600 text-sm md:text-base">
                        {diff.traditional}
                      </span>
                    </div>
                    <div className="p-4 md:p-6 flex items-center gap-3 bg-orange-50/50">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-slate-800 text-sm md:text-base font-medium">
                        {diff.locksafe}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Our Values Section - Brand Values (Justin Welsh approach) */}
        <section
          id="our-values"
          className="py-16 md:py-24 bg-white"
          aria-labelledby="values-heading"
        >
          <div className="section-container">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
                <Heart className="w-4 h-4" />
                WHAT WE STAND FOR
              </div>
              <h2
                id="values-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              >
                The Values That Guide Every Decision
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                These aren't just words on a wall. They're the filter through
                which we make every product decision.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
              {values.map((value) => (
                <article
                  key={value.title}
                  className="group bg-slate-50 hover:bg-white rounded-2xl p-6 md:p-8 border border-slate-100 hover:border-slate-200 hover:shadow-xl transition-all duration-300"
                >
                  <div
                    className={`w-14 h-14 bg-gradient-to-br ${value.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                  >
                    <value.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">
                    {value.title}
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    {value.description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* The Protection Promise - Unique Value Prop */}
        <section
          className="py-16 md:py-24 bg-gradient-to-br from-green-600 to-emerald-700"
          aria-labelledby="promise-heading"
        >
          <div className="section-container">
            <div className="max-w-4xl mx-auto text-center text-white">
              <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <Shield className="w-10 h-10" />
              </div>
              <h2
                id="promise-heading"
                className="text-3xl md:text-4xl font-bold mb-6"
              >
                The LockSafe Protection Promise
              </h2>
              <p className="text-xl text-white/90 mb-10 leading-relaxed">
                When you use LockSafe, you're not just getting a locksmith.
                You're getting a guarantee that you'll be treated fairly.
              </p>

              <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mb-12">
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <BadgeCheck className="w-8 h-8 mx-auto mb-2 text-green-200" />
                  <div className="font-semibold">Verified Pros</div>
                  <div className="text-sm text-white/70">DBS & Insurance Checked</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <Eye className="w-8 h-8 mx-auto mb-2 text-green-200" />
                  <div className="font-semibold">Upfront Pricing</div>
                  <div className="text-sm text-white/70">No Hidden Fees</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <MapPin className="w-8 h-8 mx-auto mb-2 text-green-200" />
                  <div className="font-semibold">GPS Tracked</div>
                  <div className="text-sm text-white/70">Proof of Arrival</div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <FileCheck className="w-8 h-8 mx-auto mb-2 text-green-200" />
                  <div className="font-semibold">Digital Proof</div>
                  <div className="text-sm text-white/70">Legal Documentation</div>
                </div>
              </div>

              <Link href="/request">
                <Button
                  size="lg"
                  className="bg-white text-green-700 hover:bg-green-50 font-semibold text-lg px-8 py-6 h-auto"
                >
                  Experience the Difference
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Section - AEO Optimized */}
        <section
          id="faq"
          className="py-16 md:py-24 bg-slate-50"
          aria-labelledby="faq-heading"
        >
          <div className="section-container">
            <div className="text-center mb-12">
              <h2
                id="faq-heading"
                className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
              >
                Frequently Asked Questions
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Everything you want to know about LockSafe and our mission.
              </p>
            </div>

            <div className="max-w-3xl mx-auto space-y-4">
              {faqSchema.mainEntity.map((faq, index) => (
                <details
                  key={index}
                  className="group bg-white rounded-2xl border border-slate-200 overflow-hidden"
                >
                  <summary className="flex items-center justify-between p-6 cursor-pointer list-none">
                    <h3 className="text-lg font-semibold text-slate-900 pr-4">
                      {faq.name}
                    </h3>
                    <span className="text-orange-500 transition-transform group-open:rotate-45">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    </span>
                  </summary>
                  <div className="px-6 pb-6">
                    <p className="text-slate-600 leading-relaxed">
                      {faq.acceptedAnswer.text}
                    </p>
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section - Call to Action */}
        <section
          className="py-16 md:py-24 bg-slate-900"
          aria-labelledby="cta-heading"
        >
          <div className="section-container">
            <div className="max-w-4xl mx-auto text-center">
              <h2
                id="cta-heading"
                className="text-3xl md:text-4xl font-bold text-white mb-6"
              >
                Ready to Experience{" "}
                <span className="text-orange-400">Real Protection?</span>
              </h2>
              <p className="text-xl text-slate-300 mb-10 max-w-2xl mx-auto">
                Join thousands of UK customers who've said goodbye to locksmith
                anxiety. Transparent pricing. Verified professionals. Complete
                documentation.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
                <Link href="/request">
                  <Button className="btn-primary text-lg px-8 py-4 h-auto w-full sm:w-auto">
                    Get Emergency Help Now
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <a href="tel:07818333989">
                  <Button
                    variant="outline"
                    className="border-white/30 bg-transparent text-white hover:bg-white/10 text-lg px-8 py-4 h-auto w-full sm:w-auto"
                  >
                    <Phone className="w-5 h-5" />
                    07818 333 989
                  </Button>
                </a>
              </div>

              <p className="text-slate-400 text-sm">
                24/7 availability • Average 15-30 min response • No platform
                fees for customers
              </p>
            </div>
          </div>
        </section>

        {/* Trust Badges - Social Proof Footer */}
        <section className="py-8 bg-slate-800 border-t border-slate-700">
          <div className="section-container">
            <div className="flex flex-wrap items-center justify-center gap-8 text-slate-400 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>All Locksmiths DBS Checked</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Fully Insured</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>GPS Tracked</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span>Money-Back Guarantee</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
