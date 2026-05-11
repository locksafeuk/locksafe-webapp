import { ChevronDown } from "lucide-react";

interface Props {
  items: { question: string; answer: string }[];
  id?: string;
  title?: string;
  eyebrow?: string;
}

/** Zero-JS FAQ accordion mirroring the existing services FaqAccordion. */
export function IntentFaq({
  items,
  id = "faq",
  title = "Frequently asked questions",
  eyebrow = "Answers",
}: Props) {
  if (items.length === 0) return null;
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="py-14 sm:py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8 sm:mb-10">
          <p className="text-[10px] sm:text-xs tracking-[0.3em] uppercase text-amber-600 mb-2 font-medium">
            {eyebrow}
          </p>
          <h2 id={`${id}-heading`} className="text-2xl sm:text-3xl font-bold text-slate-900">
            {title}
          </h2>
          <div className="mt-4 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        </div>
        <ul className="space-y-3">
          {items.map((faq) => (
            <li key={faq.question}>
              <details className="group bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <summary className="flex items-center justify-between gap-4 cursor-pointer px-5 py-4 font-semibold text-slate-900 list-none">
                  <span>{faq.question}</span>
                  <ChevronDown className="w-5 h-5 flex-shrink-0 text-slate-500 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-5 pb-5 text-slate-700 leading-relaxed">{faq.answer}</div>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
