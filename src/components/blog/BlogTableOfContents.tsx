"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, List } from "lucide-react";

interface BlogTableOfContentsProps {
  content: string;
}

interface TocItem {
  id: string;
  title: string;
  level: number;
}

export function BlogTableOfContents({ content }: BlogTableOfContentsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Extract headings from content
  const headings = useMemo(() => {
    const lines = content.split("\n");
    const items: TocItem[] = [];

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Match ## and ### headings
      const h2Match = trimmedLine.match(/^##\s+(.+)$/);
      const h3Match = trimmedLine.match(/^###\s+(.+)$/);

      if (h2Match) {
        const title = h2Match[1];
        const id = title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "-");
        items.push({ id, title, level: 2 });
      } else if (h3Match) {
        const title = h3Match[1];
        const id = title
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "-");
        items.push({ id, title, level: 3 });
      }
    }

    return items;
  }, [content]);

  if (headings.length === 0) {
    return null;
  }

  const scrollToHeading = (id: string) => {
    // Find the heading element by searching for matching text
    const headings = document.querySelectorAll("h2, h3");
    for (const heading of headings) {
      const headingId = heading.textContent
        ?.toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "-");

      if (headingId === id) {
        heading.scrollIntoView({ behavior: "smooth", block: "start" });
        break;
      }
    }
  };

  return (
    <nav
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden"
      aria-label="Table of contents"
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-900">
          <List className="w-5 h-5 text-orange-500" />
          Table of Contents
        </span>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {/* Content */}
      {isExpanded && (
        <div className="p-4 pt-2">
          <ul className="space-y-1">
            {headings.map((heading, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => scrollToHeading(heading.id)}
                  className={`w-full text-left py-1.5 px-2 rounded text-sm hover:bg-orange-50 hover:text-orange-600 transition-colors ${
                    heading.level === 3 ? "pl-6 text-slate-500" : "font-medium text-slate-700"
                  }`}
                >
                  {heading.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
