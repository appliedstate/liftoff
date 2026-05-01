"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { inputClass } from "@/lib/ui";

export type ComboboxOption = { value: string; label: string };

// Single-field search-and-select. Replaces the 'free-text input above
// a Dropdown' pattern with one control: type to filter, click to pick,
// click X to clear. The dropdown opens on focus / type and closes on
// blur, Escape, or selection.
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel,
  className,
  filterFn,
}: {
  value: string;
  onChange: (value: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  emptyLabel?: string;
  className?: string;
  // Optional override — by default we case-insensitive substring-match the label.
  filterFn?: (option: ComboboxOption, query: string) => boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    if (filterFn) return options.filter((o) => filterFn(o, query));
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, filterFn]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string) {
    onChange(next);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear() {
    onChange("");
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div ref={ref} className={`relative ${open ? "z-[140]" : "z-10"} ${className || ""}`}>
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected ? selected.label : placeholder || "Search…"}
          className={`${inputClass} ${selected && !query ? "text-neutral-700 dark:text-neutral-200 placeholder:text-neutral-700 placeholder:dark:text-neutral-200" : ""} pr-9`}
        />
        {selected && !query ? (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-200 hover:text-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        ) : (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 dark:text-neutral-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        )}
      </div>

      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-[160] mt-1.5 max-h-72 overflow-auto rounded-lg bg-white dark:bg-neutral-900 p-1 ring-1 ring-black/[0.08] dark:ring-white/[0.10] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6),0_4px_8px_-4px_rgba(0,0,0,0.4)]"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
              {emptyLabel || (query ? `No matches for “${query.trim()}”` : "No options")}
            </div>
          ) : (
            filtered.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value || "__empty__"}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => pick(option.value)}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50"
                      : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="ml-2 shrink-0 text-[#0071e3] dark:text-[#4a9fff]"
                    >
                      <path d="M5 12l5 5L20 7" />
                    </svg>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
