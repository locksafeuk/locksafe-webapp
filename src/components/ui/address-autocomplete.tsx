"use client";

import { Loader2, MapPin, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Free-text UK address autocomplete powered by Google Places (New).
 *
 * Why this component exists:
 *   Google Places does NOT expose a "list every house in a UK postcode"
 *   endpoint (that's Royal Mail PAF, only available via paid licensees).
 *   So instead of a postcode-first picker, we let the user type their
 *   street/house number and bias the suggestions to their postcode.
 *
 * The actual Google call happens server-side at /api/address/autocomplete
 * so the API key never touches the browser.
 */

interface AddressAutocompleteSuggestion {
  text: string;
  mainText: string;
  secondaryText: string;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  postcode?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  inputClassName?: string;
  /** Render as a single-line input instead of a textarea. */
  singleLine?: boolean;
  /** Disable suggestions entirely (useful while postcode is empty). */
  disabled?: boolean;
}

export function AddressAutocomplete({
  value,
  onChange,
  postcode,
  placeholder = "House number and street name",
  rows = 3,
  className = "",
  inputClassName = "w-full px-4 py-3 text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none resize-none",
  singleLine = false,
  disabled = false,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressAutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasPicked, setHasPicked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchSuggestions = useCallback(
    async (input: string, pc?: string) => {
      if (disabled || input.trim().length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      try {
        const params = new URLSearchParams({ input });
        if (pc) params.set("postcode", pc);
        const res = await fetch(`/api/address/autocomplete?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setSuggestions([]);
          setOpen(false);
          return;
        }
        const data: { suggestions?: AddressAutocompleteSuggestion[] } = await res.json();
        const list = data.suggestions ?? [];
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setSuggestions([]);
          setOpen(false);
        }
      } finally {
        setLoading(false);
      }
    },
    [disabled]
  );

  // Debounced fetch on input change. We skip fetching right after the user
  // picked a suggestion so we don't immediately re-open the dropdown.
  useEffect(() => {
    if (hasPicked) {
      setHasPicked(false);
      return;
    }
    const timer = setTimeout(() => {
      fetchSuggestions(value, postcode);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, postcode]);

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const handlePick = (s: AddressAutocompleteSuggestion) => {
    // Strip trailing ", UK" / postcode noise so the field reads like a UK address.
    const cleaned = s.text
      .replace(/,\s*(UK|United Kingdom)\s*$/i, "")
      .trim();
    onChange(cleaned);
    setHasPicked(true);
    setOpen(false);
    setSuggestions([]);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {singleLine ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClassName}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={inputClassName}
        />
      )}

      {loading && (
        <Loader2 className="absolute right-3 top-3 w-4 h-4 text-orange-500 animate-spin pointer-events-none" />
      )}

      {open && suggestions.length > 0 && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden animate-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Search className="w-3 h-3" />
              Pick your address
            </p>
            <span className="text-[11px] text-slate-400">
              {suggestions.length} result{suggestions.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {suggestions.map((s, i) => (
              <button
                key={`${s.text}-${i}`}
                type="button"
                onClick={() => handlePick(s)}
                className="w-full px-4 py-3 text-left hover:bg-orange-50 border-b border-slate-100 last:border-0 transition-colors flex gap-3"
              >
                <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {s.mainText || s.text}
                  </div>
                  {s.secondaryText && (
                    <div className="text-xs text-slate-500 truncate">{s.secondaryText}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
