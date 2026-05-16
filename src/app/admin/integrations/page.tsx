import Link from "next/link";
import { Globe, BarChart3, Plug } from "lucide-react";

const integrations = [
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
        {integrations.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded-xl border ${item.border} ${item.bg} p-5 hover:brightness-110 transition-all`}
          >
            <div className="flex items-center gap-3 mb-3">
              <item.icon className={`w-5 h-5 ${item.color}`} />
              <span className={`font-semibold ${item.color}`}>{item.title}</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
