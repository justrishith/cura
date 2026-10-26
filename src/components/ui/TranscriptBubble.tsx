// C4 — transcript bubbles + feed container (design.md §4-C4). Server-safe.
// Organic dressing: Cura's turns sit on the deep moss field (light text),
// the patient's turns on pale paper sheets with a hairline edge.
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
  return (
    <div
      data-testid={`transcript-${role}`}
      className={`flex max-w-[80ch] flex-col ${role === "patient" ? "items-end" : "items-start"}`}
    >
      <p
        className={`max-w-[80ch] a-drop px-4 py-2.5 text-base leading-relaxed ${BUBBLE_STYLES[role]}`}
      >
        {text}
      </p>
      {timestamp && <p className="mt-0.5 text-xs text-inkmuted/70">{timestamp}</p>}
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
