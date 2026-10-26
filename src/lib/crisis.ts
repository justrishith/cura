// crisis.ts — deterministic crisis pre-screen. ALWAYS runs before any model call.
// Per RULES.md: the LLM never improvises on safety; this file owns the trigger.
// Server-only.

import type { Grade } from "./types";

export interface CrisisMatch {
  matched: true;
  category: string; // e.g. "chest pain", "breathing", "self-harm"
}

/**
 * Keyword/phrase prescreen. Keep generous (false positives route to the script,
 * which is safe); never rely on the model to catch these.
 */
const PATTERNS: { category: string; re: RegExp }[] = [
  { category: "chest pain", re: /\b(chest pain|chest pressure|crushing chest|pain (?:in|from) (?:my )?chest)\b/i },
  { category: "breathing", re: /\b(can'?t breathe|cannot breathe|hard(?:er)? to breathe|struggling to breathe|gasping)\b/i },
  { category: "heart attack", re: /\bheart attack\b/i },
  { category: "stroke signs", re: /\b(face (?:is )?(?:drooping|dropped)|one side (?:is )?numb|arm (?:feels|went) numb|slurred speech|words (?:are )?slurring)\b/i },
  { category: "fainting", re: /\b(?:i )?(?:passed out|fainted|blacked out)\b/i },
  { category: "seizure", re: /\bseizure\b/i },
  { category: "severe bleeding", re: /\b(bleeding (?:a lot|badly|won'?t stop)|won'?t stop bleeding)\b/i },
  { category: "suicidal ideation", re: /\b(kill myself|end (?:my|it) life|want to die|better off dead|suicide)\b/i },
  { category: "self-harm", re: /\b(hurt myself|harm myself)\b/i },
  { category: "safety", re: /\b(don'?t feel safe|scared for my (?:safety|life))\b/i },
];

export function preScreenCrisis(message: string): CrisisMatch | null {
  for (const p of PATTERNS) {
    if (p.re.test(message)) return { matched: true, category: p.category };
  }
  return null;
}

/** Script Cura speaks in-app when the crisis path fires. Fixed, never LLM-generated. */
export const CRISIS_PATIENT_SCRIPT =
  "I'm really concerned about this, and I'm not a doctor, so let's be careful. " +
  "Your caregiver has an alert right now. If this feels worse at any moment, please call " +
  "emergency services yourself — there's a big red button on this screen. " +
  "Does someone live close enough to sit with you?";

/**
 * Script the outbound crisis call says to the emergency contact.
 * Honest framing: caregiver line, not 911; the human decides about 911.
 */
export function crisisCallScript(patientName: string, concern: string): string {
  return (
    `Hello — this is Cura, an automated assistant for ${patientName}'s daily check-ins. ` +
    `This is urgent, not routine. We just graded a check-in as emergency-level for: ${concern}. ` +
    `Please make contact with ${patientName} right now, and consider emergency services if needed. ` +
    `You can also see the full notes on the caregiver dashboard. I'll hang up so you can call her.`
  );
}

/** Grade bump rule: a crisis match overrides any model-proposed grade to this. */
export const CRISIS_GRADE: Grade = "crisis";
