"use client";

// C7 — escalation pair: offer card → live strip → done card (design.md §4-C7).
import { CheckCircle2, Phone } from "lucide-react";
import type { CallOffer } from "@/lib/types";

export type CallStripProps =
  | { mode: "offer"; offer: CallOffer; onCallNow?: () => void; onDismiss?: () => void }
  | { mode: "live"; provider: string; elapsedSeconds: number }
  | { mode: "done"; message: string };

function elapsedLabel(elapsedSeconds: number) {
  const total = Math.max(0, Math.floor(elapsedSeconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

const BUTTON_BASE =
  "min-h-12 inline-flex items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2";
const PRIMARY = `${BUTTON_BASE} bg-teal-600 text-white hover:bg-teal-700`;
const GHOST = `${BUTTON_BASE} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`;

export function CallStrip(props: CallStripProps) {
  if (props.mode === "offer") {
    const { offer, onCallNow, onDismiss } = props;
    return (
      <div
        data-testid="call-strip-offer"
        className="rounded-2xl border border-slate-200 bg-white p-4"
      >
        <p className="text-base font-semibold text-slate-900">
          This needs a doctor&apos;s eyes. Want me to call {offer.provider} now?
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" onClick={onCallNow} className={PRIMARY}>
            <Phone aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            Call now
          </button>
          <button type="button" onClick={onDismiss} className={GHOST}>
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (props.mode === "live") {
    const { provider, elapsedSeconds } = props;
    return (
      <div
        data-testid="call-strip-live"
        className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3"
      >
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-500 animate-pulse motion-reduce:animate-none"
        />
        <p className="text-sm font-medium text-green-800">
          <Phone aria-hidden="true" className="mr-1.5 inline h-4 w-4 align-[-2px]" strokeWidth={1.5} />
          Calling {provider} — {elapsedLabel(elapsedSeconds)} …
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="call-strip-done"
      className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3"
    >
      <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-green-600" />
      <p className="text-sm font-medium text-green-800">{props.message}</p>
    </div>
  );
}

export default CallStrip;
