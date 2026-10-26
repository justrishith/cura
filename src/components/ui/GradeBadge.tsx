// C2 — grade pill per design.md §3 grade table. Server-safe.
import type { Grade } from "@/lib/types";

const BADGE_STYLES: Record<Grade, string> = {
  low: "bg-green-50 text-green-600",
  medium: "bg-amber-50 text-amber-600",
  high: "bg-red-50 text-red-600",
  crisis: "bg-red-600 text-white",
};

const DOT_STYLES: Record<Grade, string> = {
  low: "bg-green-600",
  medium: "bg-amber-600",
  high: "bg-red-600",
  // Dot on the filled crisis pill is white so it stays visible.
  crisis: "bg-white",
};

export type GradeBadgeSize = "sm" | "md";

const SIZES: Record<GradeBadgeSize, string> = {
  sm: "text-xs",
  md: "text-sm",
};

export function GradeBadge({ grade, size = "sm" }: { grade: Grade; size?: GradeBadgeSize }) {
  // CRISIS dot pulses; prefers-reduced-motion swaps the pulse for a static ring.
  const crisisDot =
    grade === "crisis"
      ? "animate-pulse motion-reduce:animate-none motion-reduce:ring-2 motion-reduce:ring-white/70 motion-reduce:ring-offset-2 motion-reduce:ring-offset-red-600"
      : "";
  return (
    <span
      data-testid={`grade-badge-${grade}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-bold ${BADGE_STYLES[grade]} ${SIZES[size]}`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[grade]} ${crisisDot}`}
      />
      {grade.toUpperCase()}
    </span>
  );
}

export default GradeBadge;
