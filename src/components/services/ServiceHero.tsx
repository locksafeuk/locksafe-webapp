import { Button } from "@/components/ui/button";
import { SUPPORT_PHONE } from "@/lib/config";
import type { ServiceEntry } from "@/lib/services-catalog";
import { ArrowRight, Clock, FileCheck, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface Props {
  service: ServiceEntry;
}

export function ServiceHero({ service }: Props) {
  return (
    <section
      id="top"
      aria-labelledby="hero-heading"
      className="py-16 md:py-24 bg-gradient-to-b from-slate-900 to-slate-800 text-white"
    >
      <div className="section-container">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-orange-500/20 text-orange-300 rounded-full px-4 py-2 text-sm font-semibold mb-6 uppercase tracking-wide">
            {service.title}
          </div>
          <h1
            id="hero-heading"
            className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight"
          >
            {service.hero}
          </h1>
          <p className="text-lg md:text-xl text-slate-200 mb-8 leading-relaxed">
            {service.subhead}
          </p>

          {/* Trust pill row */}
          <ul className="flex flex-wrap gap-x-6 gap-y-3 mb-8 text-sm text-slate-200">
            <li className="inline-flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-orange-400" />
              DBS-checked locksmiths
            </li>
            <li className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-400" />
              24/7 across the UK
            </li>
            <li className="inline-flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-orange-400" />
              Insurance-ready paperwork
            </li>
          </ul>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link href={`/request?service=${service.id}`}>
              <Button className="btn-primary px-8 py-6 text-base">
                Get a fixed quote now
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
            <a href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`}>
              <Button
                variant="outline"
                className="border-slate-300 text-white hover:text-slate-900 px-8 py-6 text-base"
              >
                <Phone className="w-4 h-4 mr-1" />
                Call {SUPPORT_PHONE}
              </Button>
            </a>
          </div>

          <div className="mt-6 text-sm text-slate-300">
            Indicative pricing:{" "}
            <span className="font-semibold text-white">
              £{service.priceRangeLow}–£{service.priceRangeHigh}
            </span>
            {" · "}
            quote agreed in writing before any work starts.
          </div>

          {/* Urgency line */}
          {service.urgencyTriggers[0] && (
            <p className="mt-4 text-sm text-orange-300 font-medium">
              <span className="inline-block w-2 h-2 bg-orange-400 rounded-full mr-2 animate-pulse" />
              {service.urgencyTriggers[0]}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
