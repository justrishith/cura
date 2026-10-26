"use client";

// OrganicStage — the landing's split-opening form cluster, with life:
// blobs pop in with a bounce stagger, then drift on slow ambient loops;
// the whole cluster parallaxes a few px against the cursor. Static and
// visible under reduced motion. Purely decorative (aria-hidden).
import { useEffect, useRef } from "react";
import { CuraBird } from "./CuraBird";

export function OrganicStage() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      const x = e.clientX / window.innerWidth - 0.5;
      const y = e.clientY / window.innerHeight - 0.5;
      el.style.setProperty("--px", x.toFixed(3));
      el.style.setProperty("--py", y.toFixed(3));
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="relative hidden h-80 md:block will-change-transform"
      style={{ transform: "translate3d(calc(var(--px, 0) * 14px), calc(var(--py, 0) * 10px), 0)" }}
    >
      <span className="a-pop d-1 absolute right-0 top-0 block h-64 w-72">
        <span className="drift-a r-blob-a block h-full w-full bg-moss" />
      </span>
      <span className="a-pop d-2 absolute right-40 top-44 block h-36 w-40">
        <span className="drift-b r-blob-b block h-full w-full bg-terra" />
      </span>
      <span className="a-pop d-3 absolute right-8 top-52 block h-16 w-20">
        <span className="drift-c r-blob-c block h-full w-full bg-grass" />
      </span>
      <span className="a-pop d-3 absolute right-[10.5rem] top-[8rem] block h-14 w-14">
        <span className="a-bob block h-full w-full">
          <CuraBird className="h-full w-full" />
        </span>
      </span>
    </div>
  );
}

export default OrganicStage;
