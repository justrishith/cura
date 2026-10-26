export type HealthTipKind = "movement" | "hydration" | "light" | "rest";

export interface HealthTip {
  id: string;
  kind: HealthTipKind;
  /** The FULL patient-facing sentence. Never composed by the model. */
  phrase: string;
}

/**
 * The fixed list of safe health tips.
 * 3 per kind × 4 kinds = 12 total suggestions.
 */
export const HEALTH_TIPS: HealthTip[] = [
  // movement
  { id: "walk_mailbox", kind: "movement", phrase: "Let's go on a short walk today, Maria — just to the mailbox and back if you feel up for it?" },
  { id: "stretch_window", kind: "movement", phrase: "While you're up, a gentle stretch by the window for a minute can do your joints good." },
  { id: "stairs_one", kind: "movement", phrase: "If you're feeling steady, one slow trip up the stairs and back is a nice little boost." },
  // hydration
  { id: "water_glass", kind: "hydration", phrase: "A cool glass of water right now might be just what you need." },
  { id: "sip_herbal", kind: "hydration", phrase: "How about a warm cup of herbal tea — a quiet moment and a sip to settle you." },
  { id: "morning_glass", kind: "hydration", phrase: "Start the morning with a tall glass of water before anything else — it wakes up the body nicely." },
  // light
  { id: "sunbeam", kind: "light", phrase: "Let the morning light in — sit by a window for a few minutes with a book or your tea." },
  { id: "step_outside", kind: "light", phrase: "Step outside for five minutes of daylight; even a breeze on the porch helps the mood." },
  { id: "open_curtains", kind: "light", phrase: "Pull the curtains wide and let the sun fill the room — light lifts the spirit." },
  // rest
  { id: "rest_20", kind: "rest", phrase: "Take a 20-minute rest with your feet up; you've earned it today." },
  { id: "nap_porch", kind: "rest", phrase: "A short nap in the afternoon — say until the kettle whistles — can be a sweet reset." },
  { id: "evening_still", kind: "rest", phrase: "Settle in early tonight with a soft blanket and quiet music — gentle rest is good medicine." },
];

/** Look up the fixed phrase for a given kind. Picks the first matching tip (deterministic). */
export function tipPhraseFor(kind: HealthTipKind): string | undefined {
  return HEALTH_TIPS.find((t) => t.kind === kind)?.phrase;
}