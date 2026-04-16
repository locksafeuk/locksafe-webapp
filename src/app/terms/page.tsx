"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  FileText,
  ArrowLeft,
  Calendar,
  Mail,
  ChevronRight,
  Shield,
  Users,
  Banknote,
  AlertTriangle,
  Scale,
  Database,
  Gavel,
  RefreshCw,
  Phone,
  BookOpen,
  ClipboardList,
  XCircle,
  Receipt,
  Camera,
  Briefcase,
  CreditCard,
  UserX,
} from "lucide-react";

const CONTACT_EMAIL = "contact@locksafe.uk";

interface Section {
  id: string;
  number: string;
  title: string;
  icon: React.ReactNode;
}

const sections: Section[] = [
  { id: "introduction", number: "1", title: "Introduction & Platform Description", icon: <BookOpen className="w-4 h-4" /> },
  { id: "definitions", number: "2", title: "Definitions", icon: <ClipboardList className="w-4 h-4" /> },
  { id: "booking-flow", number: "3", title: "Booking Flow", icon: <RefreshCw className="w-4 h-4" /> },
  { id: "cancellation", number: "4", title: "Customer Cancellation Rights", icon: <XCircle className="w-4 h-4" /> },
  { id: "refund-policy", number: "5", title: "Refund Policy", icon: <Receipt className="w-4 h-4" /> },
  { id: "documentation", number: "6", title: "Documentation & Anti-Fraud System", icon: <Camera className="w-4 h-4" /> },
  { id: "engineer-responsibilities", number: "7", title: "Engineer / Locksmith Responsibilities", icon: <Briefcase className="w-4 h-4" /> },
  { id: "payments", number: "8", title: "Payments & Platform Commission", icon: <CreditCard className="w-4 h-4" /> },
  { id: "contractor", number: "9", title: "Independent Contractor Relationship", icon: <UserX className="w-4 h-4" /> },
  { id: "prohibited-conduct", number: "10", title: "Prohibited Conduct", icon: <AlertTriangle className="w-4 h-4" /> },
  { id: "liability", number: "11", title: "Limitation of Liability", icon: <Shield className="w-4 h-4" /> },
  { id: "disputes", number: "12", title: "Dispute Responsibility", icon: <Scale className="w-4 h-4" /> },
  { id: "data-protection", number: "13", title: "Data Protection & Privacy", icon: <Database className="w-4 h-4" /> },
  { id: "governing-law", number: "14", title: "Governing Law", icon: <Gavel className="w-4 h-4" /> },
  { id: "changes", number: "15", title: "Changes to These Terms", icon: <RefreshCw className="w-4 h-4" /> },
  { id: "contact", number: "16", title: "Contact", icon: <Phone className="w-4 h-4" /> },
];

