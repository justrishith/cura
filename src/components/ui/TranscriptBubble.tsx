// C4 — transcript bubbles + feed container (design.md §4-C4). Server-safe.
// Organic dressing: Cura's turns sit on the deep moss field (light text) with
// the CuraBird mascot as her avatar — the bird IS the voice talking — and the
// patient's turns on pale paper sheets with a hairline edge.
import { CuraBird } from "@/components/ui/CuraBird";

export type TranscriptRole = "cura" | "patient";

export interface TranscriptBubbleProps {
  role: TranscriptRole;
  text: string;
  /** Rendered only when provided, tiny muted line under the bubble. */
  timestamp?: string;
}

const BUBBLE_STYLES: Record<TranscriptRole, string> = {
  patient: "self-end r-sheet bg-paper border border-hairline text-ink",
  cura: "self-start r-panel bg-moss text-paper",
};

export function TranscriptBubble({ role, text, timestamp }: TranscriptBubbleProps) {
  const bubble = (
    <p
      aria-label={role === "cura" ? "Cura said" : "You said"}
      className={`max-w-[80ch] a-drop px-4 py-2.5 text-lg leading-relaxed ${BUBBLE_STYLES[role]}`}
    >
      {text}
    </p>
  );
  return (
    <div
      data-testid={`transcript-${role}`}
      className={`flex max-w-[80ch] flex-col ${role === "patient" ? "items-end" : "items-start"}`}
    >
      {role === "cura" ? (
        // The bird talks: avatar rides beside every Cura turn.
        <div className="flex items-start gap-2">
          <CuraBird className="mt-1.5 h-10 w-10 shrink-0" title="Cura" />
          {bubble}
        </div>
      ) : (
        bubble
      )}
      {timestamp && <p className="mt-0.5 text-xs text-inkmuted/70">{timestamp}</p>}
    </div>
  );
}

/** "Cura is thinking…" — bird + animated dots, shown the moment a turn starts. */
export function TranscriptThinking() {
  return (
    <div className="flex items-start gap-2 self-start" data-testid="transcript-thinking" aria-live="polite">
      <CuraBird className="a-chat-bird-thinking mt-1.5 h-10 w-10 shrink-0" title="Cura is thinking" />
      <p
        className="r-panel bg-moss px-4 py-2.5 text-lg leading-relaxed text-paper/95"
        aria-label="Cura is thinking"
      >
        <span aria-hidden="true" className="inline-flex select-none items-center gap-1.5">
          Cura is thinking
          <span className="inline-flex gap-1 pb-1">
            <i className="a-think-dot h-1.5 w-1.5 rounded-full bg-paper" style={{ animationDelay: "0ms" }} />
            <i className="a-think-dot h-1.5 w-1.5 rounded-full bg-paper" style={{ animationDelay: "150ms" }} />
            <i className="a-think-dot h-1.5 w-1.5 rounded-full bg-paper" style={{ animationDelay: "300ms" }} />
          </span>
        </span>
      </p>
    </div>
  );
}

export interface TranscriptFeedProps {
  items: TranscriptBubbleProps[];
}

export function TranscriptFeed({ items }: TranscriptFeedProps) {
  return (
    <div
      aria-live="polite"
      role="log"
      data-testid="transcript-feed"
      className="flex max-w-[80ch] flex-col gap-3"
    >
      {items.map((item, i) => (
        <TranscriptBubble key={i} {...item} />
      ))}
    </div>
  );
}

export default TranscriptBubble;
