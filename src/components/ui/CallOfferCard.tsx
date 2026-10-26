"use client";

// C7 escalation card — the consent-gated offer → live call → booked confirmation
// loop (design.md §4-C7). Client component: the parent owns the call state machine.
import { CheckCircle2, Phone } from "lucide-react";

export type CallOfferCardProps =
  | { phase: "offer"; provider: string; onCallNow: () => void; onNotNow: () => void }
  | { phase: "in-progress"; provider: string; elapsedSeconds: number }
  | { phase: "booked"; provider: string; slotText: string };

const BUTTON_BASE =
  "min-h-12 inline-flex items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2";

function elapsedLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function CallOfferCard(props: CallOfferCardProps) {
  if (props.phase === "offer") {
    return (
      <div
        data-testid="call-offer-card-offer"
        className="rounded-2xl border border-slate-200 bg-white p-4"
      >
        <p className="text-base font-semibold text-slate-900">
          This needs a doctor's eyes. Want me to call {props.provider} now?
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={props.onCallNow}
            data-testid="call-offer-call-now"
            className={`${BUTTON_BASE} bg-teal-600 text-white hover:bg-teal-700`}
          >
            <Phone aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            Call now
          </button>
          <button
            type="button"
            onClick={props.onNotNow}
            data-testid="call-offer-not-now"
            className={`${BUTTON_BASE} border border-slate-200 bg-white text-slate-600 hover:bg-slate-50`}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (props.phase === "in-progress") {
    // Pulsing green dot; prefers-reduced-motion gets a static ring instead.
    return (
      <div
        data-testid="call-offer-card-in-progress"
        className="rounded-2xl border border-slate-200 bg-white p-4"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-green-600 animate-pulse motion-reduce:animate-none motion-reduce:ring-4 motion-reduce:ring-green-200"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
              <Phone aria-hidden="true" className="h-4 w-4 text-green-600" strokeWidth={1.5} />
              Calling {props.provider}…
            </p>
            <p className="text-xs text-slate-500">Elapsed {elapsedLabel(props.elapsedSeconds)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="call-offer-card-booked"
      className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4"
    >
      <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-green-600" strokeWidth={1.5} />
      <p className="text-sm font-medium text-green-600">
        Booked — {props.provider} · {props.slotText}
      </p>
    </div>
  );
}

export default CallOfferCard;
