// C4 — transcript bubbles + feed container (design.md §4-C4). Server-safe.
export type TranscriptRole = "cura" | "patient";

export interface TranscriptBubbleProps {
  role: TranscriptRole;
  text: string;
  /** Rendered only when provided, tiny slate-400 under the bubble. */
  timestamp?: string;
}

const BUBBLE_STYLES: Record<TranscriptRole, string> = {
  patient: "self-end rounded-br-md bg-white border border-slate-200 text-slate-900",
  cura: "self-start rounded-bl-md bg-teal-50 border border-teal-100 text-slate-900",
};

export function TranscriptBubble({ role, text, timestamp }: TranscriptBubbleProps) {
  return (
    <div
      data-testid={`transcript-${role}`}
      className={`flex max-w-[80ch] flex-col ${role === "patient" ? "items-end" : "items-start"}`}
    >
      <p className={`max-w-[80ch] rounded-2xl px-4 py-2.5 text-base leading-relaxed ${BUBBLE_STYLES[role]}`}>
        {text}
      </p>
      {timestamp && <p className="mt-0.5 text-xs text-slate-400">{timestamp}</p>}
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
