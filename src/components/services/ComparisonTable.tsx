import type { ServiceEntry } from "@/lib/services-catalog";
import { Check, X } from "lucide-react";

interface Props {
  service: ServiceEntry;
}

/**
 * Side-by-side comparison: LockSafe vs. typical UK locksmith.
 * Drives the "anti-fraud" differentiator and frames the buyer's choice
 * as a simple, scannable contrast.
 */
export function ComparisonTable({ service }: Props) {
  return (
    <section aria-labelledby="compare-heading" className="py-16 bg-white">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <h2
            id="compare-heading"
            className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
          >
            LockSafe vs the typical UK locksmith
          </h2>
          <p className="text-lg text-slate-600">
            Most UK lockouts and lock changes still happen on the doorstep
            handshake model. Here's what changes when you book through LockSafe.
          </p>
        </div>

        <div className="max-w-4xl mx-auto overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-sm md:text-base">
            <caption className="sr-only">
              Comparison of LockSafe UK service against a typical UK locksmith
              for {service.title.toLowerCase()}
            </caption>
            <thead className="bg-slate-900 text-white">
              <tr>
                <th
                  scope="col"
                  className="text-left py-4 px-4 md:px-6 font-semibold"
                >
                  &nbsp;
                </th>
                <th
                  scope="col"
                  className="text-left py-4 px-4 md:px-6 font-semibold bg-orange-500"
                >
                  LockSafe UK
                </th>
                <th
                  scope="col"
                  className="text-left py-4 px-4 md:px-6 font-semibold"
                >
                  Typical locksmith
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {service.comparisonRows.map((row) => (
                <tr key={row.feature} className="bg-white">
                  <th
                    scope="row"
                    className="text-left py-4 px-4 md:px-6 font-semibold text-slate-900 align-top"
                  >
                    {row.feature}
                  </th>
                  <td className="py-4 px-4 md:px-6 align-top">
                    <div className="flex gap-2 items-start">
                      <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-700">{row.locksafe}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 md:px-6 align-top">
                    <div className="flex gap-2 items-start">
                      <X className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-500">{row.typical}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
