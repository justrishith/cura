"use client";

// C3 — the 96px mic orb, hero of the patient console (design.md §4-C3).
// Pure presentation: no Web Speech logic; onToggle/onSwitchToText come from the parent.
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
  idle: "bg-teal-50 text-teal-600",
  listening: "bg-teal-600 text-white",
  thinking: "bg-white text-teal-600",
  speaking: "bg-teal-50 text-teal-600",
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
            className={`w-1.5 animate-pulse motion-reduce:animate-none rounded-full bg-teal-600 ${height} ${BAR_DELAYS[i]}`}
          />
        ))}
      </span>
    );
  }
  return <Mic aria-hidden="true" className="h-8 w-8" />;
}

function SwitchToText({ onSwitchToText }: { onSwitchToText?: () => void }) {
  const linkClasses = "font-semibold text-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2";
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
        className="group relative h-24 w-24 rounded-full transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2"
      >
        {state === "listening" && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full bg-teal-600/30 animate-ping motion-reduce:animate-none motion-reduce:bg-transparent motion-reduce:ring-4 motion-reduce:ring-teal-200"
          />
        )}
        <span
          className={`relative flex h-full w-full items-center justify-center rounded-full ${ORB_STYLES[state]} ${state === "thinking" ? "border border-slate-200" : ""}`}
        >
          <OrbFace state={state} />
        </span>
        {state === "listening" && (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 h-3 w-3 rounded-full bg-red-600"
          />
        )}
      </button>
      <p data-testid="mic-orb-caption" className="mt-3 text-sm text-slate-500">
        {CAPTIONS[state]}
      </p>
      <p className="mt-1 text-sm text-slate-400">
        Prefer typing? <SwitchToText onSwitchToText={onSwitchToText} />
      </p>
    </div>
  );
}

export default MicOrb;
