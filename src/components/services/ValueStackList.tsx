import { Button } from "@/components/ui/button";
import type { ServiceEntry } from "@/lib/services-catalog";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

interface Props {
  service: ServiceEntry;
}

/**
 * Value-stack list (Ryan Deiss "here's exactly what you get").
 * Each line is a numbered, headlined value statement followed by a
 * one-line description.
 */
export function ValueStackList({ service }: Props) {
  return (
    <section
      aria-labelledby="value-heading"
      className="py-16 md:py-20 bg-white"
    >
      <div className="section-container">
        <div className="max-w-3xl mb-12">
          <h2
            id="value-heading"
            className="text-3xl md:text-4xl font-bold text-slate-900 mb-4"
          >
            Here's exactly what you get when you book{" "}
            {service.title.toLowerCase()} through LockSafe
          </h2>
          <p className="text-lg text-slate-600">
            No vague promises. Every single one of the points below is part of
            the standard LockSafe job — not an upsell, not a premium tier.
          </p>
        </div>

        <ol className="grid md:grid-cols-2 gap-6">
          {service.valueStack.map((item, i) => (
            <li
              key={item.headline}
              className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex gap-4"
            >
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center font-bold">
                  {i + 1}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-slate-900 mb-1 flex items-start gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span>{item.headline}</span>
                </h3>
                <p className="text-slate-600 text-sm leading-relaxed pl-7">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-10 flex justify-center">
          <Link href={`/request?service=${service.id}`}>
            <Button className="btn-primary px-8 py-6 text-base">
              Post your job — get quotes in minutes
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
