# UI.md — SUPERSEDED by design.md
> Historical design reference. The live visual contract is `design.md` (tokens,
> components, screens, copy rules, a11y) + `cura-ui-mockup.html` (reference-only mock).
> Below is the original pre-subagent design for provenance. Do not build from this file.

# Cura — Design System & UI Spec (superseded)

## Brand
- Name: **Cura** — tagline "Care between visits."
- Voice persona: warm-neutral, plain English (~8th grade), never diagnoses, routes to a doctor.

## Design tokens
| Token | Value | Use |
|---|---|---|
| `surface` | slate-50 (#F8FAFC) | page bg |
| `card` | white | cards |
| `ink` | slate-900 | body text |
| `primary` | teal-600 (#0D9488) | CTAs, active |
| `warn` | amber-600 | MEDIUM |
| `danger` | red-600 (#DC2626) | HIGH/CRISIS |
| `calm` | green-600 | LOW/success |

Type: Inter via next/font. Landing/dashboard 16–18px; patient console ≥ 20px.
Radius: rounded-2xl cards, rounded-full mic. Shadows subtle; no glassmorphism/gradients.

## Grade → badge
LOW `calm` · MEDIUM `warn` · HIGH `danger` · CRISIS `danger` pulsing.

## Core components
Button, MicButton (idle/listening/thinking/speaking), TranscriptBubble, ActionCard,
CrisisBanner, GradeBadge, MedCard, NotificationRow.

## Screens
1. Landing `/` — value prop + "I'm the patient" / "I'm the caregiver".
2. Patient console `/patient` — mic hero, transcript, action rail, text fallback, call offer.
3. Caregiver dashboard `/caregiver` — status hero, alerts, timeline, meds, call log.
4. Doctor summary `/summary` — print-optimized table + `window.print()`.

## Accessibility
Contrast ≥ 4.5:1; `aria-live="polite"` transcript; aria-labels per mic state; visible
focus rings; `prefers-reduced-motion` respected; targets ≥ 48px; plain sentence-case copy.

## Voice copy — sample lines
- Opening: "Hi Maria — it's Cura. Quick check-in today. How have you been feeling?"
- Update: "Got it — dizzy since yesterday. Noted."
- Escalation offer: "This needs a doctor's eyes, not just notes. Want me to call the office now?"
- Crisis (scripted, fixed): "I'm concerned about this. Please don't wait — if you feel
  worse, call 911 right now. I'm contacting your caregiver immediately."
