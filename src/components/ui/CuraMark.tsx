// C1 — wordmark: lowercase "cura" + teal period (design.md §4-C1).
export function CuraMark({ className = "" }: { className?: string }) {
  return (
    <span
      data-testid="cura-mark"
      className={`text-xl font-bold tracking-tight text-slate-900 select-none ${className}`}
    >
      cura<span className="text-teal-600">.</span>
    </span>
  );
}

export default CuraMark;
