import { type ServiceEntry, getServiceBySlug } from "@/lib/services-catalog";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

interface Props {
  service: ServiceEntry;
}

export function RelatedServices({ service }: Props) {
  const related = service.relatedSlugs
    .map((slug) => getServiceBySlug(slug))
    .filter((s): s is ServiceEntry => Boolean(s));

  if (related.length === 0) return null;

  return (
    <section aria-labelledby="related-heading" className="py-16 bg-slate-50">
      <div className="section-container">
        <h2
          id="related-heading"
          className="text-2xl md:text-3xl font-bold text-slate-900 mb-8"
        >
          Other LockSafe services you might need
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {related.map((rel) => (
            <Link
              key={rel.id}
              href={`/services/${rel.id}`}
              className="block bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-orange-300 transition-all group"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-2 group-hover:text-orange-600 transition-colors">
                {rel.title}
              </h3>
              <p className="text-sm text-slate-600 mb-4 leading-relaxed">
                {rel.shortDescription}
              </p>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900">
                  {rel.priceHint}
                </span>
                <span className="inline-flex items-center gap-1 text-orange-600 font-medium">
                  Read more
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
