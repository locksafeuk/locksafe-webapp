import { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Accessibility, Eye, Ear, Hand, Monitor, MessageSquare, Phone, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Accessibility Statement | LockSafe UK",
  description: "Our commitment to making LockSafe UK accessible to everyone.",
};

export default function AccessibilityPage() {
  return (
    <>
      <Header />
      <main className="min-h-screen bg-slate-50">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 py-16 sm:py-20">
          <div className="section-container text-center">
            <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Accessibility className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              Accessibility Statement
            </h1>
            <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto">
              Our commitment to making LockSafe UK accessible to everyone
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="py-12 sm:py-16">
          <div className="section-container max-w-4xl">
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-10 space-y-8">
              {/* Introduction */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Commitment</h2>
                <p className="text-slate-600 leading-relaxed mb-4">
                  LockSafe UK is committed to ensuring digital accessibility for people with disabilities. We are continually improving the user experience for everyone and applying the relevant accessibility standards.
                </p>
                <p className="text-slate-600 leading-relaxed">
                  We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA standards. These guidelines explain how to make web content more accessible for people with disabilities and user-friendly for everyone.
                </p>
              </div>

              {/* Accessibility Features */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Accessibility Features</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-5">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-3">
                      <Eye className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-2">Visual Accessibility</h3>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• High contrast colour schemes</li>
                      <li>• Resizable text without loss of functionality</li>
                      <li>• Alt text for all meaningful images</li>
                      <li>• Clear visual focus indicators</li>
                    </ul>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-5">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-3">
                      <Ear className="w-5 h-5 text-green-600" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-2">Auditory Accessibility</h3>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• No audio auto-play</li>
                      <li>• Visual indicators for notifications</li>
                      <li>• Text-based communication options</li>
                      <li>• Email alternatives to phone calls</li>
                    </ul>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-5">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-3">
                      <Hand className="w-5 h-5 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-2">Motor Accessibility</h3>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• Full keyboard navigation</li>
                      <li>• Large clickable areas</li>
                      <li>• No time-limited actions</li>
                      <li>• Skip navigation links</li>
                    </ul>
                  </div>

                  <div className="bg-slate-50 rounded-xl p-5">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-3">
                      <Monitor className="w-5 h-5 text-orange-600" />
                    </div>
                    <h3 className="font-semibold text-slate-900 mb-2">Technical Accessibility</h3>
                    <ul className="text-sm text-slate-600 space-y-1">
                      <li>• Compatible with screen readers</li>
                      <li>• Semantic HTML structure</li>
                      <li>• ARIA labels where appropriate</li>
                      <li>• Responsive design for all devices</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Known Issues */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Known Issues</h2>
                <p className="text-slate-600 mb-4">
                  We are aware of the following accessibility issues and are working to resolve them:
                </p>
                <ul className="space-y-3 text-slate-600">
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                    <span>Some older PDF documents may not be fully accessible. We are working to update these.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                    <span>The signature pad feature may require alternative arrangements for some users.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                    <span>Some third-party embedded content may have accessibility limitations beyond our control.</span>
                  </li>
                </ul>
              </div>

              {/* Alternative Formats */}
              <div className="bg-blue-50 rounded-xl p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                  Alternative Formats
                </h2>
                <p className="text-slate-600 mb-4">
                  If you need information from our website in a different format, we can provide:
                </p>
                <ul className="grid sm:grid-cols-2 gap-2 text-sm text-slate-600">
                  <li>• Large print documents</li>
                  <li>• Audio descriptions</li>
                  <li>• Easy-read versions</li>
                  <li>• Phone support for booking</li>
                  <li>• Email support</li>
                  <li>• British Sign Language interpreter (by arrangement)</li>
                </ul>
              </div>

              {/* Browser Settings */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Improving Your Experience</h2>
                <p className="text-slate-600 mb-4">
                  You can adjust your browser and device settings to improve your experience:
                </p>
                <div className="bg-slate-50 rounded-xl p-5">
                  <h3 className="font-semibold text-slate-900 mb-3">Browser Adjustments</h3>
                  <ul className="text-sm text-slate-600 space-y-2">
                    <li><strong>Zoom:</strong> Use Ctrl/Cmd + Plus to increase text and image size</li>
                    <li><strong>High Contrast:</strong> Enable high contrast mode in your system settings</li>
                    <li><strong>Screen Reader:</strong> Our site works with NVDA, JAWS, VoiceOver, and TalkBack</li>
                    <li><strong>Keyboard Navigation:</strong> Use Tab to move between elements, Enter to select</li>
                  </ul>
                </div>
              </div>

              {/* Feedback */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-6">
                <h2 className="text-xl font-bold text-slate-900 mb-3">Accessibility Feedback</h2>
                <p className="text-slate-600 mb-4">
                  We welcome your feedback on the accessibility of LockSafe UK. Please let us know if you encounter accessibility barriers:
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
                    href="mailto:accessibility@locksafe.uk"
                    className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    accessibility@locksafe.uk
                  </a>
                </div>
                <p className="text-sm text-slate-500 mt-4">
                  We aim to respond to accessibility feedback within 2 working days.
                </p>
              </div>

              {/* Enforcement */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Enforcement Procedure</h2>
                <p className="text-slate-600 mb-4">
                  If you are not satisfied with our response to your accessibility concern, you can contact:
                </p>
                <div className="bg-slate-100 rounded-xl p-4">
                  <p className="font-semibold text-slate-900 mb-2">Equality Advisory Support Service (EASS)</p>
                  <p className="text-sm text-slate-600 mb-2">
                    The EASS can advise on discrimination issues and help resolve complaints.
                  </p>
                  <a
                    href="https://www.equalityadvisoryservice.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-600 hover:underline text-sm"
                  >
                    www.equalityadvisoryservice.com
                  </a>
                </div>
              </div>

              {/* Technical info */}
              <div className="text-sm text-slate-500 border-t border-slate-200 pt-4">
                <p className="mb-2"><strong>Technical Information:</strong></p>
                <ul className="space-y-1">
                  <li>This website is built using modern, accessible web technologies</li>
                  <li>We test with multiple screen readers and browsers</li>
                  <li>We conduct regular accessibility audits</li>
                </ul>
                <p className="mt-4">
                  This statement was prepared on March 2026 and was last reviewed on March 2026.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
