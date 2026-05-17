import { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Building2, ArrowLeft, Mail, Phone, Shield, AlertTriangle, Globe, FileText } from "lucide-react";
import { SUPPORT_EMAIL, SUPPORT_PHONE } from "@/lib/config";

export const metadata: Metadata = {
  title: "Legal Notice & Company Information | LockSafe UK",
  description: "Company information, regulatory details, and legal notices for LockSafe UK in compliance with the UK Electronic Commerce Regulations 2002.",
  alternates: { canonical: "https://locksafe.uk/legal-notice" },
};

export default function LegalNoticePage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Hero */}
        <section className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-16 md:py-20">
          <div className="section-container">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back to Home
            </Link>
            <div className="flex items-start gap-5 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-slate-500 to-slate-600 rounded-2xl flex items-center justify-center shadow-lg">
                <Building2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Legal Notice</h1>
                <p className="text-slate-400 mt-2 text-lg">Company information &amp; regulatory details</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm">
              This page is published in compliance with the UK Electronic Commerce (EC Directive) Regulations 2002 and the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013.
            </p>
          </div>
        </section>

        {/* Content */}
        <div className="section-container py-12 md:py-16 max-w-4xl">
          <div className="space-y-8">

            {/* Company Details */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                <Building2 className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Company Details</h2>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Trading Name</p>
                  <p className="font-semibold text-slate-900">LockSafe UK</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Legal Entity</p>
                  <p className="font-semibold text-slate-900">LOCKSAFEUK LTD</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Companies House Number</p>
                  <p className="font-semibold text-slate-900">17091123</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">VAT Registration Number</p>
                  <p className="font-semibold text-slate-900">Not currently VAT registered</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Registered Office Address</p>
                  <p className="font-semibold text-slate-900">71-75 Shelton Street, Covent Garden, London, WC2H 9JQ</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Place of Incorporation</p>
                  <p className="font-semibold text-slate-900">England and Wales</p>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                <Mail className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Contact Information</h2>
              </div>
              <div className="p-6 grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Email</p>
                  <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-orange-600 hover:underline">{SUPPORT_EMAIL}</a>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Phone</p>
                  <a href={`tel:${SUPPORT_PHONE}`} className="font-semibold text-orange-600 hover:underline">{SUPPORT_PHONE}</a>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Website</p>
                  <a href="https://locksafe.uk" className="font-semibold text-orange-600 hover:underline">locksafe.uk</a>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Response Time</p>
                  <p className="font-semibold text-slate-900">Within 2 business days</p>
                </div>
              </div>
            </div>

            {/* Regulatory Information */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                <Shield className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Regulatory &amp; Compliance</h2>
              </div>
              <div className="p-6 space-y-5">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">ICO Registration (Data Protection)</p>
                  <p className="text-slate-700 text-sm">LockSafe UK processes personal data and is subject to registration with the Information Commissioner&apos;s Office (ICO) under the UK GDPR and Data Protection Act 2018. ICO registration number: <span className="text-amber-600 font-medium">[ICO registration number — insert when registered]</span></p>
                  <p className="text-slate-500 text-xs mt-1">ICO register: <a href="https://ico.org.uk/about-the-ico/what-we-do/register-of-fee-payers/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ico.org.uk/register</a></p>
                </div>
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Financial Services</p>
                  <p className="text-slate-700 text-sm">
                    <strong>LockSafe Cover is not an insurance product</strong> and LockSafe UK is not authorised or regulated by the Financial Conduct Authority (FCA) in relation to any insurance, investment, or financial product. LockSafe Cover is a paid membership subscription providing service priority and fee discounts only. Payment processing is handled by Stripe Payments UK, Ltd (FCA authorised).
                  </p>
                </div>
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Platform Type</p>
                  <p className="text-slate-700 text-sm">
                    LockSafe UK operates as an <strong>online marketplace</strong> connecting independent locksmith contractors with customers. LockSafe UK does not provide locksmith services, does not employ locksmiths, and is not responsible for the quality or outcome of services delivered by independent contractors. The service contract for locksmith work is formed directly between the customer and the locksmith.
                  </p>
                </div>
                <div className="border-t border-slate-100 pt-5">
                  <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Applicable Law</p>
                  <p className="text-slate-700 text-sm">
                    This platform and all contracts formed through it are governed by the laws of England and Wales. Disputes are subject to the exclusive jurisdiction of the courts of England and Wales, without prejudice to your mandatory consumer rights.
                  </p>
                </div>
              </div>
            </div>

            {/* Consumer Rights Summary */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold text-slate-900">Consumer Rights Summary</h2>
              </div>
              <div className="p-6 space-y-4 text-sm text-slate-700">
                <p>Under UK consumer law, you have the following rights when using LockSafe UK:</p>
                <ul className="space-y-2">
                  <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span><strong>14-day cooling-off right</strong> for non-emergency bookings and new subscriptions (Consumer Contracts Regulations 2013)</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span><strong>Services with reasonable skill and care</strong> (Consumer Rights Act 2015, s.49)</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span><strong>Right to repeat performance</strong> or price reduction if services are not performed properly</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span><strong>GDPR rights</strong> including access, rectification, erasure, and portability (UK GDPR)</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span><strong>Right to complain</strong> to the ICO if you believe your data has been misused</span></li>
                  <li className="flex items-start gap-2"><span className="text-green-500 mt-0.5">•</span><span><strong>Alternative dispute resolution</strong> — if you are unable to resolve a dispute directly, you may contact Citizens Advice at <a href="https://www.citizensadvice.org.uk" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">citizensadvice.org.uk</a></span></li>
                </ul>
              </div>
            </div>

            {/* Technical Service Providers */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                <Globe className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Key Service Providers</h2>
              </div>
              <div className="p-6">
                <p className="text-slate-600 text-sm mb-4">The following third-party providers are used in delivering the LockSafe UK platform:</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-slate-900">Provider</th>
                        <th className="px-4 py-3 font-semibold text-slate-900">Purpose</th>
                        <th className="px-4 py-3 font-semibold text-slate-900 hidden sm:table-cell">Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {[
                        { provider: "Stripe Payments UK Ltd", purpose: "Payment processing", location: "UK/USA" },
                        { provider: "Vercel Inc.", purpose: "Web hosting & CDN", location: "USA (SCCs apply)" },
                        { provider: "MongoDB Atlas (MongoDB Inc.)", purpose: "Database storage", location: "EU/USA (SCCs apply)" },
                        { provider: "Resend Inc.", purpose: "Transactional email", location: "USA (SCCs apply)" },
                        { provider: "Mapbox Inc.", purpose: "Mapping & geolocation", location: "USA (SCCs apply)" },
                        { provider: "Bland AI", purpose: "AI voice phone system", location: "USA (SCCs apply)" },
                        { provider: "OneSignal Inc.", purpose: "Push notifications", location: "USA (SCCs apply)" },
                        { provider: "Sentry Inc.", purpose: "Error monitoring", location: "USA (SCCs apply)" },
                      ].map((row, i) => (
                        <tr key={i} className="bg-white">
                          <td className="px-4 py-3 text-slate-700 font-medium">{row.provider}</td>
                          <td className="px-4 py-3 text-slate-600">{row.purpose}</td>
                          <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{row.location}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-slate-500 mt-3">SCCs = Standard Contractual Clauses (UK-approved safeguards for international data transfers under UK GDPR Article 46).</p>
              </div>
            </div>

            {/* Legal Documents */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center gap-3">
                <FileText className="w-5 h-5 text-slate-600" />
                <h2 className="text-lg font-semibold text-slate-900">Legal Documents</h2>
              </div>
              <div className="p-6">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { label: "Terms & Conditions", href: "/terms" },
                    { label: "Privacy Policy", href: "/privacy" },
                    { label: "Cookie Policy", href: "/cookies" },
                    { label: "Refund Policy", href: "/refund-policy" },
                    { label: "Cooling-Off Rights", href: "/cooling-off" },
                    { label: "Accessibility Statement", href: "/accessibility" },
                  ].map((doc) => (
                    <Link
                      key={doc.href}
                      href={doc.href}
                      className="flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-orange-50 hover:text-orange-700 rounded-xl text-slate-700 text-sm font-medium transition-colors border border-slate-200 hover:border-orange-200"
                    >
                      <FileText className="w-4 h-4 shrink-0" />
                      {doc.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Last Updated */}
            <p className="text-xs text-slate-400 text-center">
              Last updated: May 2026. LockSafe UK — locksafe.uk
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
