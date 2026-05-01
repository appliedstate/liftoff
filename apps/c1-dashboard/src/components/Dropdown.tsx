"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass, inputPublishClass } from "@/lib/ui";

export type DropdownOption = { value: string; label: string };

export function Dropdown({
  value,
  onChange,
  options,
  placeholder,
  className,
  openSignal,
  emptyLabel,
  tone = "default",
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  className?: string;
  openSignal?: string | number | null;
  emptyLabel?: string;
  // 'publish' renders the trigger button in the Apple-green publish palette
  // when a value is selected — for dropdowns whose value goes downstream
  // into the Strategis or Facebook payload.
  tone?: "default" | "publish";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);
  const lastOpenSignalRef = useRef<string>("");
  const triggerClass = tone === "publish" && selected ? inputPublishClass : inputClass;

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    const next = String(openSignal ?? "").trim();
    if (!next) {
      lastOpenSignalRef.current = "";
      return;
    }
    if (next !== lastOpenSignalRef.current) {
      setOpen(true);
      lastOpenSignalRef.current = next;
    }
  }, [openSignal]);

  return (
    <div ref={ref} className={`relative ${open ? "z-[140]" : "z-10"} ${className || ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`${triggerClass} flex w-full items-center justify-between text-left`}
      >
        <span className={`truncate ${selected ? "" : "text-neutral-400 dark:text-neutral-500"}`}>
          {selected?.label || placeholder || "Select…"}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ml-2 shrink-0 text-neutral-500 dark:text-neutral-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-[160] mt-1.5 max-h-72 overflow-auto rounded-lg bg-white dark:bg-neutral-900 p-1 ring-1 ring-black/[0.08] dark:ring-white/[0.10] shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18),0_4px_8px_-4px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6),0_4px_8px_-4px_rgba(0,0,0,0.4)]"
        >
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400">
              {emptyLabel || "No matches"}
            </div>
          ) : options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value || "__empty__"}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                  isSelected
                    ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-50"
                    : "text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
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
          })}
        </div>
      ) : null}
    </div>
  );
}
