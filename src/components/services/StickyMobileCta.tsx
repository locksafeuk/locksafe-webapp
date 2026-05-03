import { SUPPORT_PHONE } from "@/lib/config";
import { ArrowRight, Phone } from "lucide-react";
import Link from "next/link";

interface Props {
  serviceId: string;
}

/**
 * Bottom-of-viewport sticky CTA for mobile only.
 * Pure CSS — no client JS, no hydration cost. Hidden on md+ screens where
 * the header CTA stays visible during scroll.
 */
export function StickyMobileCta({ serviceId }: Props) {
  return (
    <div
      aria-label="Quick actions"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-2xl px-4 py-3 flex gap-2"
    >
      <a
        href={`tel:${SUPPORT_PHONE.replace(/\s+/g, "")}`}
        className="flex-1 inline-flex items-center justify-center gap-2 border border-slate-300 text-slate-900 rounded-xl px-3 py-3 text-sm font-semibold"
      >
        <Phone className="w-4 h-4" />
        Call
      </a>
      <Link
        href={`/request?service=${serviceId}`}
        className="flex-[2] inline-flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-3 py-3 text-sm font-semibold"
      >
        Get fixed quote
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
