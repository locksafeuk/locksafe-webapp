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
  PoundSterling,
  CreditCard,
  Shield,
  FileText,
  Clock,
  MapPin,
  Star,
  Camera,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Search,
  Wallet,
  UserCheck,
  TrendingUp,
  MessageCircle,
} from "lucide-react";
import { SITE_NAME, SUPPORT_EMAIL } from "@/lib/config";

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
    id: "commission",
    number: "1",
    title: "Commission & Fees",
    icon: <PoundSterling className="w-4 h-4" />,
    faqs: [
      {
        question: "What commission does LockSafe charge?",
        answer: "LockSafe charges two different commission rates: 15% on assessment fees and 25% on work quotes. This means you keep 85% of every assessment fee and 75% of every work quote. There are no monthly fees, subscription costs, or hidden charges.",
      },
      {
        question: "Why are there different commission rates?",
        answer: "Assessment fees are lower risk and cover your travel costs, so we charge a lower 15% commission. Work quotes involve larger transactions and more platform infrastructure (payment processing, dispute resolution, documentation), so the commission is 25%. This structure ensures you keep more of the smaller fees.",
      },
      {
        question: "How is my commission calculated - can you show an example?",
        answer: "Example: For a job with £40 assessment fee + £200 work quote = £240 total. Assessment: £40 × 15% = £6 commission, you keep £34. Work Quote: £200 × 25% = £50 commission, you keep £150. Total customer paid: £240. Total you earn: £184 (76.7% of total).",
      },
      {
        question: "Are there any other fees I should know about?",
        answer: "No hidden fees. The only deductions are the commission rates mentioned above. Stripe may charge a small fee for instant payouts if you choose that option, but standard payouts are free.",
      },
      {
        question: "When does the commission get deducted?",
        answer: "Commission is automatically deducted when the payment is processed. You always see your net earnings (after commission) in your dashboard and earnings reports.",
      },
    ],
  },
  {
    id: "payments",
    number: "2",
    title: "Getting Paid",
    icon: <Wallet className="w-4 h-4" />,
    faqs: [
      {
        question: "How do I set up payments?",
        answer: "You need to complete Stripe Connect onboarding during your initial setup or from your Earnings page. This involves verifying your identity and connecting your bank account. The process takes about 5-10 minutes.",
      },
      {
        question: "When do I get paid?",
        answer: "Payments are transferred to your bank account automatically after each completed job. Funds typically arrive within 2-3 business days. You can view your pending and completed payouts in your Earnings dashboard.",
      },
      {
        question: "Can I get paid faster?",
        answer: "Yes, Stripe offers instant payouts for a small fee. Once enabled, you can receive funds within minutes instead of 2-3 days. Enable this in your Stripe dashboard.",
      },
      {
        question: "What happens if a customer requests a refund for a no-show?",
        answer: "If you don't arrive within your quoted ETA plus a 30-minute grace period, the customer can request a refund. IMPORTANT: For no-show refunds, you are charged the FULL refund amount (100%), not just your share. This means you pay back the entire assessment fee including the platform's commission. This policy exists because the platform did its job connecting you with the customer - it was your failure to arrive that caused the refund. Always communicate delays and arrive on time to avoid these charges.",
      },
      {
        question: "Where can I see my earnings breakdown?",
        answer: "Your Earnings page shows detailed breakdowns including: total earnings, pending payments, completed payouts, and per-job commission splits. You can also see assessment vs work quote earnings separately.",
      },
    ],
  },
  {
    id: "jobs",
    number: "3",
    title: "Finding & Accepting Jobs",
    icon: <Wrench className="w-4 h-4" />,
    faqs: [
      {
        question: "How do I get job notifications?",
        answer: "You'll receive email and/or SMS notifications when new jobs are posted in your coverage area. Make sure your coverage area is set correctly in Settings and your contact preferences are up to date.",
      },
      {
        question: "How do I set my coverage area?",
        answer: "Go to Settings > Coverage Area. Enter your base postcode and set your radius in miles. You'll only see jobs within this radius. You can update this anytime based on where you're willing to travel.",
      },
      {
        question: "What information do I need to provide when applying?",
        answer: "When applying for a job, you'll set your assessment fee (the call-out charge) and your estimated arrival time (ETA). Be realistic with your ETA - late arrivals can lead to refunds.",
      },
      {
        question: "Can I set my own prices?",
        answer: "Yes! You set your own assessment fee when applying for each job. For the work quote, you determine the price after assessing the job on-site. LockSafe doesn't set or limit your pricing.",
      },
      {
        question: "What happens after a customer selects me?",
        answer: "You'll receive a notification with the customer's details and address. The customer pays the assessment fee through the platform, and you should then travel to the location within your quoted ETA.",
      },
    ],
  },
  {
    id: "documentation",
    number: "4",
    title: "Documentation Requirements",
    icon: <Camera className="w-4 h-4" />,
    faqs: [
      {
        question: "What documentation is required for each job?",
        answer: "You must: (1) Check in with GPS when you arrive, (2) Take photos before starting work, (3) Create a detailed work quote, (4) Take photos after completion, (5) Get the customer's digital signature. These protect both you and the customer.",
      },
      {
        question: "Why is GPS check-in important?",
        answer: "GPS check-in proves you arrived at the job location. This is crucial for dispute resolution - if a customer claims you didn't show up, the GPS data proves otherwise. Always check in when you arrive.",
      },
      {
        question: "What photos should I take?",
        answer: "Take clear photos of: the lock/problem before starting, any damaged parts, the completed work, and any parts replaced or installed. These photos appear in the legal job report.",
      },
      {
        question: "What if the customer refuses to sign?",
        answer: "If the customer is satisfied but won't sign, explain that the signature confirms work completion and triggers payment. If there's a dispute about work quality, try to resolve it on-site. Contact support if needed.",
      },
      {
        question: "How do I access job reports?",
        answer: "All job reports are available in your Job History. Each report includes the complete timeline, photos, GPS data, quotes, signatures, and payment details. You can download or share these PDFs.",
      },
    ],
  },
  {
    id: "verification",
    number: "5",
    title: "Account & Verification",
    icon: <UserCheck className="w-4 h-4" />,
    faqs: [
      {
        question: "What documents do I need to get verified?",
        answer: "You need: (1) Public liability insurance certificate with valid dates, (2) Profile photo, (3) Locksmith certification (optional but recommended). You'll also complete Stripe's identity verification for payments.",
      },
      {
        question: "How long does verification take?",
        answer: "Document review typically takes 1-2 business days. Stripe verification is usually instant but may take longer if additional documents are needed. You'll be notified when your account is fully verified.",
      },
      {
        question: "What happens when my insurance expires?",
        answer: "You'll receive reminder emails before expiry. If your insurance expires, your ability to accept new jobs is suspended until you upload a valid certificate. Always keep your insurance up to date.",
      },
      {
        question: "Why do I need a profile photo?",
        answer: "Your profile photo helps customers recognise you when you arrive. It also builds trust - customers are more likely to book locksmiths with professional photos. Make sure it's a clear, professional image.",
      },
      {
        question: "How do I get the 'Verified' badge?",
        answer: "The verified badge is awarded after our team reviews your documents and confirms your identity, insurance, and qualifications. Verified locksmiths get more bookings and appear higher in search results.",
      },
    ],
  },
  {
    id: "performance",
    number: "6",
    title: "Ratings & Performance",
    icon: <Star className="w-4 h-4" />,
    faqs: [
      {
        question: "How do ratings work?",
        answer: "After each job, customers can rate you 1-5 stars and leave a review. Your average rating is displayed on your profile. Higher-rated locksmiths get more bookings and are shown first to customers.",
      },
      {
        question: "What affects my rating?",
        answer: "Key factors include: arriving on time, quality of work, professionalism, communication, and fair pricing. Customers can also comment on specific aspects of your service.",
      },
      {
        question: "Can I respond to reviews?",
        answer: "Currently, you cannot publicly respond to reviews. If you believe a review is unfair or fake, contact support with the job details and we'll investigate.",
      },
      {
        question: "What happens if I get too many bad reviews?",
        answer: "Consistently low ratings may result in fewer job notifications, reduced visibility to customers, or in severe cases, account suspension. We contact locksmiths before taking any action to understand the situation.",
      },
      {
        question: "How can I improve my ratings?",
        answer: "Tips: Be punctual (or communicate delays early), explain work clearly before starting, be honest about pricing, take pride in your work quality, and be friendly and professional. Small details make a big difference.",
      },
    ],
  },
  {
    id: "issues",
    number: "7",
    title: "Handling Issues",
    icon: <AlertTriangle className="w-4 h-4" />,
    faqs: [
      {
        question: "What if I'm running late?",
        answer: "Contact the customer immediately through the platform or by phone. Update your ETA if possible. Arriving more than 30 minutes late without communication can result in a refund request. CRITICAL: If the customer requests a no-show refund, you will be charged the FULL refund amount (100%), not just your 85% share. Always communicate delays to avoid this.",
      },
      {
        question: "What if I can't complete a job?",
        answer: "If you realise on-site that you can't complete the work, explain honestly to the customer. You're still entitled to the assessment fee for your time and travel. Don't attempt work you're not confident in.",
      },
      {
        question: "What if a customer is difficult or abusive?",
        answer: "Your safety comes first. If you feel unsafe, leave the property and contact support immediately. We take reports of customer misconduct seriously and may ban problematic customers from the platform.",
      },
      {
        question: "What if there's a dispute about my work?",
        answer: "The job documentation (GPS, photos, signature) serves as evidence. If a customer disputes work quality, support will review the evidence and mediate. Complete documentation protects you in disputes.",
      },
      {
        question: "How do I contact support?",
        answer: "Email support@locksafe.uk or use the Help section in your dashboard. For urgent issues during a job, call our support line. Include your job number when contacting support for faster resolution.",
      },
    ],
  },
];

