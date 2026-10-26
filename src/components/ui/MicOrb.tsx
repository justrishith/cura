"use client";

// C3 — the mic orb, hero of the patient console (design.md §4-C3).
// Organic silhouette (.r-blob-c) instead of a perfect circle; moss fill when
// live. Pure presentation: no Web Speech logic; onToggle/onSwitchToText come
// from the parent.
import { Loader2, Mic } from "lucide-react";

export type MicOrbState = "idle" | "listening" | "thinking" | "speaking";

const CAPTIONS: Record<MicOrbState, string> = {
  idle: "Tap to talk",
  listening: "Listening… (tap to stop)",
  thinking: "Cura is reading your note…",
  speaking: "Cura speaking…",
};

const ARIA_LABELS: Record<MicOrbState, string> = {
  idle: "Start voice check-in",
  listening: "Stop voice check-in",
  thinking: "Cura is reading your note — please wait",
  speaking: "Cura is speaking — tap to interrupt",
};

const ORB_STYLES: Record<MicOrbState, string> = {
  idle: "bg-paper text-moss",
  listening: "bg-moss text-paper",
  thinking: "bg-paper text-clay",
  speaking: "bg-grass/50 text-ink",
};

const BAR_CLASSES = ["h-3", "h-6", "h-4", "h-5"];
const BAR_DELAYS = [
  "[animation-delay:0ms]",
  "[animation-delay:150ms]",
  "[animation-delay:300ms]",
  "[animation-delay:450ms]",
];

function OrbFace({ state }: { state: MicOrbState }) {
  if (state === "thinking") {
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin motion-reduce:animate-none" />;
  }
  if (state === "speaking") {
    return (
      <span aria-hidden="true" className="flex h-8 items-center gap-1">
        {BAR_CLASSES.map((height, i) => (
          <span
            key={i}
            className={`w-1.5 animate-pulse motion-reduce:animate-none rounded-full bg-clay ${height} ${BAR_DELAYS[i]}`}
          />
        ))}
      </span>
    );
  }
  return <Mic aria-hidden="true" className="h-8 w-8" />;
}

function SwitchToText({ onSwitchToText }: { onSwitchToText?: () => void }) {
  const linkClasses =
    "font-semibold text-clay underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2";
  if (!onSwitchToText) {
    return <span className={linkClasses}>Switch to text</span>;
  }
  return (
    <button type="button" onClick={onSwitchToText} className={linkClasses}>
      Switch to text
    </button>
  );
}

export function MicOrb({
  state,
  onToggle,
  onSwitchToText,
}: {
  state: MicOrbState;
  onToggle?: () => void;
  onSwitchToText?: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onToggle}
        aria-label={ARIA_LABELS[state]}
        data-testid={`mic-orb-${state}`}
        className="r-blob-c a-orb-in group relative h-28 w-28 transition-colors duration-[240ms] ease-out hover:brightness-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-sand"
      >
        {state === "listening" && (
          <>
            <span
              aria-hidden="true"
              className="a-ripple r-blob-c absolute inset-0 border-[3px] border-moss motion-reduce:hidden"
            />
            <span
              aria-hidden="true"
              className="a-ripple r-blob-c absolute inset-0 border-[3px] border-moss/60 motion-reduce:hidden"
              style={{ animationDelay: "650ms" }}
            />
          </>
        )}
        <span
          className={`r-blob-c relative flex h-full w-full items-center justify-center border border-hairline transition-[background-color] duration-[240ms] ease-out ${ORB_STYLES[state]} ${
            state === "idle" ? "a-breathe" : ""
          } ${state === "thinking" ? "a-wobble" : ""}`}
        >
          <OrbFace state={state} />
        </span>
        {state === "listening" && (
          <span
            aria-hidden="true"
            className="absolute right-2 top-3 h-3 w-3 rounded-full bg-danger"
          />
        )}
      </button>
      <p data-testid="mic-orb-caption" className="mt-3 text-sm text-inkmuted">
        {CAPTIONS[state]}
      </p>
      <p className="mt-1 text-sm text-inkmuted/70">
        Prefer typing? <SwitchToText onSwitchToText={onSwitchToText} />
      </p>
    </div>
  );
}

export default MicOrb;
