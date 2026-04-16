"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  RefreshCw,
  ArrowLeft,
  Calendar,
  Mail,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Shield,
  CreditCard,
  Wrench,
  HelpCircle,
  Phone,
  BookOpen,
  FileText,
} from "lucide-react";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/config";

interface Section {
  id: string;
  number: string;
  title: string;
  icon: React.ReactNode;
}

const sections: Section[] = [
  { id: "overview", number: "1", title: "Overview", icon: <BookOpen className="w-4 h-4" /> },
  { id: "eligible-refunds", number: "2", title: "When You Can Get a Refund", icon: <CheckCircle2 className="w-4 h-4" /> },
  { id: "non-refundable", number: "3", title: "When You Cannot Get a Refund", icon: <XCircle className="w-4 h-4" /> },
  { id: "summary", number: "4", title: "Refund Summary", icon: <FileText className="w-4 h-4" /> },
  { id: "processing", number: "5", title: "How Refunds Are Processed", icon: <CreditCard className="w-4 h-4" /> },
  { id: "disputes", number: "6", title: "Dispute Resolution", icon: <AlertCircle className="w-4 h-4" /> },
  { id: "locksmiths", number: "7", title: "Information for Locksmiths", icon: <Wrench className="w-4 h-4" /> },
  { id: "contact", number: "8", title: "Contact Us", icon: <Phone className="w-4 h-4" /> },
  { id: "related", number: "9", title: "Related Policies", icon: <HelpCircle className="w-4 h-4" /> },
];

