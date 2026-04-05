import { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Clock, AlertTriangle, CheckCircle2, FileText, Scale, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Cooling-Off Rights & Emergency Service Waiver | LockSafe UK",
  description: "Information about your cooling-off rights and when emergency service waivers apply.",
};

export default function CoolingOffPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-16 sm:py-20">
          <div className="section-container text-center">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              Cooling-Off Rights
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Understanding your rights to cancel services and when emergency waivers apply
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 sm:py-16">
          <div className="section-container max-w-4xl">
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 space-y-8">
              {/* Introduction */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Scale className="w-6 h-6 text-orange-500" />
                  Your Consumer Rights
                </h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  Under the Consumer Contracts Regulations 2013, when you purchase services at a distance (online or by phone) or off-premises (at your home), you generally have the right to cancel within 14 days. However, there are important exceptions for emergency and urgent services.
                </p>
              </div>

              {/* Standard rights */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-orange-500" />
                  14-Day Cooling-Off Period
                </h2>
                <p className="text-slate-600 mb-4">
                  For standard, non-emergency services booked through LockSafe UK, you have the right to:
                </p>
                <ul className="space-y-3">
                  {[
                    "Cancel within 14 days of booking without giving any reason",
                    "Receive a full refund of any deposit paid",
                    "Cancel by email, phone, or through your account dashboard",
                    "Receive your refund within 14 days of cancellation",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Emergency exception */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                  Emergency Service Exception
                </h2>
                <p className="text-slate-600 mb-4">
                  For emergency locksmith services (such as lockouts), you may be asked to waive your cooling-off rights because:
                </p>
                <ul className="space-y-2 text-slate-600">
                  {[
                    "The service needs to be performed immediately",
                    "Waiting 14 days would be impractical for emergency situations",
                    "The service will be fully completed during the cooling-off period",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-600 rounded-full mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Waiver process */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <FileText className="w-6 h-6 text-orange-500" />
                  How the Waiver Works
                </h2>
                <div className="grid gap-4">
                  <div className="border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">1</span>
                      <h3 className="font-semibold text-slate-900">Request Acknowledgment</h3>
                    </div>
                    <p className="text-slate-600 text-sm ml-11">
                      When you request an emergency service, you acknowledge that you need immediate assistance.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">2</span>
                      <h3 className="font-semibold text-slate-900">Clear Information</h3>
                    </div>
                    <p className="text-slate-600 text-sm ml-11">
                      Before work begins, the locksmith will clearly explain the service, costs, and that by proceeding you are waiving your cooling-off rights.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">3</span>
                      <h3 className="font-semibold text-slate-900">Express Consent</h3>
                    </div>
                    <p className="text-slate-600 text-sm ml-11">
                      You must give express consent for the service to begin immediately. This is recorded digitally through our platform.
                    </p>
                  </div>
                  <div className="border border-slate-200 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 font-bold">4</span>
                      <h3 className="font-semibold text-slate-900">Written Confirmation</h3>
                    </div>
                    <p className="text-slate-600 text-sm ml-11">
                      After the service, you receive written confirmation acknowledging that the service has been completed and cooling-off rights have been waived.
                    </p>
                  </div>
                </div>
              </div>

              {/* Your rights remain */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                  Your Rights Are Still Protected
                </h2>
                <p className="text-slate-600 mb-4">
                  Even when cooling-off rights are waived, you still have protection:
                </p>
                <ul className="space-y-3">
                  {[
                    "You can decline any work quote without penalty (only paying the assessment fee)",
                    "Services must be carried out with reasonable care and skill",
                    "Materials used must be fit for purpose and as described",
                    "You have rights under the Consumer Rights Act 2015 if services are faulty",
                    "You can complain through our platform if you're not satisfied",
                    "Overcharging or misrepresentation can still be challenged",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Quote acceptance */}
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="font-bold text-slate-900 mb-3">About Our Quote System</h3>
                <p className="text-slate-600 text-sm mb-4">
                  Our two-stage pricing model (assessment fee + work quote) is designed to protect you:
                </p>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span><strong>Assessment Fee:</strong> You pay this upfront for the locksmith to attend and diagnose the problem.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span><strong>Work Quote:</strong> The locksmith provides a separate quote for the actual work. You can decline this without losing your cooling-off rights on the main work.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <span><strong>No Obligation:</strong> Declining a work quote only means you forfeit the assessment fee, not additional charges.</span>
                  </li>
                </ul>
              </div>

              {/* Help section */}
              <div className="bg-slate-100 rounded-xl p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <HelpCircle className="w-6 h-6 text-orange-500" />
                  Questions About Your Rights?
                </h2>
                <p className="text-slate-600 mb-4">
                  If you have any questions about cooling-off rights or feel pressured to waive them inappropriately, please contact us:
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    href="/help"
                    className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    Help Centre
                  </Link>
                  <a
                    href="mailto:support@locksafe.uk"
                    className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    support@locksafe.uk
                  </a>
                </div>
              </div>

              {/* Legal references */}
              <div className="text-sm text-slate-500 border-t border-slate-200 pt-4">
                <p className="mb-2"><strong>Legal References:</strong></p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013</li>
                  <li>Consumer Rights Act 2015</li>
                </ul>
                <p className="mt-4">Last updated: March 2026</p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
