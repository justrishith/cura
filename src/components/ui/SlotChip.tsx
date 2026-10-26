"use client";

// C8 — date/time slot pill (design.md §4-C8). Interactive when open or selected.
import { Check } from "lucide-react";

export type SlotChipState = "open" | "selected" | "booked" | "full";

export interface SlotChipProps {
  /** Display label, e.g. "Tue 10:00 AM". */
  label: string;
  state: SlotChipState;
  onSelect?: () => void;
}

const STYLES: Record<SlotChipState, string> = {
  open: "bg-white border border-slate-200 text-slate-700 hover:border-teal-600 hover:text-teal-700",
  selected: "bg-teal-600 border border-teal-600 text-white font-semibold",
  booked: "bg-green-50 border border-green-200 text-green-700 font-medium",
  full: "bg-slate-50 border border-slate-200 text-slate-400 line-through",
};

export function SlotChip({ label, state, onSelect }: SlotChipProps) {
  const clickable = onSelect != null && (state === "open" || state === "selected");
  const className = `inline-flex min-h-12 items-center gap-1.5 rounded-full px-4 text-sm transition-colors duration-200 ease-out ${STYLES[state]} ${clickable ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2" : ""}`;

  if (!clickable) {
    return (
      <span data-testid={`slot-chip-${state}`} className={className} aria-disabled>
        {label}
        {state === "booked" && <Check aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`slot-chip-${state}`}
      className={className}
    >
      {label}
    </button>
  );
}

export default SlotChip;
