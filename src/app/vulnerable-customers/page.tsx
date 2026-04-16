import { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Shield, Heart, Phone, AlertTriangle, CheckCircle2, Users, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Vulnerable Customer Policy | LockSafe UK",
  description: "Our commitment to protecting and supporting vulnerable customers during locksmith services.",
};

export default function VulnerableCustomersPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-16 sm:py-20">
          <div className="section-container text-center">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              Vulnerable Customer Policy
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Our commitment to protecting and supporting all customers, especially those who may be vulnerable
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
                  <Shield className="w-6 h-6 text-orange-500" />
                  Our Commitment
                </h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  At LockSafe UK, we are committed to treating all customers fairly and with respect. We recognise that some customers may be in vulnerable circumstances that could affect their ability to make informed decisions or protect their own interests.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  This policy outlines our approach to identifying, supporting, and protecting vulnerable customers throughout their interactions with our platform and partner locksmiths.
                </p>
              </div>

              {/* Who is considered vulnerable */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Users className="w-6 h-6 text-orange-500" />
                  Who May Be Vulnerable?
                </h2>
                <p className="text-slate-600 mb-4">
                  A vulnerable customer is someone who, due to their personal circumstances, is especially susceptible to harm. This may include:
                </p>
                <ul className="space-y-3">
                  {[
                    "Elderly individuals or those with age-related conditions",
                    "People experiencing mental health difficulties",
                    "Those with physical disabilities or health conditions",
                    "Individuals facing financial difficulties",
                    "Those who have recently experienced bereavement or trauma",
                    "People with learning difficulties or low literacy",
                    "Victims of domestic abuse or coercive control",
                    "Those who are isolated or have limited support networks",
                    "People experiencing a stressful emergency situation (e.g., lockout)",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* How we help */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Heart className="w-6 h-6 text-orange-500" />
                  How We Support Vulnerable Customers
                </h2>
                <div className="grid gap-4">
                  <div className="bg-orange-50 rounded-xl p-5">
                    <h3 className="font-semibold text-slate-900 mb-2">Clear Communication</h3>
                    <p className="text-slate-600 text-sm">
                      We provide clear, jargon-free explanations of services, costs, and processes. Our locksmiths are trained to communicate patiently and ensure customers understand before proceeding.
                    </p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-5">
                    <h3 className="font-semibold text-slate-900 mb-2">Written Quotes</h3>
                    <p className="text-slate-600 text-sm">
                      All work quotes are provided in writing through our platform, giving customers time to review and consider before accepting. We never pressure customers into decisions.
                    </p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-5">
                    <h3 className="font-semibold text-slate-900 mb-2">Right to Decline</h3>
                    <p className="text-slate-600 text-sm">
                      Customers can decline any quote without pressure. Our assessment fee model means you only pay for the initial assessment if you choose not to proceed.
                    </p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-5">
                    <h3 className="font-semibold text-slate-900 mb-2">Cooling-Off Period</h3>
                    <p className="text-slate-600 text-sm">
                      Where applicable, we honour statutory cooling-off rights. For emergency services, we explain any waiver requirements clearly.
                    </p>
                  </div>
                </div>
              </div>

              {/* Locksmith requirements */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Shield className="w-6 h-6 text-orange-500" />
                  Locksmith Responsibilities
                </h2>
                <p className="text-slate-600 mb-4">
                  All locksmiths on our platform must:
                </p>
                <ul className="space-y-3">
                  {[
                    "Be patient and respectful when dealing with all customers",
                    "Take extra time to explain services when needed",
                    "Never use high-pressure sales tactics",
                    "Offer to involve a friend, family member, or carer if the customer wishes",
                    "Report any safeguarding concerns to LockSafe UK",
                    "Verify identity appropriately before gaining entry",
                    "Provide clear written documentation of all work",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-slate-600">
                      <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Warning signs */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-6 h-6 text-amber-600" />
                  Recognising Vulnerability
                </h2>
                <p className="text-slate-600 mb-4 text-sm">
                  Our locksmiths are trained to recognise signs that a customer may need additional support:
                </p>
                <ul className="grid sm:grid-cols-2 gap-2 text-sm text-slate-600">
                  {[
                    "Confusion about the service or costs",
                    "Difficulty understanding explanations",
                    "Signs of distress or anxiety",
                    "Repeated questions about the same topic",
                    "Appearing to be under pressure from someone else",
                    "Living conditions suggesting neglect",
                    "Memory difficulties",
                    "Physical frailty or mobility issues",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact */}
              <div className="bg-slate-100 rounded-xl p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <HelpCircle className="w-6 h-6 text-orange-500" />
                  Need Help?
                </h2>
                <p className="text-slate-600 mb-4">
                  If you are a vulnerable customer or are concerned about someone who may be, please contact us:
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a
                    href="tel:07818333989"
                    className="flex items-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                    07818 333 989
                  </a>
                  <a
                    href="mailto:support@locksafe.uk"
                    className="flex items-center justify-center px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    support@locksafe.uk
                  </a>
                </div>
              </div>

              {/* Last updated */}
              <div className="text-center text-sm text-slate-500 pt-4 border-t border-slate-200">
                Last updated: March 2026
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