export default function TermsPage() {
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
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Terms & Conditions</h1>
                <p className="text-slate-400 mt-2 text-lg">LockSafe UK Platform Agreement</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-slate-400 text-sm bg-slate-800/50 rounded-lg px-4 py-2 w-fit">
              <Calendar className="w-4 h-4 text-orange-500" />
              <span>Last Updated: <span className="text-white font-medium">{lastUpdated}</span></span>
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
                            ? "bg-orange-50 text-orange-600 border-l-2 border-orange-500"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          activeSection === section.id
                            ? "bg-orange-500 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}>
                          {section.number}
                        </span>
                        <span className="text-sm font-medium truncate flex-1">{section.title}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${
                          activeSection === section.id ? "text-orange-500" : "text-slate-300 group-hover:translate-x-0.5"
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
                prose-a:text-orange-600 prose-a:no-underline hover:prose-a:underline
                prose-strong:text-slate-900">

                {/* Section 1: Introduction */}
                <section id="introduction" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <BookOpen className="w-5 h-5 text-orange-600" />
                    </div>
                    <h2 className="!mb-0">1. Introduction & Platform Description</h2>
                  </div>

                  <p>
                    Welcome to LockSafe UK ("LockSafe", "we", "our", "us", or the "Platform").
                  </p>
                  <p>
                    These Terms and Conditions ("Terms") govern your access to and use of the LockSafe UK
                    website, applications, and services (collectively, the "Services").
                  </p>
                  <p>
                    By accessing or using the Platform, you agree to be bound by these Terms. If you do
                    not agree to these Terms, you must not use the Services.
                  </p>

                  <div className="bg-slate-50 rounded-xl p-6 border-l-4 border-orange-500 not-prose my-6">
                    <p className="text-slate-700 font-medium mb-3">
                      LockSafe UK operates solely as a technology marketplace connecting customers with
                      independent locksmith professionals.
                    </p>
                    <ul className="space-y-2 text-slate-600">
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">•</span>
                        LockSafe UK does not provide locksmith services, does not employ locksmiths, and
                        does not supervise, direct, or control the work performed by locksmiths.
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-orange-500 mt-1">•</span>
                        All locksmith services are provided directly by independent locksmith professionals
                        who operate as self-employed contractors.
                      </li>
                    </ul>
                  </div>
                </section>

                {/* Section 2: Definitions */}
                <section id="definitions" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <ClipboardList className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="!mb-0">2. Definitions</h2>
                  </div>

                  <p>For the purposes of these Terms:</p>

                  <div className="grid gap-4 not-prose my-6">
                    {[
                      { term: "Customer", definition: "Any individual or entity requesting locksmith services through the Platform." },
                      { term: "Engineer / Locksmith", definition: "An independent professional offering locksmith services through the Platform." },
                      { term: "Job", definition: "A service request submitted by a Customer through the Platform." },
                      { term: "Call-Out / Assessment Fee", definition: "An upfront fee paid by the Customer to compensate the locksmith for travel and initial diagnostic assessment." },
                      { term: "Work Quote", definition: "The price quoted by the locksmith for performing the repair or installation work." },
                      { term: "Platform Fee", definition: "The commission retained by LockSafe UK for facilitating the transaction through the Platform." },
                    ].map((item, i) => (
                      <div key={i} className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <div className="font-semibold text-slate-900 mb-1">{item.term}</div>
                        <div className="text-slate-600 text-sm">{item.definition}</div>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Section 3: Booking Flow */}
                <section id="booking-flow" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="!mb-0">3. Booking Flow</h2>
                  </div>

                  <p>The booking process operates as follows:</p>

                  <div className="not-prose my-6">
                    <div className="space-y-4">
                      {[
                        "A Customer submits a job request through the Platform.",
                        "Locksmith engineers may accept the request.",
                        "The Customer selects an engineer and confirms the booking.",
                        "The Customer pays the Call-Out / Assessment Fee through the Platform.",
                        "The engineer travels to the location and performs an initial diagnostic assessment.",
                        "The engineer provides a Work Quote before beginning any work.",
                        "The Customer may accept or decline the Work Quote.",
                      ].map((step, i) => (
                        <div key={i} className="flex items-start gap-4">
                          <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {i + 1}
                          </div>
                          <div className="flex-1 pt-1 text-slate-600">{step}</div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                      <Shield className="w-5 h-5 text-green-600 mt-0.5" />
                      <p className="text-green-800 font-medium text-sm">
                        No repair work begins until the Customer accepts the Work Quote.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Section 4: Customer Cancellation Rights */}
                <section id="cancellation" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <XCircle className="w-5 h-5 text-red-600" />
                    </div>
                    <h2 className="!mb-0">4. Customer Cancellation Rights</h2>
                  </div>

                  <p>Customers may cancel a booking under the following conditions:</p>

                  <div className="not-prose my-6">
                    <div className="overflow-hidden rounded-xl border border-slate-200">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-5 py-3 text-sm font-semibold text-slate-900">When</th>
                            <th className="px-5 py-3 text-sm font-semibold text-slate-900">Result</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-600">Before an engineer accepts the job</td>
                            <td className="px-5 py-4 text-green-600 font-medium">Full refund</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-600">After an engineer accepts but before arrival</td>
                            <td className="px-5 py-4 text-amber-600 font-medium">The Call-Out Fee may apply</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="px-5 py-4 text-slate-600">After work has begun</td>
                            <td className="px-5 py-4 text-red-600 font-medium">No refund is available</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>

                {/* Section 5: Refund Policy */}
                <section id="refund-policy" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-emerald-600" />
                    </div>
                    <h2 className="!mb-0">5. Refund Policy</h2>
                  </div>

                  <p>Refunds may be granted in the following circumstances:</p>

                  <h3>Engineer No-Show</h3>
                  <p>
                    If the engineer accepts the job but fails to arrive within the agreed estimated
                    arrival time plus a 30-minute grace period, the Customer may request a full refund
                    of the Call-Out Fee.
                  </p>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 not-prose my-4">
                    <p className="text-amber-900 font-semibold mb-2">Engineer No-Show Liability</p>
                    <p className="text-amber-800 text-sm">
                      In cases of no-show, the engineer is charged the <strong>full refund amount</strong> (100%),
                      not just their share. This includes the platform commission. The platform retains its fee
                      because it successfully facilitated the connection between the Customer and Engineer -
                      the failure to deliver was the Engineer's responsibility.
                    </p>
                  </div>

                  <h3>Quote Declined</h3>
                  <p>
                    If the Customer declines the Work Quote after the assessment, only the Call-Out Fee
                    will be charged.
                  </p>

                  <h3>Refund Processing</h3>
                  <p>
                    Refunds are processed through the payment provider and may take 5–10 business days
                    depending on payment provider processing times.
                  </p>
                </section>

                {/* Section 6: Documentation & Anti-Fraud */}
                <section id="documentation" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                      <Camera className="w-5 h-5 text-purple-600" />
                    </div>
                    <h2 className="!mb-0">6. Documentation & Anti-Fraud System</h2>
                  </div>

                  <p>
                    The Platform includes an automated documentation system designed to increase
                    transparency and reduce fraud.
                  </p>

                  <p>This documentation may include:</p>

                  <div className="not-prose my-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      "GPS arrival verification",
                      "Timestamped job photographs",
                      "Job timeline records",
                      "Itemised quotes",
                      "Digital customer signatures",
                      "Automated PDF job reports",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-purple-50 rounded-lg px-4 py-3">
                        <div className="w-2 h-2 bg-purple-500 rounded-full" />
                        <span className="text-slate-700 text-sm">{item}</span>
                      </div>
                    ))}
                  </div>

                  <p>
                    These records are stored by the Platform and may be accessed by both parties involved
                    in the transaction.
                  </p>

                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 not-prose my-6">
                    <p className="text-amber-800 text-sm">
                      <strong>Important:</strong> The documentation provided by the Platform may serve as
                      evidence in legal proceedings if disputes arise.
                    </p>
                  </div>
                </section>

                {/* Section 7: Engineer Responsibilities */}
                <section id="engineer-responsibilities" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-indigo-600" />
                    </div>
                    <h2 className="!mb-0">7. Engineer / Locksmith Responsibilities</h2>
                  </div>

                  <p>Engineers using the Platform agree to:</p>

                  <ul>
                    <li>Operate as independent self-employed contractors</li>
                    <li>Maintain their own tools, equipment, and insurance</li>
                    <li>Complete identity verification through the Platform's payment processor</li>
                    <li>Provide accurate job documentation including photos and GPS verification</li>
                    <li>Obtain a digital customer signature upon completion of work</li>
                  </ul>

                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 not-prose my-6">
                    <p className="text-red-800 text-sm">
                      Failure to follow documentation procedures may result in delayed payouts or account
                      suspension.
                    </p>
                  </div>
                </section>

                {/* Section 8: Payments */}
                <section id="payments" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-cyan-600" />
                    </div>
                    <h2 className="!mb-0">8. Payments & Platform Commission</h2>
                  </div>

                  <p>
                    Payments are processed through <strong>Stripe Connect</strong>.
                  </p>
                  <p>
                    Engineers must complete Stripe onboarding in order to receive payments.
                  </p>

                  <div className="bg-slate-900 text-white rounded-xl p-6 not-prose my-6">
                    <div className="text-center mb-4">
                      <div className="text-slate-400 text-sm mb-2">Platform Commission Structure</div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="bg-slate-800 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-500 mb-1">15%</div>
                        <div className="text-slate-300 text-sm">Assessment Fee</div>
                        <div className="text-slate-400 text-xs mt-1">Covers travel & diagnosis</div>
                      </div>
                      <div className="bg-slate-800 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-orange-500 mb-1">25%</div>
                        <div className="text-slate-300 text-sm">Work Quote</div>
                        <div className="text-slate-400 text-xs mt-1">On completed work</div>
                      </div>
                    </div>
                  </div>

                  <p>
                    The commission is automatically deducted during payment processing.
                  </p>
                  <p>
                    Engineers are responsible for reporting and paying their own taxes.
                  </p>
                </section>

                {/* Section 9: Independent Contractor */}
                <section id="contractor" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-teal-100 rounded-xl flex items-center justify-center">
                      <UserX className="w-5 h-5 text-teal-600" />
                    </div>
                    <h2 className="!mb-0">9. Independent Contractor Relationship</h2>
                  </div>

                  <p>
                    Locksmith engineers using the Platform are independent contractors.
                  </p>
                  <p>
                    They are <strong>not</strong> employees, agents, or representatives of LockSafe UK.
                  </p>
                  <p>
                    LockSafe UK does not supervise or control how locksmith services are performed.
                  </p>
                  <p>
                    The service contract is formed directly between the Customer and the Engineer.
                  </p>
                </section>

                {/* Section 10: Prohibited Conduct */}
                <section id="prohibited-conduct" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <h2 className="!mb-0">10. Prohibited Conduct</h2>
                  </div>

                  <p>Users of the Platform agree not to:</p>

                  <ul>
                    <li>Provide false or misleading information</li>
                    <li>Attempt to bypass the Platform to avoid fees</li>
                    <li>Request or accept direct payment outside the Platform</li>
                    <li>Harass or threaten other users</li>
                    <li>Manipulate ratings or reviews</li>
                    <li>Use the Platform for illegal activities</li>
                  </ul>

                  <p>Violation of these rules may result in:</p>

                  <div className="not-prose my-6 flex flex-wrap gap-3">
                    <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      Account suspension
                    </span>
                    <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      Permanent account termination
                    </span>
                    <span className="px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                      Forfeiture of pending payouts
                    </span>
                  </div>
                </section>

                {/* Section 11: Limitation of Liability */}
                <section id="liability" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center">
                      <Shield className="w-5 h-5 text-slate-600" />
                    </div>
                    <h2 className="!mb-0">11. Limitation of Liability</h2>
                  </div>

                  <p>
                    LockSafe UK acts solely as a technology platform facilitating connections between
                    customers and independent locksmith professionals.
                  </p>

                  <p>
                    To the fullest extent permitted by law, LockSafe UK shall not be liable for:
                  </p>

                  <ul>
                    <li>The quality of work performed by locksmith engineers</li>
                    <li>Property damage occurring during locksmith services</li>
                    <li>Disputes between customers and locksmiths</li>
                    <li>Financial losses resulting from services provided by engineers</li>
                  </ul>

                  <p>
                    LockSafe UK does not guarantee the outcome or quality of services provided by
                    locksmith professionals.
                  </p>

                  <div className="bg-slate-100 rounded-xl p-5 not-prose my-6 border border-slate-200">
                    <p className="text-slate-700 text-sm">
                      Our total liability for any claims shall not exceed the total amount paid through
                      the Platform during the previous 12 months.
                    </p>
                  </div>
                </section>

                {/* Section 12: Dispute Responsibility */}
                <section id="disputes" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
                      <Scale className="w-5 h-5 text-yellow-600" />
                    </div>
                    <h2 className="!mb-0">12. Dispute Responsibility</h2>
                  </div>

                  <p>
                    LockSafe UK does not mediate disputes between Customers and Engineers.
                  </p>
                  <p>
                    If a dispute arises between a Customer and a Locksmith regarding service quality,
                    pricing, damages, or any other matter, the dispute must be resolved directly between
                    the parties.
                  </p>
                  <p>
                    If necessary, disputes may be resolved through the courts of England and Wales.
                  </p>

                  <p>
                    LockSafe UK may provide access to job documentation including:
                  </p>

                  <div className="not-prose my-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {["GPS logs", "Job photographs", "Quotes", "Digital signatures", "PDF job reports"].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-slate-600 text-sm">
                        <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
                        {item}
                      </div>
                    ))}
                  </div>

                  <p>
                    These documents may be used as evidence in legal proceedings.
                  </p>
                  <p>
                    <strong>LockSafe UK does not issue binding decisions regarding disputes between users.</strong>
                  </p>
                </section>

                {/* Section 13: Data Protection */}
                <section id="data-protection" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Database className="w-5 h-5 text-blue-600" />
                    </div>
                    <h2 className="!mb-0">13. Data Protection & Privacy</h2>
                  </div>

                  <p>LockSafe UK processes personal data in accordance with:</p>

                  <ul>
                    <li>UK GDPR</li>
                    <li>Data Protection Act 2018</li>
                  </ul>

                  <p>Data collected may include:</p>

                  <div className="not-prose my-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {["Name", "Email address", "Phone number", "Service address", "Payment information", "GPS data and job documentation"].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg text-slate-700 text-sm">
                        <Database className="w-3.5 h-3.5 text-blue-500" />
                        {item}
                      </div>
                    ))}
                  </div>

                  <p>This data is used for:</p>

                  <ul>
                    <li>Booking and dispatch</li>
                    <li>Fraud prevention</li>
                    <li>Payment processing</li>
                    <li>Legal compliance</li>
                  </ul>

                  <p>
                    Users may request access, correction, or deletion of their data in accordance with
                    applicable data protection laws.
                  </p>
                </section>

                {/* Section 14: Governing Law */}
                <section id="governing-law" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                      <Gavel className="w-5 h-5 text-violet-600" />
                    </div>
                    <h2 className="!mb-0">14. Governing Law</h2>
                  </div>

                  <p>
                    These Terms are governed by the laws of <strong>England and Wales</strong>.
                  </p>
                  <p>
                    Any disputes arising under these Terms shall be subject to the exclusive jurisdiction
                    of the courts of England and Wales.
                  </p>
                </section>

                {/* Section 15: Changes */}
                <section id="changes" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <RefreshCw className="w-5 h-5 text-orange-600" />
                    </div>
                    <h2 className="!mb-0">15. Changes to These Terms</h2>
                  </div>

                  <p>
                    LockSafe UK may update these Terms from time to time.
                  </p>
                  <p>
                    Users will be notified of material changes through the Platform or by email.
                  </p>
                  <p>
                    Continued use of the Platform after changes become effective constitutes acceptance
                    of the updated Terms.
                  </p>
                </section>

                {/* Section 16: Contact */}
                <section id="contact" className="scroll-mt-28 mb-12">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                      <Phone className="w-5 h-5 text-green-600" />
                    </div>
                    <h2 className="!mb-0">16. Contact</h2>
                  </div>

                  <p>For questions regarding these Terms, please contact:</p>

                  <div className="not-prose mt-6">
                    <a
                      href={`mailto:${CONTACT_EMAIL}`}
                      className="inline-flex items-center gap-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl px-6 py-4 hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/25 hover:shadow-orange-500/35"
                    >
                      <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm text-orange-100">Email us at</div>
                        <div className="font-semibold">{CONTACT_EMAIL}</div>
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
