// C1 — brand lockup: the cura bird + wordmark (lowercase "cura" + clay period).
import { CuraBird } from "./CuraBird";

export function CuraMark({ className = "" }: { className?: string }) {
  return (
    <span
      data-testid="cura-mark"
      className={`inline-flex items-center gap-1.5 select-none ${className}`}
    >
      <CuraBird className="h-6 w-6 shrink-0" />
      <span className="font-display text-xl font-semibold tracking-tight text-ink">
        cura<span className="text-clay">.</span>
      </span>
    </span>
  );
}

export default CuraMark;
