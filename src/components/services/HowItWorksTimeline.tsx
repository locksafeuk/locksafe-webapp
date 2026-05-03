import type { ServiceEntry } from "@/lib/services-catalog";

interface Props {
  service: ServiceEntry;
}

export function HowItWorksTimeline({ service }: Props) {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="py-16 bg-slate-50"
    >
      <div className="section-container">
        <h2
          id="how-heading"
          className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-4"
        >
          How it works
        </h2>
        <p className="text-lg text-slate-600 text-center max-w-2xl mx-auto mb-12">
          Three steps. About 60 seconds of your time. Then verified locksmiths
          compete for your job — not the other way around.
        </p>
        <ol className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {service.howItWorks.map((step, i) => (
            <li
              key={step.title}
              className="bg-white border border-slate-200 rounded-2xl p-6 relative"
            >
              <div className="absolute -top-4 left-6 w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center font-bold shadow-md">
                {i + 1}
              </div>
              <h3 className="font-bold text-slate-900 mt-4 mb-2 text-lg">
                {step.title.replace(/^\d+\.\s*/, "")}
              </h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                {step.description}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
