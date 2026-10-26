"use client";

// C7 escalation card — the consent-gated offer → live call → booked confirmation
// loop (design.md §4-C7). Client component: the parent owns the call state machine.
// Organic dressing mirrors CallStrip: serif question on paper, moss action.
import { CheckCircle2, Phone } from "lucide-react";

export type CallOfferCardProps =
  | { phase: "offer"; provider: string; onCallNow: () => void; onNotNow: () => void }
  | { phase: "in-progress"; provider: string; elapsedSeconds: number }
  | { phase: "booked"; provider: string; slotText: string };

const BUTTON_BASE =
  "r-ctl min-h-12 inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold transition-[background-color,transform] duration-[240ms] ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2";

function elapsedLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function CallOfferCard(props: CallOfferCardProps) {
  if (props.phase === "offer") {
    return (
      <div
        data-testid="call-offer-card-offer"
        className="r-sheet border border-hairline bg-paper p-5"
      >
        <p className="font-display text-lg font-medium leading-snug text-ink">
          This needs a doctor&apos;s eyes. Want me to call {props.provider} now?
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={props.onCallNow}
            data-testid="call-offer-call-now"
            className={`${BUTTON_BASE} bg-moss text-paper hover:bg-mosshover`}
          >
            <Phone aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
            Call now
          </button>
          <button
            type="button"
            onClick={props.onNotNow}
            data-testid="call-offer-not-now"
            className={`${BUTTON_BASE} border border-hairline bg-paper text-inkmuted hover:bg-muted`}
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  if (props.phase === "in-progress") {
    // Pulsing ok dot; prefers-reduced-motion gets a static ring instead.
    return (
      <div
        data-testid="call-offer-card-in-progress"
        className="r-sheet border border-hairline bg-paper p-4"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 rounded-full bg-ok animate-pulse motion-reduce:animate-none motion-reduce:ring-4 motion-reduce:ring-oksoft"
          />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
              <Phone aria-hidden="true" className="h-4 w-4 text-ok" strokeWidth={1.5} />
              Calling {props.provider}…
            </p>
            <p className="text-xs text-inkmuted/70">Elapsed {elapsedLabel(props.elapsedSeconds)}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="call-offer-card-booked"
      className="r-panel flex items-center gap-3 border border-ok/30 bg-oksoft p-4"
    >
      <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-ok" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ok">
        Booked — {props.provider} · {props.slotText}
      </p>
    </div>
  );
}

export default CallOfferCard;
