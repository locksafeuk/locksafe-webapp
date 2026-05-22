import Link from "next/link";
import { Globe, BarChart3, Plug, ExternalLink } from "lucide-react";

type IntegrationCard = {
  href: string;
  icon: typeof Globe;
  title: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  external?: boolean;
};

const integrations: IntegrationCard[] = [
  {
    href: "/admin/integrations/google-ads",
    icon: Globe,
    title: "Google Ads",
    description: "Connect your Google Ads account, manage OAuth credentials, and sync campaign performance.",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
  },
  {
    href: "/admin/integrations/google-ads/drafts",
    icon: BarChart3,
    title: "Ad Drafts",
    description: "Review, approve, and publish campaign drafts generated from coverage data.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
  },
  {
    href: "https://ads.google.com/aw/campaigns?__c=4715226378&authuser=0",
    icon: ExternalLink,
    title: "Open Google Ads ↗",
    description: "Jump straight into the live Google Ads console for www.locksafe.uk (471-522-6378) in a new tab.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    external: true,
  },
];

export default function IntegrationsPage() {
  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Plug className="w-6 h-6 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
        </div>
        <p className="text-slate-400 text-sm">
          Connect third-party platforms to LockSafe to automate advertising, analytics, and more.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((item) => {
          const className = `block rounded-xl border ${item.border} ${item.bg} p-5 hover:brightness-110 transition-all`;
          const inner = (
            <>
              <div className="flex items-center gap-3 mb-3">
                <item.icon className={`w-5 h-5 ${item.color}`} />
                <span className={`font-semibold ${item.color}`}>{item.title}</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
            </>
          );
          return item.external ? (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={className}
            >
              {inner}
            </a>
          ) : (
            <Link key={item.href} href={item.href} className={className}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
