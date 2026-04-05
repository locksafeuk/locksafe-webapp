"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BlogSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/blog?search=${encodeURIComponent(query.trim())}`);
    }
  };

  const clearSearch = () => {
    setQuery("");
  };

  // Popular searches for suggestions
  const popularSearches = [
    "locked out",
    "euro cylinder",
    "anti-snap locks",
    "smart locks",
    "emergency locksmith",
  ];

  return (
    <div className="w-full max-w-xl">
      <form onSubmit={handleSearch} className="relative">
        <div
          className={`relative flex items-center bg-white/10 backdrop-blur-sm rounded-xl border transition-all duration-300 ${
            isFocused
              ? "border-orange-500 bg-white/15 shadow-lg shadow-orange-500/10"
              : "border-white/20 hover:border-white/30"
          }`}
        >
          <Search className="absolute left-4 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search articles, guides, tips..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            className="w-full pl-12 pr-20 py-3 md:py-4 bg-transparent text-white placeholder-slate-400 focus:outline-none text-base"
            aria-label="Search blog articles"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-20 p-1 text-slate-400 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <Button
            type="submit"
            className="absolute right-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            Search
          </Button>
        </div>
      </form>

      {/* Popular Searches */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-400">Popular:</span>
        {popularSearches.map((term) => (
          <button
            key={term}
            type="button"
            onClick={() => {
              setQuery(term);
              router.push(`/blog?search=${encodeURIComponent(term)}`);
            }}
            className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white rounded-full transition-colors"
          >
            {term}
          </button>
        ))}
      </div>
    </div>
  );
}