export default function RefundPolicyPage() {
  const [activeSection, setActiveSection] = useState("overview");
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
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/25">
                <RefreshCw className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Refund Policy</h1>
                <p className="text-slate-400 mt-2 text-lg">Fair protection for customers and locksmiths</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-400 text-sm bg-slate-800/50 rounded-lg px-4 py-2 w-fit">
              <Calendar className="w-4 h-4 text-green-500" />
              <span>Last Updated: <span className="text-white font-medium">{lastUpdated}</span></span>
            </div>
          </div>
        </section>

        {/* Quick Summary Cards */}
        <section className="py-8 -mt-8">
          <div className="section-container">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">No-Show Guarantee</h3>
                <p className="text-sm text-slate-500">Full refund if locksmith doesn't arrive</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">30-Min Grace Period</h3>
                <p className="text-sm text-slate-500">Refund if 30+ minutes past ETA</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-3">
                  <Shield className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Fair for Everyone</h3>
                <p className="text-sm text-slate-500">Protects customers & locksmiths</p>
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
                            ? "bg-green-50 text-green-600 border-l-2 border-green-500"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          activeSection === section.id
                            ? "bg-green-500 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}>
                          {section.number}
                        </span>
                        <span className="text-sm font-medium truncate flex-1">{section.title}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${
                          activeSection === section.id ? "text-green-500" : "text-slate-300 group-hover:translate-x-0.5"
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
                prose-a:text-green-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-slate-900">

                {/* Section 1: Overview */}
                <section id="overview" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="!mb-0">1. Overview</h2>
                  </div>

                  <p>
                    At {SITE_NAME}, we believe in fair treatment for both customers and locksmiths.
                    Our refund policy is designed to protect customers while respecting the time
                    and effort of our locksmith partners.
                  </p>

                  <div className="not-prose bg-slate-50 rounded-xl p-6 border-l-4 border-green-500 my-6">
                    <p className="text-slate-700 font-medium">
                      Our goal is to ensure that every transaction on our platform is fair, transparent,
                      and protected by clear guidelines.
                    </p>
                  </div>
                </section>

                {/* Section 2: When You Can Get a Refund */}
                <section id="eligible-refunds" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h2 className="!mb-0">2. When You Can Get a Refund</h2>
                  </div>

                  <div className="not-prose space-y-4 my-6">
                    <div className="bg-green-50 rounded-xl border border-green-200 overflow-hidden">
                      <div className="bg-green-100 px-5 py-3 border-b border-green-200">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          Locksmith No-Show
                        </h3>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-600 mb-4">
                          If the locksmith you booked does not arrive at all, or arrives more than
                          30 minutes after their stated ETA, you are entitled to a <strong className="text-slate-900">full refund</strong> of
                          your Assessment Fee.
                        </p>
                        <div className="bg-white rounded-lg p-4 border border-green-100">
                          <div className="font-medium text-slate-900 mb-3">How to claim:</div>
                          <div className="space-y-2">
                            {[
                              "Open your job in your account",
                              "Click \"Request Refund\"",
                              "Select \"Locksmith didn't arrive\"",
                              "We verify using GPS data",
                              "Refund processed automatically (3-5 business days)"
                            ].map((step, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                                  {i + 1}
                                </div>
                                <span className="text-slate-600 text-sm pt-0.5">{step}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-green-50 rounded-xl border border-green-200 overflow-hidden">
                      <div className="bg-green-100 px-5 py-3 border-b border-green-200">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                          Cancellation Before Dispatch
                        </h3>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-600">
                          If you cancel your booking <strong className="text-slate-900">before</strong> the locksmith has been dispatched,
                          you receive a full refund with no cancellation fee.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 3: When You Cannot Get a Refund */}
                <section id="non-refundable" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <h2 className="!mb-0">3. When You Cannot Get a Refund</h2>
                  </div>

                  <div className="not-prose space-y-4 my-6">
                    <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
                      <div className="bg-red-100 px-5 py-3 border-b border-red-200">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-600" />
                          Assessment Fee After Locksmith Travels
                        </h3>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-600 mb-4">
                          The Assessment Fee compensates the locksmith for their travel time, fuel costs, and
                          diagnostic expertise. Once the locksmith has been dispatched and travels to your
                          location, the Assessment Fee is <strong className="text-slate-900">non-refundable</strong> even if:
                        </p>
                        <div className="space-y-2">
                          {[
                            "You change your mind",
                            "You're not home when they arrive",
                            "You decline the Work Quote"
                          ].map((item, i) => (
                            <div key={i} className="flex items-center gap-2 text-slate-600 text-sm">
                              <XCircle className="w-4 h-4 text-red-500" />
                              {item}
                            </div>
                          ))}
                        </div>
                        <p className="text-sm text-slate-500 mt-4 italic border-t border-red-100 pt-4">
                          This policy ensures locksmiths are fairly compensated for their time and remain
                          willing to take jobs.
                        </p>
                      </div>
                    </div>

                    <div className="bg-red-50 rounded-xl border border-red-200 overflow-hidden">
                      <div className="bg-red-100 px-5 py-3 border-b border-red-200">
                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-red-600" />
                          Work Already Completed
                        </h3>
                      </div>
                      <div className="p-5">
                        <p className="text-slate-600 mb-3">
                          Once you have accepted a Work Quote, had the work completed, and signed the
                          digital confirmation, the payment is <strong className="text-slate-900">non-refundable</strong>.
                        </p>
                        <p className="text-slate-600">
                          Your digital signature confirms satisfaction with the work. If there's a problem
                          with the work quality, contact the locksmith directly or reach out to us for
                          dispute mediation.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Section 4: Refund Summary Table */}
                <section id="summary" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <FileText className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="!mb-0">4. Refund Summary</h2>
                  </div>

                  <div className="not-prose my-6">
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full">
                        <thead className="bg-slate-100">
                          <tr>
                            <th className="text-left px-5 py-3 font-semibold text-slate-900">Situation</th>
                            <th className="text-center px-5 py-3 font-semibold text-slate-900 w-24">Refund?</th>
                            <th className="text-left px-5 py-3 font-semibold text-slate-900 hidden sm:table-cell">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr className="bg-green-50/50">
                            <td className="px-5 py-4 text-slate-700">Locksmith no-show</td>
                            <td className="px-5 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" /></td>
                            <td className="px-5 py-4 text-green-700 font-medium hidden sm:table-cell">100% Assessment Fee</td>
                          </tr>
                          <tr className="bg-green-50/50">
                            <td className="px-5 py-4 text-slate-700">Locksmith 30+ minutes late</td>
                            <td className="px-5 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" /></td>
                            <td className="px-5 py-4 text-green-700 font-medium hidden sm:table-cell">100% Assessment Fee</td>
                          </tr>
                          <tr className="bg-green-50/50">
                            <td className="px-5 py-4 text-slate-700">Cancel before locksmith dispatched</td>
                            <td className="px-5 py-4 text-center"><CheckCircle2 className="w-5 h-5 text-green-600 mx-auto" /></td>
                            <td className="px-5 py-4 text-green-700 font-medium hidden sm:table-cell">100% Assessment Fee</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Cancel after locksmith leaves</td>
                            <td className="px-5 py-4 text-center"><XCircle className="w-5 h-5 text-red-500 mx-auto" /></td>
                            <td className="px-5 py-4 text-slate-400 hidden sm:table-cell">—</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Decline Work Quote</td>
                            <td className="px-5 py-4 text-center"><XCircle className="w-5 h-5 text-red-500 mx-auto" /></td>
                            <td className="px-5 py-4 text-slate-400 hidden sm:table-cell">—</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Work completed & signed</td>
                            <td className="px-5 py-4 text-center"><XCircle className="w-5 h-5 text-red-500 mx-auto" /></td>
                            <td className="px-5 py-4 text-slate-400 hidden sm:table-cell">—</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Customer not home</td>
                            <td className="px-5 py-4 text-center"><XCircle className="w-5 h-5 text-red-500 mx-auto" /></td>
                            <td className="px-5 py-4 text-slate-400 hidden sm:table-cell">—</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-700">Customer changed mind</td>
                            <td className="px-5 py-4 text-center"><XCircle className="w-5 h-5 text-red-500 mx-auto" /></td>
                            <td className="px-5 py-4 text-slate-400 hidden sm:table-cell">—</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* Section 5: How Refunds Are Processed */}
                <section id="processing" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-cyan-600" />
                    </div>
                    <h2 className="!mb-0">5. How Refunds Are Processed</h2>
                  </div>

                  <p>
                    All refunds are processed to your <strong>original payment method</strong>:
                  </p>

                  <div className="not-prose my-6 grid sm:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                        <CreditCard className="w-5 h-5 text-blue-600" />
                      </div>
                      <h4 className="font-semibold text-slate-900 mb-1">Credit/Debit Cards</h4>
                      <p className="text-slate-600 text-sm">3-5 business days</p>
                    </div>
                    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
                      <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                        <CreditCard className="w-5 h-5 text-purple-600" />
                      </div>
                      <h4 className="font-semibold text-slate-900 mb-1">Bank Transfers</h4>
                      <p className="text-slate-600 text-sm">5-7 business days</p>
                    </div>
                  </div>

                  <p>
                    If the refund cannot be processed (e.g., card expired), we will contact you to
                    arrange an alternative refund method.
                  </p>
                </section>

                {/* Section 6: Dispute Resolution */}
                <section id="disputes" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                    </div>
                    <h2 className="!mb-0">6. Dispute Resolution</h2>
                  </div>

                  <p>
                    If you believe you're entitled to a refund that wasn't automatically processed,
                    or if you disagree with a refund decision:
                  </p>

                  <div className="not-prose bg-amber-50 rounded-xl p-6 border border-amber-200 my-6">
                    <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600" />
                      Dispute Process
                    </h3>
                    <div className="space-y-4">
                      {[
                        { step: "1", title: "Contact Us", desc: `Email ${SUPPORT_EMAIL || "support@locksafe.uk"} with your Job ID` },
                        { step: "2", title: "Evidence Review", desc: "We review GPS data, photos, and signatures" },
                        { step: "3", title: "Decision", desc: "Fair decision based on evidence (within 5 business days)" },
                        { step: "4", title: "Appeal", desc: "Submit an appeal within 14 days if you disagree" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="w-8 h-8 bg-amber-200 rounded-full flex items-center justify-center text-amber-800 font-bold text-sm shrink-0">
                            {item.step}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <div className="text-slate-600 text-sm">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Section 7: For Locksmiths */}
                <section id="locksmiths" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Wrench className="w-5 h-5 text-orange-600" />
                    </div>
                    <h2 className="!mb-0">7. Information for Locksmiths</h2>
                  </div>

                  <p>
                    If a refund is issued to a customer due to your no-show or late arrival,
                    the refund amount will be debited from your Stripe Connect account.
                  </p>

                  <div className="not-prose my-6">
                    <div className="bg-orange-50 rounded-xl p-6 border border-orange-200">
                      <h4 className="font-semibold text-slate-900 mb-3">To avoid refunds:</h4>
                      <ul className="space-y-2">
                        {[
                          "Set realistic ETAs with buffer time for traffic",
                          "Communicate delays to customers immediately",
                          "Cancel early if you cannot make it (before travelling)"
                        ].map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-slate-600 text-sm">
                            <CheckCircle2 className="w-4 h-4 text-orange-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="not-prose bg-red-50 border border-red-200 rounded-xl p-4 my-6">
                    <p className="text-red-800 text-sm">
                      <strong>Warning:</strong> Locksmiths with excessive refunds may face account review, suspension,
                      or removal from the platform.
                    </p>
                  </div>
                </section>

                {/* Section 8: Contact */}
                <section id="contact" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="!mb-0">8. Contact Us</h2>
                  </div>

                  <p>For refund queries or to initiate a dispute:</p>

                  <div className="not-prose mt-6">
                    <a
                      href={`mailto:${SUPPORT_EMAIL || "support@locksafe.uk"}`}
                      className="inline-flex items-center gap-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl px-6 py-4 hover:from-green-600 hover:to-green-700 transition-all shadow-lg shadow-green-500/25 hover:shadow-green-500/35"
                    >
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm text-green-100">Refund Support</div>
                        <div className="font-semibold">{SUPPORT_EMAIL || "support@locksafe.uk"}</div>
                      </div>
                    </a>
                  </div>
                </section>

                {/* Section 9: Related Policies */}
                <section id="related" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <HelpCircle className="w-5 h-5 text-slate-600" />
                    </div>
                    <h2 className="!mb-0">9. Related Policies</h2>
                  </div>

                  <div className="not-prose flex flex-wrap gap-3">
                    <Link
                      href="/terms"
                      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Terms of Service
                    </Link>
                    <Link
                      href="/privacy"
                      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      Privacy Policy
                    </Link>
                    <Link
                      href="/help"
                      className="px-5 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <HelpCircle className="w-4 h-4" />
                      Help Centre
                    </Link>
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
