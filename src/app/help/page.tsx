"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import {
  HelpCircle,
  ArrowLeft,
  ChevronRight,
  Phone,
  Mail,
  Clock,
  Shield,
  CreditCard,
  Key,
  MapPin,
  FileText,
  Users,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Banknote,
  Camera,
  MessageCircle,
  Star,
  Zap,
  Calendar,
  Lock,
  Search,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import { SITE_NAME, SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/config";

interface FAQItem {
  question: string;
  answer: string;
}

interface Section {
  id: string;
  number: string;
  title: string;
  icon: React.ReactNode;
  faqs: FAQItem[];
}

const sections: Section[] = [
  {
    id: "booking",
    number: "1",
    title: "Booking & Service",
    icon: <Key className="w-4 h-4" />,
    faqs: [
      {
        question: "How do I book a locksmith?",
        answer: "Click 'Get Emergency Help' on our homepage, enter your postcode and describe your problem. Multiple verified locksmiths will apply with their assessment fee and ETA. You choose who to book based on price, rating, and reviews. Payment is secure through Stripe.",
      },
      {
        question: "How quickly can a locksmith arrive?",
        answer: "Most locksmiths in our network arrive within 15-30 minutes for emergency calls in urban areas. Response times may vary based on your location and time of day. You'll see the exact ETA when a locksmith accepts your job.",
      },
      {
        question: "Is the service available 24/7?",
        answer: "Yes, we have verified locksmiths available around the clock, 365 days a year. Emergency lockouts don't follow business hours, and neither do we. Pricing may vary for out-of-hours calls, but this is always shown upfront.",
      },
      {
        question: "Do you cover commercial properties?",
        answer: "Yes, we serve both residential and commercial properties across the UK. For businesses, we offer additional services like access control systems, master key systems, and emergency lockout support with SLA agreements.",
      },
    ],
  },
  {
    id: "pricing",
    number: "2",
    title: "Pricing & Fees",
    icon: <Banknote className="w-4 h-4" />,
    faqs: [
      {
        question: "Is LockSafe free for customers?",
        answer: "Yes, 100% free. There are no platform fees, booking fees, or hidden charges for customers. You simply pay the locksmith directly for their assessment and work. LockSafe makes money by charging locksmiths a commission - you never pay LockSafe anything.",
      },
      {
        question: "What is the assessment fee?",
        answer: "When a locksmith applies for your job, they set their own assessment fee (typically £25-£49). This covers their travel to your location and time to diagnose the problem. You pay this to confirm the booking. Once on-site, the locksmith will provide a separate quote for the actual work.",
      },
      {
        question: "What if I decline the work quote?",
        answer: "You have complete control. When the locksmith provides their on-site quote for the work, you can accept or decline. If you decline, you've only paid the assessment fee and the job is closed. There's no pressure and no hidden fees.",
      },
      {
        question: "What payment methods do you accept?",
        answer: "We accept all major credit/debit cards, Apple Pay, and Google Pay. Payment is processed securely through Stripe - the locksmith never handles your payment details directly.",
      },
    ],
  },
  {
    id: "protection",
    number: "3",
    title: "Customer Protection",
    icon: <Shield className="w-4 h-4" />,
    faqs: [
      {
        question: "What if the locksmith doesn't arrive?",
        answer: "You're fully protected with our automatic refund guarantee. If a locksmith accepts your job but fails to arrive within their agreed ETA plus a 30-minute grace period, you can request an automatic full refund. No questions asked - the locksmith's connected payment account is debited.",
      },
      {
        question: "How does the refund protection work?",
        answer: "When you pay the assessment fee, the money goes through our secure platform. If the locksmith doesn't arrive within their quoted ETA plus a 30-minute grace period, you can request a full refund. We immediately refund you 100% of the assessment fee. The locksmith is charged the FULL amount - not just their share - because it was their failure to arrive that caused the refund. The platform keeps its commission since it did its job connecting you with the locksmith.",
      },
      {
        question: "What makes LockSafe different from other services?",
        answer: "Three things no competitor offers: (1) Automatic refund guarantee if the locksmith doesn't show up, (2) Legally-binding digital paper trail on every job, and (3) You see the full quote BEFORE work starts and can decline. We're the UK's first anti-fraud locksmith platform.",
      },
      {
        question: "How do you verify locksmiths?",
        answer: "Every locksmith on our platform goes through rigorous verification: DBS background check, proof of qualifications, insurance verification, and reference checks. We also continuously monitor ratings and investigate any complaints.",
      },
    ],
  },
  {
    id: "documentation",
    number: "4",
    title: "Documentation & Reports",
    icon: <FileText className="w-4 h-4" />,
    faqs: [
      {
        question: "What does the PDF job report contain?",
        answer: "The legal PDF report includes: complete job timeline with timestamps, GPS location data, all photos taken (before/during/after), diagnostic details, itemised quote, your digital signature, locksmith details, and payment confirmation. It's your complete protection against disputes.",
      },
      {
        question: "How do I access my job report?",
        answer: "Your PDF job report is automatically generated after the job is completed and signed. You can access it from your customer dashboard, and it's also sent to your email address. Reports are stored securely and available for 7 years.",
      },
      {
        question: "Why are photos taken during the job?",
        answer: "Photos document the state of your property before and after work is completed. This protects both you and the locksmith by creating an undeniable record of the work performed, preventing disputes about quality or damage claims.",
      },
    ],
  },
  {
    id: "locksmiths",
    number: "5",
    title: "For Locksmiths",
    icon: <Users className="w-4 h-4" />,
    faqs: [
      {
        question: "How much commission does LockSafe charge?",
        answer: "LockSafe charges 15% commission on the assessment fee and 25% commission on the work quote. There are no monthly fees, subscription costs, or hidden charges. Locksmiths only pay when they earn.",
      },
      {
        question: "How are locksmiths protected on the platform?",
        answer: "Locksmiths are fully protected: (1) Customer's card is verified before you travel, (2) GPS tracking proves you arrived at the location, (3) Digital signature from customer confirms they approved the work, (4) Complete PDF documentation protects against false claims. Payment is guaranteed through our platform.",
      },
      {
        question: "How do I get paid?",
        answer: "Payments are processed through Stripe Connect. After completing a job and obtaining the customer's digital signature, payment is transferred to your connected bank account. Payouts typically arrive within 2-3 business days.",
      },
      {
        question: "How do I join as a locksmith?",
        answer: "Visit our locksmith signup page to apply. You'll need to provide proof of qualifications, public liability insurance, and complete our verification process including a DBS check. Approved locksmiths can start accepting jobs immediately.",
      },
    ],
  },
  {
    id: "account",
    number: "6",
    title: "Account & Settings",
    icon: <Lock className="w-4 h-4" />,
    faqs: [
      {
        question: "How do I create an account?",
        answer: "You can create an account when you book your first job or sign up directly through our website. You'll need a valid email address and phone number. Account creation is free and takes less than a minute.",
      },
      {
        question: "How do I update my payment details?",
        answer: "Log in to your customer dashboard and navigate to Settings. You can add, remove, or update your saved payment cards securely through Stripe. Changes take effect immediately.",
      },
      {
        question: "How do I delete my account?",
        answer: "You can request account deletion by contacting our support team. In accordance with GDPR, we will process your request within 30 days. Note that some records may be retained for legal compliance purposes.",
      },
    ],
  },
];

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState("booking");
  const [expandedFAQs, setExpandedFAQs] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");

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

  const toggleFAQ = (faqId: string) => {
    setExpandedFAQs(prev => ({
      ...prev,
      [faqId]: !prev[faqId]
    }));
  };

  // Filter FAQs based on search
  const filteredSections = searchQuery
    ? sections.map(section => ({
        ...section,
        faqs: section.faqs.filter(
          faq =>
            faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(section => section.faqs.length > 0)
    : sections;

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
              <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/25">
                <HelpCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Help Centre</h1>
                <p className="text-slate-400 mt-2 text-lg">Find answers to your questions</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="max-w-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search for answers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Contact Options */}
        <section className="py-8 -mt-8">
          <div className="section-container">
            <div className="grid sm:grid-cols-3 gap-4">
              <a
                href={`tel:${SUPPORT_PHONE || "08001234567"}`}
                className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow hover:border-cyan-200 group"
              >
                <div className="w-12 h-12 bg-cyan-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-cyan-200 transition-colors">
                  <Phone className="w-6 h-6 text-cyan-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Call Us</h3>
                <p className="text-sm text-slate-500">{SUPPORT_PHONE || "0800 123 4567"}</p>
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL || "help@locksafe.uk"}`}
                className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow hover:border-cyan-200 group"
              >
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3 group-hover:bg-orange-200 transition-colors">
                  <Mail className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">Email Us</h3>
                <p className="text-sm text-slate-500">{SUPPORT_EMAIL || "help@locksafe.uk"}</p>
              </a>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <Clock className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">24/7 Support</h3>
                <p className="text-sm text-slate-500">Always available for emergencies</p>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Actions */}
        <section className="py-8">
          <div className="section-container">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Link
                href="/request"
                className="flex items-center gap-4 p-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl text-white hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
              >
                <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold">Emergency Help</div>
                  <div className="text-sm text-orange-100">Get a locksmith now</div>
                </div>
              </Link>
              <Link
                href="/customer/dashboard"
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-cyan-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">My Jobs</div>
                  <div className="text-sm text-slate-500">View your bookings</div>
                </div>
              </Link>
              <Link
                href="/refund-policy"
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-cyan-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Refund Policy</div>
                  <div className="text-sm text-slate-500">How refunds work</div>
                </div>
              </Link>
              <Link
                href="/locksmith-signup"
                className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-cyan-200 hover:shadow-md transition-all"
              >
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <Key className="w-5 h-5 text-slate-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900">Join as Locksmith</div>
                  <div className="text-sm text-slate-500">Partner with us</div>
                </div>
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ Content Section */}
        <div className="section-container py-12 md:py-16">
          <div className="flex flex-col lg:flex-row gap-12">
            {/* Table of Contents Sidebar */}
            <aside className="lg:w-80 shrink-0">
              <div className="lg:sticky lg:top-24">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">
                    Topics
                  </h2>
                  <nav className="space-y-1">
                    {sections.map((section) => (
                      <button
                        key={section.id}
                        onClick={() => scrollToSection(section.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-200 group ${
                          activeSection === section.id
                            ? "bg-cyan-50 text-cyan-600 border-l-2 border-cyan-500"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <span className={`flex items-center justify-center w-6 h-6 rounded-md text-xs font-bold ${
                          activeSection === section.id
                            ? "bg-cyan-500 text-white"
                            : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                        }`}>
                          {section.number}
                        </span>
                        <span className="text-sm font-medium truncate flex-1">{section.title}</span>
                        <ChevronRight className={`w-4 h-4 transition-transform ${
                          activeSection === section.id ? "text-cyan-500" : "text-slate-300 group-hover:translate-x-0.5"
                        }`} />
                      </button>
                    ))}
                  </nav>
                </div>

                {/* Related Links */}
                <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Related</h3>
                  <div className="space-y-2">
                    <Link
                      href="/terms"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-cyan-600 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Terms of Service
                    </Link>
                    <Link
                      href="/privacy"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-cyan-600 transition-colors"
                    >
                      <Shield className="w-4 h-4" />
                      Privacy Policy
                    </Link>
                    <Link
                      href="/cookies"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-cyan-600 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Cookie Policy
                    </Link>
                  </div>
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <article className="flex-1 min-w-0">
              {filteredSections.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                  <Search className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No results found</h3>
                  <p className="text-slate-600">
                    Try different keywords or{" "}
                    <button
                      onClick={() => setSearchQuery("")}
                      className="text-cyan-600 hover:underline"
                    >
                      clear your search
                    </button>
                  </p>
                </div>
              ) : (
                <div className="space-y-12">
                  {filteredSections.map((section) => (
                    <section key={section.id} id={section.id} className="scroll-mt-28">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
                          {section.icon}
                        </div>
                        <h2 className="text-2xl font-bold text-slate-900">
                          {section.number}. {section.title}
                        </h2>
                      </div>

                      <div className="space-y-3">
                        {section.faqs.map((faq, faqIndex) => {
                          const faqId = `${section.id}-${faqIndex}`;
                          const isExpanded = expandedFAQs[faqId];

                          return (
                            <div
                              key={faqId}
                              className={`bg-white rounded-xl border transition-all ${
                                isExpanded
                                  ? "border-cyan-200 shadow-md"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <button
                                onClick={() => toggleFAQ(faqId)}
                                className="w-full flex items-start gap-4 p-5 text-left"
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition-colors ${
                                  isExpanded ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-500"
                                }`}>
                                  <ChevronDown className={`w-4 h-4 transition-transform ${
                                    isExpanded ? "rotate-180" : ""
                                  }`} />
                                </div>
                                <span className="flex-1 font-semibold text-slate-900">{faq.question}</span>
                              </button>
                              {isExpanded && (
                                <div className="px-5 pb-5 pl-14">
                                  <p className="text-slate-600 leading-relaxed">{faq.answer}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {/* Still Need Help CTA */}
              <div className="mt-12 bg-gradient-to-r from-cyan-500 to-cyan-600 rounded-2xl p-8 text-white">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                    <MessageCircle className="w-8 h-8" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold mb-2">Still Need Help?</h3>
                    <p className="text-cyan-100">
                      Our support team is available 24/7 to assist you with any questions.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={`mailto:${SUPPORT_EMAIL || "help@locksafe.uk"}`}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-cyan-600 font-semibold rounded-lg hover:bg-cyan-50 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Email Support
                    </a>
                    <a
                      href={`tel:${SUPPORT_PHONE || "08001234567"}`}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white/10 transition-colors"
                    >
                      <Phone className="w-4 h-4" />
                      Call Now
                    </a>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
