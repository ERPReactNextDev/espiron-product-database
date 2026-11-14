"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";

type CollapsibleSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
  inputClassName?: string;
};

export default function CollapsibleSearch({
  value,
  onChange,
  placeholder,
  className = "",
  inputClassName = "",
}: CollapsibleSearchProps) {
  const [open, setOpen] = useState(Boolean(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const expanded = open || Boolean(value);

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  const closeSearch = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div className={`flex shrink-0 items-center gap-2 ${className}`}>
      <div
        className={`relative overflow-hidden transition-[width,opacity] duration-200 ${
          expanded ? "w-64 opacity-100" : "w-0 opacity-0"
        }`}
      >
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          tabIndex={expanded ? 0 : -1}
          className={`h-10 w-full rounded-xl border border-orange-300 bg-white/80 px-3 pr-9 text-sm text-gray-800 outline-none transition-colors placeholder:text-gray-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-200 ${inputClassName}`}
        />
        {expanded && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          if (expanded) closeSearch();
          else setOpen(true);
        }}
        aria-label={expanded ? "Close search" : "Open search"}
        aria-expanded={expanded}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-300 bg-amber-100 text-gray-700 transition-colors hover:bg-amber-200"
      >
        <Search className="h-4 w-4" />
      </button>
    </div>
  );
}
