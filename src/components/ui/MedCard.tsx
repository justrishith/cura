// Dashboard primitive — one medication with its refill chip (design.md §4).
// Server-safe.
import type { RefillStatus } from "@/lib/types";

export interface MedCardProps {
  name: string;
  dosage?: string | null;
  refillStatus: RefillStatus;
  /** Display label for the last refill, e.g. "May 12"; omit when there is none. */
  lastRefillLabel?: string | null;
}

const REFILL_STYLES: Record<RefillStatus, string> = {
  ok: "bg-green-50 text-green-600",
  requested: "bg-amber-50 text-amber-600",
  ordered: "bg-green-50 text-green-600",
};

const REFILL_LABELS: Record<RefillStatus, string> = {
  ok: "Refill OK",
  requested: "Requested",
  ordered: "Ordered",
};

export function MedCard({ name, dosage, refillStatus, lastRefillLabel }: MedCardProps) {
  return (
    <section
      data-testid={`med-card-${refillStatus}`}
      className="rounded-2xl border border-slate-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-base font-semibold text-slate-900">{name}</p>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${REFILL_STYLES[refillStatus]}`}
        >
          {REFILL_LABELS[refillStatus]}
        </span>
      </div>
      {dosage && <p className="mt-0.5 text-sm text-slate-500">{dosage}</p>}
      {lastRefillLabel && (
        <p className="mt-1 text-xs text-slate-400">Last refill {lastRefillLabel}</p>
      )}
    </section>
  );
}

export default MedCard;
