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
  open: "bg-paper border border-hairline text-ink hover:border-moss hover:text-moss",
  selected: "bg-moss border border-moss text-paper font-semibold",
  booked: "bg-oksoft border border-ok/40 text-ok font-medium",
  full: "bg-muted border border-hairline text-inkmuted/60 line-through",
};

export function SlotChip({ label, state, onSelect }: SlotChipProps) {
  const clickable = onSelect != null && (state === "open" || state === "selected");
  const className = `r-ctl inline-flex min-h-12 items-center gap-1.5 px-4 text-sm transition-[background-color,border-color,transform] duration-[240ms] ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none ${STYLES[state]} ${clickable ? "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2" : ""}`;

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
