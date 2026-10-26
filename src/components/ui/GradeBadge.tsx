// C2 — grade pill. Earth-toned semantics: low=moss, medium=dried-grass amber,
// high=fired-clay red, crisis=solid fired clay. Server-safe.
import type { Grade } from "@/lib/types";

const BADGE_STYLES: Record<Grade, string> = {
  low: "bg-oksoft text-ok",
  medium: "bg-warnsoft text-warn",
  high: "bg-dangersoft text-danger",
  crisis: "bg-danger text-paper",
};

const DOT_STYLES: Record<Grade, string> = {
  low: "bg-ok",
  medium: "bg-warn",
  high: "bg-danger",
  // Dot on the filled crisis pill is paper so it stays visible.
  crisis: "bg-paper",
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
      ? "animate-pulse motion-reduce:animate-none motion-reduce:ring-2 motion-reduce:ring-paper/70 motion-reduce:ring-offset-2 motion-reduce:ring-offset-danger"
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
