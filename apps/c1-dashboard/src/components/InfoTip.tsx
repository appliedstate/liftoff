"use client";

import type { ReactNode } from "react";

// Small info-circle button next to a heading. Click opens a popover
// with longer-form context that doesn't belong in the main UI.
//
// Implementation uses a native <details>/<summary> so click-to-toggle
// works without React state. Caller can place this inline next to a
// heading; the popover is absolutely positioned.
//
// onClick events stop propagation so this can be safely nested inside
// another <details> summary (e.g. a section that's itself collapsible).
export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <details
      className="group/info relative inline-flex"
      onClick={(e) => e.stopPropagation()}
    >
      <summary
        className="inline-flex h-3.5 w-3.5 cursor-pointer list-none items-center justify-center rounded-full bg-neutral-100 text-[8px] font-bold leading-none text-neutral-500 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 [&::-webkit-details-marker]:hidden"
        onClick={(e) => e.stopPropagation()}
        aria-label="More info"
      >
        i
      </summary>
      <div className="absolute left-0 top-6 z-30 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-black/[0.08] bg-white p-3 text-sm text-neutral-700 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.18)] dark:border-white/[0.10] dark:bg-neutral-900 dark:text-neutral-200">
        {children}
      </div>
    </details>
  );
}
