"use client";

// C7 — escalation pair: offer card → live strip → done card (design.md §4-C7).
// Organic dressing: serif offer question on a paper sheet; solid moss action;
// quiet outlined alternative.
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
  "r-ctl min-h-12 inline-flex items-center justify-center gap-2 px-5 text-sm font-semibold transition-[background-color,transform] duration-[240ms] ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2";
const PRIMARY = `${BUTTON_BASE} bg-moss text-paper hover:bg-mosshover`;
const GHOST = `${BUTTON_BASE} border border-hairline bg-paper text-inkmuted hover:bg-muted`;

export function CallStrip(props: CallStripProps) {
  if (props.mode === "offer") {
    const { offer, onCallNow, onDismiss } = props;
    return (
      <div
        data-testid="call-strip-offer"
        className="a-drop r-sheet border border-hairline bg-paper p-5"
      >
        <p className="font-display text-lg font-medium leading-snug text-ink">
          This needs a doctor&apos;s eyes. Want me to call {offer.provider} now?
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={onCallNow} className={`${PRIMARY} a-glow motion-reduce:[animation:none]`}>
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
        className="a-drop r-panel flex items-center gap-3 border border-ok/30 bg-oksoft px-4 py-3"
      >
        {/* Mini equalizer — three breathing bars; static under reduced motion. */}
        <span aria-hidden="true" className="flex h-4 shrink-0 items-end gap-0.5">
          {[0, 160, 320].map((delay) => (
            <span
              key={delay}
              className="a-eq motion-reduce:[animation:none] h-full w-1 rounded-full bg-ok"
              style={{ animationDelay: `${delay}ms` }}
            />
          ))}
        </span>
        <p className="text-sm font-medium text-ok">
          Calling {provider} — {elapsedLabel(elapsedSeconds)} …
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="call-strip-done"
      className="a-drop r-panel flex items-center gap-3 border border-ok/30 bg-oksoft px-4 py-3"
    >
      <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-ok" />
      <p className="text-sm font-medium text-ok">{props.message}</p>
    </div>
  );
}

export default CallStrip;
