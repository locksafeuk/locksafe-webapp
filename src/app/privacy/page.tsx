"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  Shield,
  ArrowLeft,
  Calendar,
  Mail,
  ChevronRight,
  Database,
  Eye,
  Trash2,
  Download,
  MapPin,
  Users,
  Lock,
  Globe,
  Baby,
  RefreshCw,
  AlertTriangle,
  Phone,
  BookOpen,
} from "lucide-react";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/config";

interface Section {
  id: string;
  number: string;
  title: string;
  icon: React.ReactNode;
}

const sections: Section[] = [
  { id: "introduction", number: "1", title: "Introduction", icon: <BookOpen className="w-4 h-4" /> },
  { id: "information-collected", number: "2", title: "Information We Collect", icon: <Database className="w-4 h-4" /> },
  { id: "how-we-use", number: "3", title: "How We Use Your Information", icon: <Eye className="w-4 h-4" /> },
  { id: "gps-data", number: "4", title: "GPS and Location Data", icon: <MapPin className="w-4 h-4" /> },
  { id: "data-sharing", number: "5", title: "Who We Share Data With", icon: <Users className="w-4 h-4" /> },
  { id: "data-retention", number: "6", title: "Data Retention", icon: <Database className="w-4 h-4" /> },
  { id: "your-rights", number: "7", title: "Your Rights Under GDPR", icon: <Shield className="w-4 h-4" /> },
  { id: "security", number: "8", title: "Data Security", icon: <Lock className="w-4 h-4" /> },
  { id: "international", number: "9", title: "International Transfers", icon: <Globe className="w-4 h-4" /> },
  { id: "children", number: "10", title: "Children's Privacy", icon: <Baby className="w-4 h-4" /> },
  { id: "changes", number: "11", title: "Changes to This Policy", icon: <RefreshCw className="w-4 h-4" /> },
  { id: "complaints", number: "12", title: "Complaints", icon: <AlertTriangle className="w-4 h-4" /> },
  { id: "contact", number: "13", title: "Contact Us", icon: <Phone className="w-4 h-4" /> },
];

