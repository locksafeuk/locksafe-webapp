import { Button } from "@/components/ui/button";
import { SUPPORT_PHONE } from "@/lib/config";
import type { ServiceEntry } from "@/lib/services-catalog";
import { ArrowRight, Phone } from "lucide-react";
import Link from "next/link";

interface Props {
  service: ServiceEntry;
}

export function FinalCtaBlock({ service }: Props) {
  return (
    <section
      aria-labelledby="cta-heading"
      className="py-16 md:py-24 bg-gradient-to-b from-slate-900 to-slate-800 text-white"
    >
      <div className="section-container text-center">
        <h2
          id="cta-heading"
          className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4"
        >
          Ready to get this sorted — properly?
        </h2>
        <p className="text-lg md:text-xl text-slate-200 mb-8 max-w-2xl mx-auto">
          Post your job in 60 seconds. Verified, DBS-checked locksmiths quote
          you upfront. You see the price{" "}
          <span className="font-semibold text-white">before</span> any work
          starts. That's it. That's the platform.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
        <p className="mt-6 text-sm text-slate-400">
          Indicative pricing for {service.title.toLowerCase()}: £
          {service.priceRangeLow}–£{service.priceRangeHigh}. Fixed quote
          confirmed before any work begins.
        </p>
      </div>
    </section>
  );
}
