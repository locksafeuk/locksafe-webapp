import type { ServiceEntry } from "@/lib/services-catalog";
import { Quote } from "lucide-react";

interface Props {
  service: ServiceEntry;
}

export function SocialProofGrid({ service }: Props) {
  if (service.socialProof.length === 0) return null;
  return (
    <section aria-labelledby="reviews-heading" className="py-16 bg-slate-50">
      <div className="section-container">
        <h2
          id="reviews-heading"
          className="text-3xl md:text-4xl font-bold text-slate-900 text-center mb-12"
        >
          Real customers, real outcomes
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {service.socialProof.map((proof) => (
            <figure
              key={proof.quote}
              className="bg-white border border-slate-200 rounded-2xl p-6"
            >
              <Quote className="w-8 h-8 text-orange-500 mb-3" />
              <blockquote className="text-slate-700 leading-relaxed mb-4">
                {proof.quote}
              </blockquote>
              <figcaption className="text-sm text-slate-500">
                <span className="font-semibold text-slate-900">
                  {proof.author}
                </span>
                {" · "}
                {proof.location}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
