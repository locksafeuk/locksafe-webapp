"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { categoryLabels, type BlogCategory } from "@/lib/blog-data";
import {
  Home,
  AlertTriangle,
  Key,
  Building2,
  Lightbulb,
  Newspaper,
  Grid3X3,
} from "lucide-react";

const categoryIcons: Record<BlogCategory | "all", React.ReactNode> = {
  all: <Grid3X3 className="w-4 h-4" />,
  "home-security": <Home className="w-4 h-4" />,
  "emergency-locksmith": <AlertTriangle className="w-4 h-4" />,
  "lock-guides": <Key className="w-4 h-4" />,
  "commercial-security": <Building2 className="w-4 h-4" />,
  "tips-advice": <Lightbulb className="w-4 h-4" />,
  "industry-news": <Newspaper className="w-4 h-4" />,
};

interface BlogCategoryFilterProps {
  categories: BlogCategory[];
  activeCategory?: BlogCategory | null;
}

export function BlogCategoryFilter({
  categories,
  activeCategory = null,
}: BlogCategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") || activeCategory;

  const handleCategoryClick = (category: BlogCategory | null) => {
    if (category === null) {
      router.push("/blog");
    } else {
      router.push(`/blog/category/${category}`);
    }
  };

  return (
    <nav aria-label="Blog categories" className="relative">
      {/* Gradient fade indicators for scroll */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none md:hidden" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none md:hidden" />

      {/* Scrollable container */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex items-center gap-2 md:gap-3 min-w-max md:flex-wrap md:min-w-0">
          {/* All Category */}
          <button
            type="button"
            onClick={() => handleCategoryClick(null)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              !currentCategory
                ? "bg-orange-500 text-white shadow-md"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {categoryIcons.all}
            All Articles
          </button>

          {/* Category buttons */}
          {categories.map((category) => {
            const info = categoryLabels[category];
            const isActive = currentCategory === category;

            return (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoryClick(category)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-orange-500 text-white shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {categoryIcons[category]}
                {info.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile scroll hint */}
      <p className="text-xs text-slate-400 mt-2 text-center md:hidden">
        ← Swipe to see more categories →
      </p>
    </nav>
  );
}
