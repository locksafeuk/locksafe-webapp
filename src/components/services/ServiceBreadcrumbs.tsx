import { ChevronRight } from "lucide-react";
import Link from "next/link";

interface Props {
  title: string;
}

export function ServiceBreadcrumbs({ title }: Props) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="bg-slate-50 border-b border-slate-200"
    >
      <div className="section-container py-3">
        <ol className="flex items-center gap-2 text-sm text-slate-600">
          <li>
            <Link href="/" className="hover:text-orange-600 transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </li>
          <li>
            <Link
              href="/services"
              className="hover:text-orange-600 transition-colors"
            >
              Services
            </Link>
          </li>
          <li aria-hidden="true">
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </li>
          <li className="font-medium text-slate-900" aria-current="page">
            {title}
          </li>
        </ol>
      </div>
    </nav>
  );
}
