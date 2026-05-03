import type { ServiceEntry } from "@/lib/services-catalog";
import { ChevronDown } from "lucide-react";

interface Props {
  service: ServiceEntry;
}

/**
 * Zero-JS FAQ accordion using native <details>/<summary>.
 * Anchored at #faq so it pairs with the Speakable JSON-LD selector.
 */
export function FaqAccordion({ service }: Props) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="py-16 md:py-20 bg-white"
    >
      <div className="section-container">
        <div className="max-w-3xl mx-auto">
          <h2
            id="faq-heading"
            className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4"
          >
            Frequently asked questions
          </h2>
          <p className="text-lg text-slate-600 text-center mb-12">
            The questions UK customers actually ask before booking{" "}
            {service.title.toLowerCase()}.
          </p>

          <ul className="space-y-3">
            {service.faqs.map((faq) => (
              <li key={faq.question}>
                <details className="group bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                  <summary className="flex items-center justify-between gap-4 cursor-pointer px-6 py-4 font-semibold text-slate-900 list-none">
                    <span>{faq.question}</span>
                    <ChevronDown className="w-5 h-5 flex-shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="px-6 pb-5 text-slate-600 leading-relaxed">
                    {faq.answer}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