export default function LocksmithFAQPage() {
  const [activeSection, setActiveSection] = useState("commission");
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
              href="/locksmith/dashboard"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Dashboard
            </Link>

            <div className="flex items-start gap-5 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                <HelpCircle className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Locksmith FAQ</h1>
                <p className="text-slate-400 mt-2 text-lg">Everything you need to know as a LockSafe partner</p>
              </div>
            </div>

            {/* Search Bar */}
            <div className="max-w-xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search locksmith FAQ..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Commission Summary Cards */}
        <section className="py-8 -mt-8">
          <div className="section-container">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-3">
                  <PoundSterling className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">15% on Assessment</h3>
                <p className="text-sm text-slate-500">You keep 85% of call-out fees</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center mb-3">
                  <Wrench className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">25% on Work Quote</h3>
                <p className="text-sm text-slate-500">You keep 75% of completed work</p>
              </div>
              <div className="bg-white rounded-xl p-5 shadow-lg border border-slate-100 hover:shadow-xl transition-shadow">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-3">
                  <TrendingUp className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">No Hidden Fees</h3>
                <p className="text-sm text-slate-500">No subscriptions or monthly charges</p>
              </div>
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

                {/* Quick Links */}
                <div className="mt-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">Quick Links</h3>
                  <div className="space-y-2">
                    <Link
                      href="/locksmith/dashboard"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600 transition-colors"
                    >
                      <Wrench className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/locksmith/earnings"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600 transition-colors"
                    >
                      <Wallet className="w-4 h-4" />
                      Earnings
                    </Link>
                    <Link
                      href="/locksmith/settings"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600 transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      Settings
                    </Link>
                    <Link
                      href="/terms"
                      className="flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600 transition-colors"
                    >
                      <FileText className="w-4 h-4" />
                      Terms of Service
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
                      className="text-orange-600 hover:underline"
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
                        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
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
                                  ? "border-orange-200 shadow-md"
                                  : "border-slate-200 hover:border-slate-300"
                              }`}
                            >
                              <button
                                onClick={() => toggleFAQ(faqId)}
                                className="w-full flex items-start gap-4 p-5 text-left"
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center mt-0.5 transition-colors ${
                                  isExpanded ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-500"
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

              {/* Commission Calculator Example */}
              <div className="mt-12 bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-8 text-white">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <PoundSterling className="w-6 h-6 text-orange-400" />
                  Commission Example
                </h3>
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <p className="text-slate-400 text-sm mb-3">For a typical job:</p>
                    <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-slate-300">Assessment Fee</span>
                        <span className="font-semibold">£40</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Work Quote</span>
                        <span className="font-semibold">£200</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-700">
                        <span className="text-slate-300">Customer Pays Total</span>
                        <span className="font-bold text-lg">£240</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm mb-3">Your earnings:</p>
                    <div className="bg-green-900/30 border border-green-500/30 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between">
                        <span className="text-green-200">Assessment (85%)</span>
                        <span className="font-semibold text-green-400">£34</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-200">Work Quote (75%)</span>
                        <span className="font-semibold text-green-400">£150</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-green-500/30">
                        <span className="text-green-200">Your Total Earnings</span>
                        <span className="font-bold text-xl text-green-400">£184</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Still Need Help CTA */}
              <div className="mt-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-8 text-white">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
                    <MessageCircle className="w-8 h-8" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold mb-2">Need More Help?</h3>
                    <p className="text-orange-100">
                      Our locksmith support team is here to help you succeed on the platform.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <a
                      href={`mailto:${SUPPORT_EMAIL || "support@locksafe.uk"}`}
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
                    >
                      <Mail className="w-4 h-4" />
                      Email Support
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
