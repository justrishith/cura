// Dashboard primitive — the caregiver's at-a-glance person card (design.md §4).
// Server-safe.
import type { Grade } from "@/lib/types";
import { GradeBadge } from "./GradeBadge";

export interface StatusHeroProps {
  name: string;
  age?: number;
  /** Display label for the most recent check-in, e.g. "09:32". */
  lastCheckInLabel: string;
  grade: Grade;
  /** One-line spoken summary from the last check-in. */
  summary: string;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function StatusHero({ name, age, lastCheckInLabel, grade, summary }: StatusHeroProps) {
  const initials = initialsOf(name);
  return (
    <section data-testid="status-hero" className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-teal-50 text-lg font-bold text-teal-600"
        >
          {initials || "?"}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {name}
              {age !== undefined && `, ${age}`}
            </h2>
            <GradeBadge grade={grade} />
          </div>
          <p className="mt-0.5 text-sm text-slate-500">Last check-in {lastCheckInLabel}</p>
        </div>
      </div>
      {summary && <p className="mt-4 text-base text-slate-500">{summary}</p>}
    </section>
  );
}

export default StatusHero;
