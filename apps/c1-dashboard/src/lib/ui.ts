// Shared design tokens for the Liftoff UI.
//
// Framer-inspired: borderless fields, soft fills, hairline rings on cards,
// Apple accent palette (#0071e3 blue, #34c759 green, #ff9500 orange,
// #ff3b30 red), 12px (rounded-xl) on cards / 8px (rounded-lg) on fields
// and buttons.
//
// Dark mode follows `prefers-color-scheme: dark`. Surfaces step from
// near-black page bg → neutral-900 cards → neutral-800 inputs/sub-cards,
// matching Framer's editor.
//
// Import from any page that wants the same look — a tweak here ripples
// to every consumer.

export const inputClass =
  "w-full rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-50 outline-none transition placeholder:text-neutral-400 dark:placeholder:text-neutral-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 focus:bg-white dark:focus:bg-neutral-900 focus:ring-2 focus:ring-[#0071e3]";

export const selectClass = inputClass;

export const cardClass =
  "rounded-xl bg-white dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.10)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_12px_32px_-16px_rgba(0,0,0,0.6)]";

export const subCardClass =
  "rounded-xl bg-neutral-50/80 dark:bg-neutral-800/50 ring-1 ring-black/[0.04] dark:ring-white/[0.06]";

export const sectionLabel = "text-lg font-semibold text-neutral-900 dark:text-neutral-50";

export const fieldLabel =
  "mb-1.5 block text-[13px] font-semibold text-neutral-900 dark:text-neutral-100";

export const pillClass =
  "inline-flex min-w-0 max-w-full items-center rounded-full bg-[#0071e3]/[0.06] dark:bg-[#0071e3]/[0.18] px-2.5 py-1 text-xs font-semibold text-[#0071e3] dark:text-[#4a9fff] [overflow-wrap:anywhere]";

export const buttonGhost =
  "rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 transition hover:bg-neutral-200 dark:hover:bg-neutral-700";

// Inverts in dark — primary CTA goes white-on-near-black in light, near-black-on-white in dark (Apple/Framer pattern).
export const buttonPrimary =
  "rounded-lg bg-neutral-900 dark:bg-white px-3 py-2 text-xs font-semibold text-white dark:text-neutral-900 transition hover:bg-neutral-800 dark:hover:bg-neutral-100 disabled:cursor-not-allowed disabled:bg-neutral-300 dark:disabled:bg-neutral-700 dark:disabled:text-neutral-500";

// Apple blue stays the same in both modes (system blue is theme-stable).
export const buttonSecondary =
  "rounded-lg bg-[#0071e3] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-[#0071e3]/30";

export const buttonOutline =
  "rounded-lg bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-200 ring-1 ring-inset ring-neutral-200 dark:ring-neutral-700 transition hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:text-neutral-400 dark:disabled:text-neutral-600";
