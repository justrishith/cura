// Dashboard primitive — one past check-in row: time, grade, symptom tags and the
// receipts fired during it, nested with reduced emphasis (design.md §4). Server-safe.
import type { ActionReceipt, Grade } from "@/lib/types";
import { ActionCard } from "./ActionCard";
import { GradeBadge } from "./GradeBadge";

export interface CheckInRowProps {
  /** Display label, e.g. "09:32". */
  timeLabel: string;
  grade: Grade;
  /** Short symptom phrases shown as chips. */
  symptomTags: string[];
  /** Tool receipts fired during this check-in, rendered reduced-emphasis. */
  receipts?: ActionReceipt[];
}

export function CheckInRow({ timeLabel, grade, symptomTags, receipts = [] }: CheckInRowProps) {
  return (
    <section data-testid="checkin-row" className="border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">{timeLabel}</span>
        <GradeBadge grade={grade} />
        {symptomTags.map((tag) => (
          <span
            key={tag}
            data-testid="checkin-row-symptom-tag"
            className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600"
          >
            {tag}
          </span>
        ))}
      </div>
      {receipts.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {receipts.map((receipt) => (
            <ActionCard key={receipt.id} receipt={receipt} muted />
          ))}
        </div>
      )}
    </section>
  );
}

export default CheckInRow;
