"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { FAQ } from "@/lib/blog-data";

interface BlogFAQProps {
  faqs: FAQ[];
}

export function BlogFAQ({ faqs }: BlogFAQProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (faqs.length === 0) {
    return null;
  }

  return (
    <div
      className="space-y-3"
      itemScope
      itemType="https://schema.org/FAQPage"
    >
      {faqs.map((faq, index) => {
        const isOpen = openIndex === index;

        return (
          <div
            key={index}
            className={`bg-white border rounded-xl overflow-hidden transition-all ${
              isOpen ? "border-orange-300 shadow-sm" : "border-slate-200"
            }`}
            itemScope
            itemProp="mainEntity"
            itemType="https://schema.org/Question"
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-slate-50 transition-colors"
              aria-expanded={isOpen}
            >
              <div className="flex items-start gap-3">
                <HelpCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  isOpen ? "text-orange-500" : "text-slate-400"
                }`} />
                <h3
                  className={`font-medium ${
                    isOpen ? "text-orange-600" : "text-slate-900"
                  }`}
                  itemProp="name"
                >
                  {faq.question}
                </h3>
              </div>
              {isOpen ? (
                <ChevronUp className="w-5 h-5 text-orange-500 flex-shrink-0" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
              )}
            </button>

            {isOpen && (
              <div
                className="px-5 pb-5 pt-0"
                itemScope
                itemProp="acceptedAnswer"
                itemType="https://schema.org/Answer"
              >
                <div className="pl-8 border-l-2 border-orange-200 ml-2">
                  <p className="text-slate-600 leading-relaxed" itemProp="text">
                    {faq.answer}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
