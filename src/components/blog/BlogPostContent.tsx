"use client";

import { useMemo } from "react";

interface BlogPostContentProps {
  content: string;
}

export function BlogPostContent({ content }: BlogPostContentProps) {
  // Simple markdown-like parser for the content
  const renderedContent = useMemo(() => {
    // Split content into lines
    const lines = content.trim().split("\n");
    const elements: JSX.Element[] = [];
    let currentParagraph: string[] = [];
    let inList = false;
    let listItems: string[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join(" ").trim();
        if (text) {
          elements.push(
            <p key={elements.length} className="mb-4 text-slate-700 leading-relaxed">
              {parseInlineElements(text)}
            </p>
          );
        }
        currentParagraph = [];
      }
    };

    const flushList = () => {
      if (listItems.length > 0) {
        const isOrdered = listItems[0].match(/^\d+\./);
        if (isOrdered) {
          elements.push(
            <ol key={elements.length} className="mb-6 pl-6 space-y-2 list-decimal">
              {listItems.map((item, i) => (
                <li key={i} className="text-slate-700">
                  {parseInlineElements(item.replace(/^\d+\.\s*/, ""))}
                </li>
              ))}
            </ol>
          );
        } else {
          elements.push(
            <ul key={elements.length} className="mb-6 pl-6 space-y-2 list-disc">
              {listItems.map((item, i) => (
                <li key={i} className="text-slate-700">
                  {parseInlineElements(item.replace(/^[-*]\s*/, ""))}
                </li>
              ))}
            </ul>
          );
        }
        listItems = [];
        inList = false;
      }
    };

    const flushTable = () => {
      if (tableRows.length > 0) {
        const headerRow = tableRows[0];
        const bodyRows = tableRows.slice(2); // Skip header and separator

        elements.push(
          <div key={elements.length} className="mb-6 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  {headerRow.map((cell, i) => (
                    <th
                      key={i}
                      className="px-4 py-3 text-left font-semibold text-slate-900 border border-slate-200"
                    >
                      {cell.trim()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-4 py-3 text-slate-700 border border-slate-200"
                      >
                        {parseInlineElements(cell.trim())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
        inTable = false;
      }
    };

    const parseInlineElements = (text: string): React.ReactNode => {
      // Parse bold, italic, links, and code
      const parts: React.ReactNode[] = [];
      let remaining = text;
      let key = 0;

      while (remaining.length > 0) {
        // Bold
        const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
        if (boldMatch) {
          parts.push(
            <strong key={key++} className="font-semibold text-slate-900">
              {boldMatch[1]}
            </strong>
          );
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        // Inline code
        const codeMatch = remaining.match(/^`([^`]+)`/);
        if (codeMatch) {
          parts.push(
            <code
              key={key++}
              className="px-1.5 py-0.5 bg-slate-100 text-slate-800 rounded text-sm font-mono"
            >
              {codeMatch[1]}
            </code>
          );
          remaining = remaining.slice(codeMatch[0].length);
          continue;
        }

        // Links
        const linkMatch = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch) {
          parts.push(
            <a
              key={key++}
              href={linkMatch[2]}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              {linkMatch[1]}
            </a>
          );
          remaining = remaining.slice(linkMatch[0].length);
          continue;
        }

        // Checkmark emoji replacement
        if (remaining.startsWith("✅")) {
          parts.push(
            <span key={key++} className="text-green-600 mr-1">
              ✓
            </span>
          );
          remaining = remaining.slice(2);
          continue;
        }

        if (remaining.startsWith("❌")) {
          parts.push(
            <span key={key++} className="text-red-600 mr-1">
              ✗
            </span>
          );
          remaining = remaining.slice(2);
          continue;
        }

        if (remaining.startsWith("🚩")) {
          parts.push(
            <span key={key++} className="mr-1">
              ⚠️
            </span>
          );
          remaining = remaining.slice(2);
          continue;
        }

        // Regular character
        const nextSpecial = remaining.search(/\*\*|`|\[|✅|❌|🚩/);
        if (nextSpecial === -1) {
          parts.push(remaining);
          break;
        } else if (nextSpecial > 0) {
          parts.push(remaining.slice(0, nextSpecial));
          remaining = remaining.slice(nextSpecial);
        } else {
          // Unmatched pattern, just add the character
          parts.push(remaining[0]);
          remaining = remaining.slice(1);
        }
      }

      return parts.length === 1 ? parts[0] : parts;
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Code blocks
      if (trimmedLine.startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre key={elements.length} className="mb-6 p-4 bg-slate-900 text-slate-100 rounded-xl overflow-x-auto text-sm">
              <code>{codeLines.join("\n")}</code>
            </pre>
          );
          codeLines = [];
          inCodeBlock = false;
        } else {
          flushParagraph();
          flushList();
          flushTable();
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeLines.push(line);
        continue;
      }

      // Headers
      if (trimmedLine.startsWith("###")) {
        flushParagraph();
        flushList();
        flushTable();
        const text = trimmedLine.replace(/^###\s*/, "");
        elements.push(
          <h3 key={elements.length} className="text-xl font-bold text-slate-900 mt-8 mb-4">
            {text}
          </h3>
        );
        continue;
      }

      if (trimmedLine.startsWith("##")) {
        flushParagraph();
        flushList();
        flushTable();
        const text = trimmedLine.replace(/^##\s*/, "");
        elements.push(
          <h2 key={elements.length} className="text-2xl font-bold text-slate-900 mt-10 mb-4">
            {text}
          </h2>
        );
        continue;
      }

      // Horizontal rule
      if (trimmedLine === "---") {
        flushParagraph();
        flushList();
        flushTable();
        elements.push(<hr key={elements.length} className="my-8 border-slate-200" />);
        continue;
      }

      // Tables
      if (trimmedLine.startsWith("|")) {
        flushParagraph();
        flushList();
        inTable = true;
        const cells = trimmedLine
          .split("|")
          .filter((_, i, arr) => i > 0 && i < arr.length - 1);
        tableRows.push(cells);
        continue;
      } else if (inTable) {
        flushTable();
      }

      // Lists
      if (trimmedLine.match(/^[-*]\s/) || trimmedLine.match(/^\d+\.\s/)) {
        flushParagraph();
        if (inTable) flushTable();
        inList = true;
        listItems.push(trimmedLine);
        continue;
      } else if (inList) {
        flushList();
      }

      // Empty line
      if (trimmedLine === "") {
        flushParagraph();
        continue;
      }

      // Regular text
      currentParagraph.push(trimmedLine);
    }

    // Flush remaining content
    flushParagraph();
    flushList();
    flushTable();

    return elements;
  }, [content]);

  return <div className="blog-content">{renderedContent}</div>;
}
