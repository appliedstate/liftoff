// Shared design tokens for the Liftoff UI.
//
// Framer-inspired: borderless fields, soft fills, hairline rings on cards,
// Apple accent palette (#0071e3 blue, #34c759 green, #ff9500 orange,
// #ff3b30 red), 12px (rounded-xl) on cards / 8px (rounded-lg) on fields
// and buttons.
//
// Import from any page that wants the same look — a tweak here ripples
// to every consumer.

export const inputClass =
  "w-full rounded-lg bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 hover:bg-neutral-200/60 focus:bg-white focus:ring-2 focus:ring-[#0071e3]";

export const selectClass = inputClass;

export const cardClass =
  "rounded-xl bg-white ring-1 ring-black/5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_32px_-16px_rgba(0,0,0,0.10)]";

export const subCardClass = "rounded-xl bg-neutral-50/80 ring-1 ring-black/[0.04]";

export const sectionLabel = "text-lg font-semibold text-neutral-900";

export const fieldLabel = "mb-1.5 block text-[13px] font-semibold text-neutral-900";

export const pillClass =
  "inline-flex items-center rounded-full bg-[#0071e3]/[0.06] px-2.5 py-1 text-xs font-semibold text-[#0071e3]";

export const buttonGhost =
  "rounded-lg bg-neutral-100 px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-200";

export const buttonPrimary =
  "rounded-lg bg-neutral-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300";

export const buttonSecondary =
  "rounded-lg bg-[#0071e3] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-[#0071e3]/30";

export const buttonOutline =
  "rounded-lg bg-white px-3 py-2 text-xs font-semibold text-neutral-700 ring-1 ring-inset ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:text-neutral-400";
