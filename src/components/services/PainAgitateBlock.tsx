import type { ServiceEntry } from "@/lib/services-catalog";
import { AlertTriangle } from "lucide-react";

interface Props {
  service: ServiceEntry;
}

/**
 * Problem → Agitate block (Ryan Deiss). Names the pain in the customer's
 * own language so they recognise themselves on the page within 5 seconds.
 */
export function PainAgitateBlock({ service }: Props) {
  if (service.painPoints.length === 0) return null;
  return (
    <section
      aria-labelledby="pain-heading"
      className="py-16 bg-slate-900 text-white"
    >
      <div className="section-container">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-orange-300 mb-4">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-semibold uppercase tracking-wide">
              Sound familiar?
            </span>
          </div>
          <h2 id="pain-heading" className="text-3xl md:text-4xl font-bold mb-6">
            If you're reading this, you're probably feeling one of these
          </h2>
          <ul className="space-y-4">
            {service.painPoints.map((pain) => (
              <li
                key={pain}
                className="flex gap-4 text-lg text-slate-200 leading-relaxed border-l-2 border-orange-500 pl-4"
              >
                {pain}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-lg text-slate-300">
            <span className="font-semibold text-white">
              You're not wrong to feel that way.
            </span>{" "}
            That's exactly why LockSafe UK exists.
          </p>
        </div>
      </div>
    </section>
  );
}