export default function PrivacyPage() {
  const [activeSection, setActiveSection] = useState("introduction");
  const lastUpdated = "March 2026";

  useEffect(() => {
    const handleScroll = () => {
      const sectionElements = sections.map(s => ({
        id: s.id,
        element: document.getElementById(s.id)
      }));

      for (const section of sectionElements) {
        if (section.element) {
          const rect = section.element.getBoundingClientRect();
          if (rect.top <= 150 && rect.bottom > 150) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: elementPosition - offset,
        behavior: "smooth"
      });
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-16 md:py-20 relative overflow-hidden">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }} />
          </div>

          <div className="section-container relative z-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </Link>

            <div className="flex items-start gap-5 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Privacy Policy</h1>
                <p className="text-slate-400 mt-2 text-lg">How we protect and handle your data</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-400 text-sm bg-slate-800/50 rounded-lg px-4 py-2 w-fit">
              <Calendar className="w-4 h-4 text-blue-500" />
              <span>Last Updated: <span className="text-white font-medium">{lastUpdated}</span></span>
            </div>
          </div>
        </section>

        {/* Quick Summary Cards */}
        <section className="py-8 -mt-8">
          <div className="section-container">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Database className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">What We Collect</h3>
                <p className="text-sm text-slate-500">Only data needed to provide our service</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <Eye className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Transparency</h3>
                <p className="text-sm text-slate-500">Clear about how we use your data</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-3">
                  <Trash2 className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Right to Delete</h3>
                <p className="text-sm text-slate-500">Request deletion of your data anytime</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                  <Download className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Data Portability</h3>
                <p className="text-sm text-slate-500">Export your data in common formats</p>
              </div>
            </div>
          </div>
        </section>

        {/* Content Section */}
        <div className="section-container py-12 md:py-16">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Table of Contents Sidebar */}
            <aside className="lg:w-80 shrink-0">
              <div className="lg:sticky lg:top-24">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    Table of Contents
                  </h2>
                  <nav className="space-y-1">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
                          activeSection === section.id
                            ? "bg-blue-50 text-blue-600 border-l-2 border-blue-500"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          activeSection === section.id
                            ? "bg-blue-500 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}>
                          {section.number}
                        </span>
                        <span className="text-sm font-medium truncate flex-1">{section.title}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${
                          activeSection === section.id ? "text-blue-500" : "text-slate-300 group-hover:translate-x-0.5"
                        }`} />
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <article className="flex-1 min-w-0">
              <div className="prose prose-slate prose-lg max-w-none
                prose-headings:font-bold prose-headings:text-slate-900
                prose-h2:text-2xl prose-h2:mt-0 prose-h2:mb-6
                prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3
                prose-p:text-slate-600 prose-p:leading-relaxed
                prose-li:text-slate-600
                prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-slate-900">

                {/* Section 1: Introduction */}
                <section id="introduction" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="!mb-0">1. Introduction</h2>
                  </div>

                  <p>
                    {SITE_NAME} ("we", "our", or "us") is committed to protecting your privacy. This Privacy
                    Policy explains how we collect, use, disclose, and safeguard your information when you
                    use our website and services.
                  </p>
                  <p>
                    We comply with the UK General Data Protection Regulation (UK GDPR) and the Data Protection
                    Act 2018. By using our services, you consent to the data practices described in this policy.
                  </p>

                  <div className="not-prose bg-slate-50 rounded-xl p-6 border-l-4 border-blue-500 my-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-slate-500 mb-1">Data Controller</div>
                        <div className="font-semibold text-slate-900">{SITE_NAME}</div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-500 mb-1">Contact</div>
                        <div className="font-semibold text-slate-900">{SUPPORT_EMAIL || "privacy@locksafe.uk"}</div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 2: Information We Collect */}
                <section id="information-collected" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Database className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h2 className="!mb-0">2. Information We Collect</h2>
                  </div>

                  <h3>2.1 Information You Provide</h3>
                  <p>We collect information you voluntarily provide, including:</p>

                  <div className="not-prose my-6 grid gap-3">
                    {[
                      { label: "Account Information", desc: "Name, email address, phone number, password" },
                      { label: "Location Data", desc: "Postcode and address for service requests" },
                      { label: "Payment Information", desc: "Processed securely by Stripe (we don't store card details)" },
                      { label: "Job Details", desc: "Description of lock problems, photos you upload" },
                      { label: "Communications", desc: "Messages and support requests" },
                    ].map((item, i) => (
                      <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="font-semibold text-slate-900 mb-1">{item.label}</div>
                        <div className="text-slate-600 text-sm">{item.desc}</div>
                      </div>
                    ))}
                  </div>

                  <h3>2.2 Information Collected Automatically</h3>
                  <p>When you use our services, we automatically collect:</p>

                  <div className="not-prose my-6 grid sm:grid-cols-2 gap-3">
                    {[
                      { label: "Device Information", desc: "Browser type, operating system, device identifiers" },
                      { label: "Usage Data", desc: "Pages visited, features used, time spent" },
                      { label: "GPS/Location Data", desc: "For locksmiths (arrival verification) and customers (service location)" },
                      { label: "Cookies", desc: "See our Cookie Policy for details" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-3 bg-indigo-50 rounded-lg px-4 py-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full mt-2" />
                        <div>
                          <span className="font-medium text-slate-900">{item.label}:</span>
                          <span className="text-slate-600 text-sm ml-1">{item.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <h3>2.3 Information From Third Parties</h3>
                  <p>We may receive information from:</p>
                  <ul>
                    <li><strong>Payment Processors:</strong> Transaction confirmations from Stripe</li>
                    <li><strong>Verification Services:</strong> DBS check results for locksmiths</li>
                    <li><strong>Mapping Services:</strong> Location data from Mapbox</li>
                  </ul>
                </section>

                {/* Section 3: How We Use Information */}
                <section id="how-we-use" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Eye className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="!mb-0">3. How We Use Your Information</h2>
                  </div>

                  <div className="not-prose space-y-4 my-6">
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-green-50 px-5 py-3 border-b border-slate-200">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                          <span className="w-6 h-6 bg-green-500 rounded text-white text-xs flex items-center justify-center font-bold">3.1</span>
                          Service Delivery
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full ml-auto">Legal Basis: Contract</span>
                        </h4>
                      </div>
                      <div className="p-5">
                        <ul className="space-y-2 text-slate-600 text-sm">
                          <li className="flex items-center gap-2"><span className="text-green-500">•</span> Connect customers with locksmiths</li>
                          <li className="flex items-center gap-2"><span className="text-green-500">•</span> Process payments and refunds</li>
                          <li className="flex items-center gap-2"><span className="text-green-500">•</span> Generate job reports and documentation</li>
                          <li className="flex items-center gap-2"><span className="text-green-500">•</span> Verify locksmith arrival using GPS</li>
                          <li className="flex items-center gap-2"><span className="text-green-500">•</span> Send job-related notifications</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-blue-50 px-5 py-3 border-b border-slate-200">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                          <span className="w-6 h-6 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">3.2</span>
                          Platform Safety
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full ml-auto">Legal Basis: Legitimate Interest</span>
                        </h4>
                      </div>
                      <div className="p-5">
                        <ul className="space-y-2 text-slate-600 text-sm">
                          <li className="flex items-center gap-2"><span className="text-blue-500">•</span> Verify locksmith credentials and background</li>
                          <li className="flex items-center gap-2"><span className="text-blue-500">•</span> Detect and prevent fraud</li>
                          <li className="flex items-center gap-2"><span className="text-blue-500">•</span> Resolve disputes using documented evidence</li>
                          <li className="flex items-center gap-2"><span className="text-blue-500">•</span> Maintain platform security</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-purple-50 px-5 py-3 border-b border-slate-200">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                          <span className="w-6 h-6 bg-purple-500 rounded text-white text-xs flex items-center justify-center font-bold">3.3</span>
                          Improvement
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full ml-auto">Legal Basis: Legitimate Interest</span>
                        </h4>
                      </div>
                      <div className="p-5">
                        <ul className="space-y-2 text-slate-600 text-sm">
                          <li className="flex items-center gap-2"><span className="text-purple-500">•</span> Analyse usage to improve our services</li>
                          <li className="flex items-center gap-2"><span className="text-purple-500">•</span> Develop new features</li>
                          <li className="flex items-center gap-2"><span className="text-purple-500">•</span> Conduct research and analytics</li>
                        </ul>
                      </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="bg-orange-50 px-5 py-3 border-b border-slate-200">
                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                          <span className="w-6 h-6 bg-orange-500 rounded text-white text-xs flex items-center justify-center font-bold">3.4</span>
                          Marketing
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full ml-auto">Legal Basis: Consent</span>
                        </h4>
                      </div>
                      <div className="p-5">
                        <ul className="space-y-2 text-slate-600 text-sm">
                          <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Send promotional emails (only with your opt-in consent)</li>
                          <li className="flex items-center gap-2"><span className="text-orange-500">•</span> Show relevant advertisements</li>
                        </ul>
                        <p className="text-sm text-slate-500 mt-3 italic">You can opt out of marketing communications at any time.</p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 4: GPS and Location Data */}
                <section id="gps-data" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <MapPin className="w-5 h-5 text-red-600" />
                    </div>
                    <h2 className="!mb-0">4. GPS and Location Data</h2>
                  </div>

                  <div className="not-prose bg-red-50 rounded-xl p-6 border border-red-200 my-6">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2">Our anti-fraud protection relies on GPS data</h4>
                        <p className="text-slate-600 text-sm">
                          This is a core feature that protects both customers and locksmiths.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="not-prose grid sm:grid-cols-2 gap-4 my-6">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-slate-900 mb-2">For Customers</h4>
                      <p className="text-slate-600 text-sm">
                        Your address is used to match you with nearby locksmiths and appears on job documentation.
                      </p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                        <MapPin className="w-5 h-5 text-orange-600" />
                      </div>
                      <h4 className="font-semibold text-slate-900 mb-2">For Locksmiths</h4>
                      <p className="text-slate-600 text-sm">
                        GPS coordinates are captured when you mark arrival and completion. This proves you attended the job location.
                      </p>
                    </div>
                  </div>

                  <div className="not-prose bg-slate-100 rounded-xl p-4 my-6">
                    <p className="text-slate-700 text-sm">
                      <strong>Retention:</strong> GPS data is stored as part of the job record and included in PDF reports. It is retained for 7 years for legal and dispute resolution purposes.
                    </p>
                  </div>
                </section>

                {/* Section 5: Data Sharing */}
                <section id="data-sharing" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Users className="w-5 h-5 text-violet-600" />
                    </div>
                    <h2 className="!mb-0">5. Who We Share Your Data With</h2>
                  </div>

                  <p>We share your information with:</p>

                  <div className="not-prose my-6 grid gap-3">
                    {[
                      { name: "Customers & Locksmiths", desc: "Job-related information shared between parties (name, phone, address, job details)" },
                      { name: "Stripe", desc: "For secure payment processing" },
                      { name: "Mapbox", desc: "For mapping and location services" },
                      { name: "Resend", desc: "For sending transactional emails" },
                      { name: "Vercel", desc: "For hosting our services" },
                      { name: "Legal Authorities", desc: "If required by law or to protect rights" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4 bg-white rounded-xl p-4 border border-slate-200">
                        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center text-violet-600 font-bold text-sm shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-slate-600 text-sm">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="not-prose bg-green-50 border border-green-200 rounded-xl p-4 my-6 flex items-start gap-3">
                    <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                    <p className="text-green-800 text-sm">
                      <strong>We do not sell your personal data</strong> to third parties. We do not share your data for third-party marketing without your explicit consent.
                    </p>
                  </div>
                </section>

                {/* Section 6: Data Retention */}
                <section id="data-retention" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                      <Database className="w-5 h-5 text-cyan-600" />
                    </div>
                    <h2 className="!mb-0">6. Data Retention</h2>
                  </div>

                  <p>We retain your data for the following periods:</p>

                  <div className="not-prose my-6">
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-5 py-3 text-sm font-semibold text-slate-900">Data Type</th>
                            <th className="px-5 py-3 text-sm font-semibold text-slate-900">Retention Period</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Account Data</td>
                            <td className="px-5 py-4 text-slate-600">Until you delete your account</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Job Records</td>
                            <td className="px-5 py-4 text-slate-600">7 years (legal and tax compliance)</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Payment Records</td>
                            <td className="px-5 py-4 text-slate-600">7 years (financial regulations)</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Marketing Preferences</td>
                            <td className="px-5 py-4 text-slate-600">Until you withdraw consent</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Support Communications</td>
                            <td className="px-5 py-4 text-slate-600">3 years</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* Section 7: Your Rights */}
                <section id="your-rights" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h2 className="!mb-0">7. Your Rights Under GDPR</h2>
                  </div>

                  <p>You have the following rights regarding your personal data:</p>

                  <div className="not-prose grid sm:grid-cols-2 lg:grid-cols-3 gap-4 my-6">
                    {[
                      { title: "Right to Access", desc: "Request a copy of all personal data we hold about you.", color: "blue" },
                      { title: "Right to Rectification", desc: "Request correction of inaccurate personal data.", color: "green" },
                      { title: "Right to Erasure", desc: "Request deletion of your personal data (\"right to be forgotten\").", color: "red" },
                      { title: "Right to Portability", desc: "Receive your data in a machine-readable format.", color: "purple" },
                      { title: "Right to Object", desc: "Object to processing based on legitimate interests.", color: "orange" },
                      { title: "Right to Restrict", desc: "Request restriction of processing in certain circumstances.", color: "cyan" },
                    ].map((item, i) => (
                      <div key={i} className={`bg-${item.color}-50 rounded-xl p-5 border border-${item.color}-100`}>
                        <h4 className="font-semibold text-slate-900 mb-2">{item.title}</h4>
                        <p className="text-sm text-slate-600">{item.desc}</p>
                      </div>
                    ))}
                  </div>

                  <p>
                    To exercise any of these rights, contact us at {SUPPORT_EMAIL || "privacy@locksafe.uk"}.
                    We will respond within 30 days.
                  </p>
                </section>

                {/* Section 8: Data Security */}
                <section id="security" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Lock className="w-5 h-5 text-slate-600" />
                    </div>
                    <h2 className="!mb-0">8. Data Security</h2>
                  </div>

                  <p>
                    We implement appropriate technical and organisational measures to protect your personal
                    data, including:
                  </p>

                  <div className="not-prose my-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      "Encryption of data in transit (HTTPS/TLS)",
                      "Secure database storage with encryption at rest",
                      "Regular security assessments",
                      "Access controls and authentication",
                      "Employee training on data protection",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3">
                        <div className="w-2 h-2 bg-slate-500 rounded-full" />
                        <span className="text-slate-700 text-sm">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="not-prose bg-blue-50 border border-blue-200 rounded-xl p-4 my-6">
                    <p className="text-blue-800 text-sm">
                      <strong>Payment Security:</strong> Payment information is processed by Stripe, which is PCI DSS compliant. We never store your full card details on our servers.
                    </p>
                  </div>
                </section>

                {/* Section 9: International Transfers */}
                <section id="international" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                      <Globe className="w-5 h-5 text-sky-600" />
                    </div>
                    <h2 className="!mb-0">9. International Data Transfers</h2>
                  </div>

                  <p>
                    Some of our service providers may process data outside the UK/EEA. Where this occurs,
                    we ensure appropriate safeguards are in place, such as Standard Contractual Clauses
                    or adequacy decisions.
                  </p>
                </section>

                {/* Section 10: Children's Privacy */}
                <section id="children" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                      <Baby className="w-5 h-5 text-pink-600" />
                    </div>
                    <h2 className="!mb-0">10. Children's Privacy</h2>
                  </div>

                  <p>
                    Our services are not intended for individuals under 18 years of age. We do not knowingly
                    collect personal data from children. If we become aware that we have collected data from
                    a child, we will delete it promptly.
                  </p>
                </section>

                {/* Section 11: Changes */}
                <section id="changes" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="!mb-0">11. Changes to This Policy</h2>
                  </div>

                  <p>
                    We may update this Privacy Policy from time to time. We will notify you of material
                    changes by email or through the Platform. The date of the last update is shown at the
                    top of this page.
                  </p>
                </section>

                {/* Section 12: Complaints */}
                <section id="complaints" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <h2 className="!mb-0">12. Complaints</h2>
                  </div>

                  <p>
                    If you have concerns about how we handle your data, please contact us first. If you are
                    not satisfied with our response, you have the right to lodge a complaint with the
                    Information Commissioner's Office (ICO):
                  </p>

                  <div className="not-prose bg-slate-50 rounded-xl p-6 border border-slate-200 my-6">
                    <div className="font-semibold text-slate-900 mb-2">Information Commissioner's Office</div>
                    <div className="text-slate-600 text-sm space-y-1">
                      <p>Website: <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ico.org.uk</a></p>
                      <p>Phone: 0303 123 1113</p>
                    </div>
                  </div>
                </section>

                {/* Section 13: Contact */}
                <section id="contact" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="!mb-0">13. Contact Us</h2>
                  </div>

                  <p>For any privacy-related questions or to exercise your rights:</p>

                  <div className="not-prose mt-6">
                    <a
                      href={`mailto:${SUPPORT_EMAIL || "privacy@locksafe.uk"}`}
                      className="inline-flex items-center gap-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl px-6 py-4 hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35"
                    >
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm text-blue-100">Data Protection Officer</div>
                        <div className="font-semibold">{SUPPORT_EMAIL || "privacy@locksafe.uk"}</div>
                      </div>
                    </a>
                  </div>
                </section>
              </div>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
