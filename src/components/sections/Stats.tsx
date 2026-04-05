"use client";

import { CheckCircle2 } from "lucide-react";

const stats = [
  {
    value: "100%",
    label: "Refund Guarantee",
    description: "If locksmith doesn't show",
  },
  {
    value: "YOU",
    label: "Choose your locksmith",
    description: "Compare fees, ETAs & reviews",
  },
  {
    value: "15 min",
    label: "Average response",
    description: "Fast help when you need it",
  },
  {
    value: "PDF",
    label: "Legal documentation",
    description: "GPS, photos, signature",
  },
];

const trustPoints = [
  "Automatic refund if locksmith doesn't arrive on time",
  "Work quote shown BEFORE any work starts",
  "Decline the quote? Pay only the assessment fee",
  "Complete legal paper trail for every job",
  "Customer card verified before locksmith travels",
];

export function Stats() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="section-container">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-full px-4 py-2 text-sm font-medium mb-4">
            THE LOCKSAFE DIFFERENCE
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-slate-900">
            Transparent. Fair. Your Choice.
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12 mb-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="stat-number mb-2">{stat.value}</div>
              <div className="font-semibold text-slate-900 mb-1">{stat.label}</div>
              <div className="text-sm text-slate-500">{stat.description}</div>
            </div>
          ))}
        </div>

        {/* Trust points */}
        <div className="bg-slate-50 rounded-2xl p-8 max-w-3xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-4">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-slate-700">{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
