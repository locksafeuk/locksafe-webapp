"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  Cookie,
  ArrowLeft,
  Calendar,
  Mail,
  ChevronRight,
  Settings,
  Shield,
  BarChart3,
  Target,
  HelpCircle,
  Globe,
  Sliders,
  RefreshCw,
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
  { id: "introduction", number: "1", title: "What Are Cookies?", icon: <BookOpen className="w-4 h-4" /> },
  { id: "cookie-types", number: "2", title: "Types of Cookies We Use", icon: <Cookie className="w-4 h-4" /> },
  { id: "third-party", number: "3", title: "Third-Party Cookies", icon: <Globe className="w-4 h-4" /> },
  { id: "managing-cookies", number: "4", title: "Managing Your Preferences", icon: <Sliders className="w-4 h-4" /> },
  { id: "do-not-track", number: "5", title: "Do Not Track", icon: <Shield className="w-4 h-4" /> },
  { id: "updates", number: "6", title: "Updates to This Policy", icon: <RefreshCw className="w-4 h-4" /> },
  { id: "contact", number: "7", title: "Contact Us", icon: <Phone className="w-4 h-4" /> },
];

export default function CookiesPage() {
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
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/25">
                <Cookie className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Cookie Policy</h1>
                <p className="text-slate-400 mt-2 text-lg">How we use cookies and similar technologies</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-400 text-sm bg-slate-800/50 rounded-lg px-4 py-2 w-fit">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>Last Updated: <span className="text-white font-medium">{lastUpdated}</span></span>
            </div>
          </div>
        </section>

        {/* Cookie Categories Summary */}
        <section className="py-8 -mt-8">
          <div className="section-container">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Essential</h3>
                <p className="text-sm text-slate-500">Required for basic functionality</p>
                <span className="inline-block mt-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">Always Active</span>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Settings className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Functional</h3>
                <p className="text-sm text-slate-500">Remember your preferences</p>
                <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">Optional</span>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Analytics</h3>
                <p className="text-sm text-slate-500">Help us improve our service</p>
                <span className="inline-block mt-2 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Optional</span>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
                  <Target className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Marketing</h3>
                <p className="text-sm text-slate-500">Personalised advertisements</p>
                <span className="inline-block mt-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-medium">Optional</span>
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
                            ? "bg-amber-50 text-amber-600 border-l-2 border-amber-500"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          activeSection === section.id
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}>
                          {section.number}
                        </span>
                        <span className="text-sm font-medium truncate flex-1">{section.title}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${
                          activeSection === section.id ? "text-amber-500" : "text-slate-300 group-hover:translate-x-0.5"
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
                prose-a:text-amber-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-slate-900">

                {/* Section 1: Introduction */}
                <section id="introduction" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="!mb-0">1. What Are Cookies?</h2>
                  </div>

                  <p>
                    Cookies are small text files that are stored on your device (computer, tablet, or mobile)
                    when you visit a website. They help the website remember your preferences and understand
                    how you interact with the site.
                  </p>
                  <p>
                    {SITE_NAME} uses cookies and similar technologies to provide, protect, and improve our
                    services. This policy explains what cookies we use, why we use them, and how you can
                    control them.
                  </p>
                </section>

                {/* Section 2: Types of Cookies */}
                <section id="cookie-types" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Cookie className="w-5 h-5 text-orange-600" />
                    </div>
                    <h2 className="!mb-0">2. Types of Cookies We Use</h2>
                  </div>

                  {/* Essential Cookies */}
                  <div className="not-prose mb-6">
                    <div className="bg-green-50 rounded-xl border border-green-200 overflow-hidden">
                      <div className="bg-green-100 px-5 py-3 border-b border-green-200 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <Shield className="w-5 h-5 text-green-600" />
                          2.1 Essential Cookies
                        </h3>
                        <span className="text-xs bg-green-600 text-white px-2 py-1 rounded-full font-medium">Always Active</span>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-600 mb-4 text-sm">
                          These cookies are necessary for the website to function properly. They enable core
                          functionality such as security, authentication, and accessibility. You cannot opt out
                          of these cookies.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Cookie Name</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Purpose</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Duration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              <tr>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">auth_token</td>
                                <td className="px-4 py-3 text-slate-600">Keeps you logged in</td>
                                <td className="px-4 py-3 text-slate-600">7 days</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">session_id</td>
                                <td className="px-4 py-3 text-slate-600">Maintains your session</td>
                                <td className="px-4 py-3 text-slate-600">Session</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">csrf_token</td>
                                <td className="px-4 py-3 text-slate-600">Security protection</td>
                                <td className="px-4 py-3 text-slate-600">Session</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">cookie_consent</td>
                                <td className="px-4 py-3 text-slate-600">Remembers your cookie preferences</td>
                                <td className="px-4 py-3 text-slate-600">1 year</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Functional Cookies */}
                  <div className="not-prose mb-6">
                    <div className="bg-blue-50 rounded-xl border border-blue-200 overflow-hidden">
                      <div className="bg-blue-100 px-5 py-3 border-b border-blue-200 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <Settings className="w-5 h-5 text-blue-600" />
                          2.2 Functional Cookies
                        </h3>
                        <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-medium">Optional</span>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-600 mb-4 text-sm">
                          These cookies enable enhanced functionality and personalisation, such as remembering
                          your preferences and settings.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Cookie Name</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Purpose</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Duration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              <tr>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">user_preferences</td>
                                <td className="px-4 py-3 text-slate-600">Remembers display preferences</td>
                                <td className="px-4 py-3 text-slate-600">1 year</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">last_location</td>
                                <td className="px-4 py-3 text-slate-600">Remembers your last searched location</td>
                                <td className="px-4 py-3 text-slate-600">30 days</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analytics Cookies */}
                  <div className="not-prose mb-6">
                    <div className="bg-purple-50 rounded-xl border border-purple-200 overflow-hidden">
                      <div className="bg-purple-100 px-5 py-3 border-b border-purple-200 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <BarChart3 className="w-5 h-5 text-purple-600" />
                          2.3 Analytics Cookies
                        </h3>
                        <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded-full font-medium">Optional</span>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-600 mb-4 text-sm">
                          These cookies help us understand how visitors interact with our website by collecting
                          and reporting information anonymously.
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Cookie Name</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Provider</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Purpose</th>
                                <th className="text-left px-4 py-3 font-semibold text-slate-900">Duration</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                              <tr>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">_ga</td>
                                <td className="px-4 py-3 text-slate-600">Google Analytics</td>
                                <td className="px-4 py-3 text-slate-600">Distinguishes users</td>
                                <td className="px-4 py-3 text-slate-600">2 years</td>
                              </tr>
                              <tr>
                                <td className="px-4 py-3 font-mono text-xs text-slate-700">_ga_*</td>
                                <td className="px-4 py-3 text-slate-600">Google Analytics</td>
                                <td className="px-4 py-3 text-slate-600">Maintains session state</td>
                                <td className="px-4 py-3 text-slate-600">2 years</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Marketing Cookies */}
                  <div className="not-prose mb-6">
                    <div className="bg-orange-50 rounded-xl border border-orange-200 overflow-hidden">
                      <div className="bg-orange-100 px-5 py-3 border-b border-orange-200 flex items-center justify-between">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <Target className="w-5 h-5 text-orange-600" />
                          2.4 Marketing Cookies
                        </h3>
                        <span className="text-xs bg-orange-600 text-white px-2 py-1 rounded-full font-medium">Optional</span>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-600 mb-3 text-sm">
                          These cookies are used to track visitors across websites to display relevant
                          advertisements. They are set by advertising partners and may be used to build a
                          profile of your interests.
                        </p>
                        <div className="bg-white rounded-lg p-4 border border-orange-100 flex items-start gap-3">
                          <HelpCircle className="w-5 h-5 text-orange-500 mt-0.5" />
                          <p className="text-slate-700 text-sm">
                            <strong>We currently do not use marketing cookies.</strong> If this changes, we will
                            update this policy and request your consent.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 3: Third-Party Cookies */}
                <section id="third-party" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-sky-100 rounded-xl flex items-center justify-center">
                      <Globe className="w-5 h-5 text-sky-600" />
                    </div>
                    <h2 className="!mb-0">3. Third-Party Cookies</h2>
                  </div>

                  <p>Some cookies are placed by third-party services that appear on our pages:</p>

                  <div className="not-prose my-6 grid gap-3">
                    {[
                      { name: "Stripe", desc: "Payment processing (essential for checkout)" },
                      { name: "Mapbox", desc: "Map functionality (displays locksmith coverage areas)" },
                      { name: "Google Analytics", desc: "Website analytics (with your consent)" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4 bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                        <div className="w-8 h-8 bg-sky-100 rounded-lg flex items-center justify-center text-sky-600 font-bold text-sm shrink-0">
                          {i + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{item.name}</div>
                          <div className="text-slate-600 text-sm">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <p>
                    These third parties have their own privacy policies. We encourage you to review them:
                  </p>

                  <div className="not-prose flex flex-wrap gap-3 my-6">
                    <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                      Stripe Privacy Policy
                    </a>
                    <a href="https://www.mapbox.com/privacy" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                      Mapbox Privacy Policy
                    </a>
                    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                      Google Privacy Policy
                    </a>
                  </div>
                </section>

                {/* Section 4: Managing Cookies */}
                <section id="managing-cookies" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Sliders className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h2 className="!mb-0">4. Managing Your Cookie Preferences</h2>
                  </div>

                  <h3>4.1 Our Cookie Banner</h3>
                  <p>
                    When you first visit {SITE_NAME}, you'll see a cookie consent banner. You can choose
                    to accept all cookies or customise your preferences. Your choices are saved and
                    remembered for future visits.
                  </p>

                  <h3>4.2 Browser Settings</h3>
                  <p>
                    You can also control cookies through your browser settings. Most browsers allow you to:
                  </p>

                  <div className="not-prose my-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      "View what cookies are stored and delete them individually",
                      "Block third-party cookies",
                      "Block cookies from specific sites",
                      "Block all cookies",
                      "Delete all cookies when you close your browser",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-indigo-50 rounded-lg px-4 py-3">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full" />
                        <span className="text-slate-700 text-sm">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="not-prose bg-amber-50 border border-amber-200 rounded-xl p-4 my-6">
                    <p className="text-amber-800 text-sm">
                      <strong>Note:</strong> Blocking essential cookies may prevent you from using certain
                      features of our website, such as logging in or making payments.
                    </p>
                  </div>

                  <h3>4.3 Browser-Specific Instructions</h3>

                  <div className="not-prose flex flex-wrap gap-3 my-6">
                    <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                      Google Chrome
                    </a>
                    <a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                      Mozilla Firefox
                    </a>
                    <a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                      Safari
                    </a>
                    <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 text-sm font-medium transition-colors">
                      Microsoft Edge
                    </a>
                  </div>
                </section>

                {/* Section 5: Do Not Track */}
                <section id="do-not-track" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-slate-600" />
                    </div>
                    <h2 className="!mb-0">5. Do Not Track</h2>
                  </div>

                  <p>
                    Some browsers have a "Do Not Track" (DNT) feature that sends a signal to websites
                    requesting that your browsing activity not be tracked. Currently, there is no uniform
                    standard for how DNT signals should be interpreted.
                  </p>
                  <p>
                    {SITE_NAME} respects your cookie preferences set through our consent banner. We do not
                    currently respond to DNT browser signals separately, but we honour your choices made
                    in our cookie settings.
                  </p>
                </section>

                {/* Section 6: Updates */}
                <section id="updates" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-teal-600" />
                    </div>
                    <h2 className="!mb-0">6. Updates to This Policy</h2>
                  </div>

                  <p>
                    We may update this Cookie Policy from time to time to reflect changes in our practices
                    or for legal reasons. When we make changes, we will update the "Last updated" date at
                    the top of this page. Material changes will be communicated via a new cookie consent
                    prompt.
                  </p>
                </section>

                {/* Section 7: Contact */}
                <section id="contact" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="!mb-0">7. Contact Us</h2>
                  </div>

                  <p>If you have questions about our use of cookies, please contact us:</p>

                  <div className="not-prose mt-6">
                    <a
                      href={`mailto:${SUPPORT_EMAIL || "privacy@locksafe.uk"}`}
                      className="inline-flex items-center gap-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl px-6 py-4 hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/35"
                    >
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm text-amber-100">Email us at</div>
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
