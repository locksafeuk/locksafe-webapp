import type { ServiceEntry } from "@/lib/services-catalog";
import { ShieldCheck } from "lucide-react";

interface Props {
  service: ServiceEntry;
}

export function RiskReversalBanner({ service }: Props) {
  return (
    <section
      aria-labelledby="guarantee-heading"
      className="py-12 bg-gradient-to-r from-orange-500 to-orange-600 text-white"
    >
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center">
          <ShieldCheck className="w-12 h-12 mx-auto mb-4" />
          <h2
            id="guarantee-heading"
            className="text-2xl md:text-3xl font-bold mb-4"
          >
            The LockSafe anti-stitch-up guarantee
          </h2>
          <p className="text-lg leading-relaxed">{service.riskReversal}</p>
        </div>
      </div>
    </section>
  );
}
