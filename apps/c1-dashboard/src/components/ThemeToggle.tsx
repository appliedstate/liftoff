"use client";

import { useTheme, type ThemePreference } from "@/lib/theme";

/**
 * Three-segment switch: Light / System / Dark.
 *
 * Apple/Framer pattern — the user can pin a theme or let it follow
 * the OS. The active segment is highlighted. Compact enough to sit
 * in a header next to other controls.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  const segments: { value: ThemePreference; label: string; icon: JSX.Element }[] = [
    {
      value: "light",
      label: "Light",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ),
    },
    {
      value: "system",
      label: "System",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      ),
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      ),
    },
  ];

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center rounded-lg bg-neutral-100 p-0.5 dark:bg-neutral-800"
    >
      {segments.map((segment) => {
        const active = preference === segment.value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={segment.label}
            title={segment.label}
            onClick={() => setPreference(segment.value)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition ${
              active
                ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:bg-neutral-700 dark:text-neutral-50"
                : "text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {segment.icon}
          </button>
        );
      })}
    </div>
  );
}
