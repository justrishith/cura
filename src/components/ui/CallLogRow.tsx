// Dashboard primitive — one row of the caregiver's call log (design.md §4).
// Server-safe.
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

export interface CallLogRowProps {
  direction: "in" | "out";
  /** Destination label, e.g. "Dr. Chen's office". */
  destination: string;
  /** e.g. "2m 04s". */
  durationText?: string | null;
  /** Wall-clock label, e.g. "09:41". */
  timeLabel?: string | null;
  outcome: "booked" | "no-booking";
}

const OUTCOME_STYLES: Record<CallLogRowProps["outcome"], string> = {
  booked: "bg-oksoft text-ok",
  "no-booking": "bg-warnsoft text-warn",
};

const OUTCOME_LABELS: Record<CallLogRowProps["outcome"], string> = {
  booked: "booked ✅",
  "no-booking": "no-booking ⚠️",
};

export function CallLogRow({
  direction,
  destination,
  outcome,
  durationText,
  timeLabel,
}: CallLogRowProps) {
  return (
    <div
      data-testid={`call-log-row-${outcome}`}
      className="flex items-start gap-3 border-t border-hairline py-3"
    >
      {direction === "out" ? (
        <ArrowUpRight
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-moss"
          strokeWidth={1.5}
        />
      ) : (
        <ArrowDownLeft
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-inkmuted"
          strokeWidth={1.5}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{destination}</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${OUTCOME_STYLES[outcome]}`}
          >
            {OUTCOME_LABELS[outcome]}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-inkmuted/70">
          {direction === "out" ? "Outbound" : "Inbound"}
          {durationText ? ` · ${durationText}` : ""}
          {timeLabel ? ` · ${timeLabel}` : ""}
        </p>
      </div>
    </div>
  );
}

export default CallLogRow;
