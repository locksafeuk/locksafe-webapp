import { RequestCTAButton } from "@/components/onboarding/RequestCTAButton";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Phone, Shield } from "lucide-react";
import Link from "next/link";

export function CTA() {
  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-orange-500 to-amber-500 relative overflow-hidden">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute top-0 left-0 w-full h-full"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.4'%3E%3Cpath d='m36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm-30 30v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      <div className="section-container relative">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white rounded-full px-4 py-2 text-sm font-medium mb-6">
            <Shield className="w-4 h-4" />
            You're Protected
          </div>

          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
            Locked Out?
            <br />
            <span className="text-white/90">Get Help on YOUR Terms</span>
          </h2>

          <p className="text-xl text-white/90 mb-6 max-w-xl mx-auto">
            Choose your locksmith. See the quote first. Stay in control.
          </p>

          {/* Quick promises */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 text-white bg-white/20 rounded-full px-4 py-2 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4 text-white" />
              Refund if no-show
            </div>
            <div className="flex items-center gap-2 text-white/90 text-sm">
              <CheckCircle2 className="w-4 h-4 text-white" />
              Verified locksmiths
            </div>
            <div className="flex items-center gap-2 text-white/90 text-sm">
              <CheckCircle2 className="w-4 h-4 text-white" />
              See quote first
            </div>
            <div className="flex items-center gap-2 text-white/90 text-sm">
              <CheckCircle2 className="w-4 h-4 text-white" />
              Full documentation
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <RequestCTAButton className="bg-white text-orange-600 hover:bg-slate-100 font-semibold px-8 py-6 text-lg rounded-full">
              Get Emergency Help
              <ArrowRight className="w-5 h-5 ml-2" />
            </RequestCTAButton>
            <a href="tel:07818333989">
              <Button
                variant="outline"
                className="border-2 border-white/80 text-white hover:bg-white/20 font-semibold px-8 py-6 text-lg rounded-full bg-white/10"
              >
                <Phone className="w-5 h-5 mr-2" />
                07818 333 989
              </Button>
            </a>
          </div>

          <p className="text-white/80 text-sm mt-6">
            100% free for customers. No platform fees, no hidden charges.
          </p>
        </div>
      </div>
    </section>
  );
}
