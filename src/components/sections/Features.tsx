import { Shield, Eye, Clock, FileCheck, AlertTriangle, CheckCircle2, Scale, Users, Quote } from "lucide-react";

const features = [
  {
    icon: Shield,
    problem: "Worried about cowboy locksmiths?",
    title: "Every Locksmith Verified",
    description: "DBS checked, fully insured, and professionally qualified. We reject 70% of applicants to keep standards high.",
  },
  {
    icon: Eye,
    problem: "Scared of hidden fees?",
    title: "You See Everything First",
    description: "Locksmiths show their assessment fee upfront (call-out + diagnostic only - shown before you book). Work quote delivered BEFORE any job starts. Accept or decline - your choice.",
  },
  {
    icon: Clock,
    problem: "Locksmith didn't show up?",
    title: "Automatic Refund Guarantee",
    description: "If a locksmith doesn't arrive within the agreed ETA + grace period, you get an automatic full refund. No questions asked.",
  },
  {
    icon: FileCheck,
    problem: "No proof if something goes wrong?",
    title: "Complete Digital Trail",
    description: "GPS tracking, timestamped photos, digital signature, and instant PDF report. Your shield against disputes.",
  },
];

export function Features() {
  return (
    <section id="services" className="py-16 md:py-24 bg-white">
      <div className="section-container">
        {/* Section header - Lead with the problem */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 rounded-full px-4 py-2 text-sm font-medium mb-4">
            <AlertTriangle className="w-4 h-4" />
            THE PROBLEM WITH TRADITIONAL LOCKSMITHS
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
            We Built This Because We Were Tired of Scams
          </h2>
          <p className="text-lg text-slate-600">
            £50 quotes that become £300. No documentation. Your word against theirs.
            <br />
            <span className="font-semibold text-slate-900">LockSafe is the anti-fraud solution.</span>
          </p>
        </div>

        {/* Feature cards grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
            >
              {/* Problem label */}
              <div className="text-orange-400 text-sm font-medium mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {feature.problem}
              </div>

              {/* Solution */}
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <h3 className="text-xl font-bold">{feature.title}</h3>
              </div>

              <p className="text-white/80 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Killer Differentiator - LEGAL PAPER TRAIL */}
        <div className="mt-16 bg-gradient-to-r from-green-600 to-emerald-600 rounded-3xl p-8 md:p-12 text-white">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2 text-sm font-medium mb-4">
                <Scale className="w-4 h-4" />
                OUR KILLER DIFFERENTIATOR
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4">
                Legally-Binding Digital Paper Trail
              </h3>
              <p className="text-white/90 text-lg mb-6">
                No competitor offers this. Every LockSafe job creates a complete, timestamped,
                legally-admissible record that protects both you and the locksmith.
              </p>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-200 flex-shrink-0" />
                  <span>GPS coordinates with timestamps at arrival and completion</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-200 flex-shrink-0" />
                  <span>Before, during, and after photos with metadata</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-200 flex-shrink-0" />
                  <span>Digital signature with customer confirmations</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-200 flex-shrink-0" />
                  <span>Instant PDF report - your proof forever</span>
                </li>
              </ul>
            </div>
            <div className="bg-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-bold text-lg">Job Report #LS-2026-0142</div>
                  <div className="text-white/70 text-sm">Legal Document</div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b border-white/20 pb-2">
                  <span className="text-white/70">Arrival GPS</span>
                  <span>51.5074, -0.1278</span>
                </div>
                <div className="flex justify-between border-b border-white/20 pb-2">
                  <span className="text-white/70">Arrived At</span>
                  <span>14:32:17 GMT</span>
                </div>
                <div className="flex justify-between border-b border-white/20 pb-2">
                  <span className="text-white/70">Photos Taken</span>
                  <span>6 verified</span>
                </div>
                <div className="flex justify-between border-b border-white/20 pb-2">
                  <span className="text-white/70">Customer Signed</span>
                  <span>15:47:03 GMT</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-white/70">Status</span>
                  <span className="text-green-300 font-semibold">VERIFIED</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Founder Story Block - NEW */}
        <div className="mt-16 bg-slate-50 rounded-3xl p-8 md:p-12">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-center gap-2 text-orange-600 text-sm font-medium mb-6">
              <Users className="w-4 h-4" />
              WHY WE EXIST
            </div>
            <div className="relative">
              <Quote className="absolute -top-2 -left-2 w-10 h-10 text-orange-200" />
              <blockquote className="text-xl md:text-2xl text-slate-700 leading-relaxed text-center px-8">
                "My 78-year-old mother was charged £380 for a job that should have cost £90.
                The locksmith knew she was vulnerable, alone, and desperate. When she complained,
                it was her word against his. <span className="font-semibold text-slate-900">That's when we decided: never again.</span>"
              </blockquote>
            </div>
            <div className="text-center mt-8">
              <div className="inline-flex items-center gap-4">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  JT
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-900">James Thompson</div>
                  <div className="text-slate-500 text-sm">London, United Kingdom</div>
                </div>
              </div>
            </div>
            <div className="mt-8 grid sm:grid-cols-3 gap-4 text-center">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-2xl font-bold text-slate-900">2,500+</div>
                <div className="text-sm text-slate-500">Jobs Protected</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-2xl font-bold text-slate-900">£0</div>
                <div className="text-sm text-slate-500">Scam Losses Reported</div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-2xl font-bold text-slate-900">100%</div>
                <div className="text-sm text-slate-500">Dispute Resolution Rate</div>
              </div>
            </div>
          </div>
        </div>

        {/* Dual Protection Section - NEW */}
        <div className="mt-16 grid md:grid-cols-2 gap-6">
          {/* Customer Protection */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Customer Protection</h3>
                <p className="text-sm text-blue-700">Your money is always safe</p>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700"><strong>Automatic refund</strong> if locksmith doesn't arrive on time</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700"><strong>See quote before work</strong> - decline and only pay assessment fee</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700"><strong>Digital signature required</strong> - locksmith can't claim you approved work you didn't</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700"><strong>PDF evidence</strong> - complete proof for any dispute</span>
              </li>
            </ul>
          </div>

          {/* Locksmith Protection */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl p-6 border border-orange-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">Locksmith Protection</h3>
                <p className="text-sm text-orange-700">Fair payment, guaranteed</p>
              </div>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700"><strong>Verified customers</strong> - card on file before you travel</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700"><strong>Guaranteed payment</strong> - funds processed through secure platform</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700"><strong>GPS proof of arrival</strong> - customer can't claim you never showed up</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700"><strong>Digital sign-off</strong> - documented customer approval of work</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom trust statement - UPDATED */}
        <div className="text-center mt-12">
          <p className="text-slate-600 font-medium text-lg">
            LockSafe is the UK's first anti-fraud locksmith platform.
            <span className="text-orange-600 font-semibold"> Protection for everyone is our promise.</span>
          </p>
        </div>
      </div>
    </section>
  );
}
