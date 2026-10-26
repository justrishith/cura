# design.md — Cura Design System
> Source of truth for UI. This file supersedes `UI.md`. Drop at project root with the other five docs.

Cura — "Care between visits."
A voice-first AI care companion: daily check-ins in the browser; when a check-in grades
serious, Cura makes the phone calls the patient can't — booking the doctor's appointment
(or escalating urgent care) while the caregiver watches it all live.

---

## 1. Design direction: "The human check-in"

Three surfaces, three temperatures:

| Surface | Feel | Density |
|---|---|---|
| **Patient console** | Warm, calm, voice-first — a conversation, not an app | Low; one column; type ≥ 20px |
| **Caregiver dashboard** | Quiet confidence; information-rich but never loud | Medium; 2 columns desktop |
| **Call console** | Live "mission control": status-forward, receipts-first | Medium; widest surface |

One idea carries everything: **the interface is the conversation.** Action cards
(agent receipts) are the signature move — they make "agentic" visible.

## 2. Tokens

### Colors
| Token | Value | Use |
|---|---|---|
| `surface` | `#F8FAFC` slate-50 | page background |
| `card` | `#FFFFFF` | cards, sheets |
| `ink` | `#0F172A` slate-900 | body text |
| `muted` | `#64748B` slate-500 | secondary text |
| `line` | `#E2E8F0` slate-200 | borders (1px only) |
| `primary` | `#0D9488` teal-600 | CTAs, active, Cura's voice bubble tint |
| `primary-deep` | `#0F766E` teal-700 | hover |
| `primary-soft` | `#F0FDFA` teal-50 | orb idle, Cura bubbles, highlights |
| `warn` | `#D97706` amber-600 | grade MEDIUM |
| `warn-soft` | `#FFFBEB` amber-50 | medium badge bg |
| `danger` | `#DC2626` red-600 | grade HIGH/CRISIS, crisis banner |
| `danger-soft` | `#FEF2F2` red-50 | high badge bg |
| `calm` | `#16A34A` green-600 | grade LOW, success receipts |
| `calm-soft` | `#F0FDF4` green-50 | low badge bg |

No gradients, no glassmorphism, no dark mode. Flat color + one shadow value only:
`0 1px 2px rgba(15,23,42,0.08)`.

### Typography
- Font: **Inter** via `next/font` (mockup falls back to system sans).
- Scale (px): 14 · 16 (base) · 20 (patient console base) · 24 · 32 · 48.
- Headers: `font-bold tracking-tight`, sentence case. No all-caps except tiny badges.
- Patient-facing copy: plain English, ~8th grade, no medical jargon.

### Grid, radius, motion
- 4-pt spacing grid; section rhythm 24/32px.
- Radius: `rounded-2xl` cards · `rounded-full` pills/orb/input.
- Motion tokens: card slide-in `200ms ease-out`; orb pulse only while listening;
  **`prefers-reduced-motion` → all pulse/ping becomes static rings** (hard rule).
- Icons: emoji in mockup, **lucide-react** in production. Line weight 1.5.

## 3. Grade system
| Grade | Badge | Dot |
|---|---|---|
| LOW | green-50 bg / green-600 text | `calm` |
| MEDIUM | amber-50 bg / amber-600 text | `warn` |
| HIGH | red-50 bg / red-600 text | `danger` |
| CRISIS | red-600 bg / white text + pulsing dot | `danger` |
CRISIS additionally takes over the screen (sticky banner, §4-C6).

## 4. Components (the 8 + 5 dashboard primitives)

**C1 `CuraMark`** — lowercase "cura" + teal period. `text-xl font-bold tracking-tight`,
period `text-teal-600`. Never lock into long taglines.

**C2 `GradeBadge`** — dot (6px) + label pill per §3 table (sm `text-xs`, md `text-sm`).

**C3 `MicOrb`** — 96px circle, the hero.
- `idle`: teal-50 bg, teal-600 mic icon, caption "Tap to talk".
- `listening`: teal-600 bg, white icon, `animate-ping` halo + red recording dot,
  caption "Listening… (tap to stop)".
- `thinking`: white bg, teal spinner, caption "Cura is reading your note…".
- `speaking`: teal-50, rhythmic bars, caption "Cura speaking…".
- Below orb, always: "Prefer typing? **Switch to text**" (link swaps transcript to text-input).
- Hard rules: ≥48px hit target, `aria-label` per state, keyboard Space = same as tap.

**C4 `TranscriptBubble`** — max-width 80ch.
- Patient: `bg-white border border-slate-200`, right-aligned.
- Cura: `bg-teal-50 border border-teal-100`, left-aligned.
- Timestamp row `text-xs text-slate-400` under each pair; container has `aria-live="polite"`.

**C5 `ActionCard`** — the agentic receipt. `bg-white border border-slate-200 border-l-4 rounded-xl p-4`;
left border color by tool: `log_symptom` teal · `request_refill` amber · `book_appointment`
green · `notify_caregiver` red(urgent)/slate(info) · `crisis_alert` red.
Anatomy: icon chip (lucide, 18px) + human title ("Refill requested — Metformin") + status
pill (`succeeded ✅ / scheduled ⏳ / failed ⚠️`) + tool tag `text-xs text-slate-400` + time.
Enters with 200ms slide-in as the agent fires it — live, not retroactive.

**C6 `CrisisBanner`** — sticky top, full width, `bg-red-600 text-white`.
Text: "Your note says this is urgent. **Call 911 now** — your caregiver has been alerted."
+ white button `Call 911` (`tel:911`). Not dismissible; the check-in ending in a
resolved state clears it. The **agent never auto-dials 911** — humans press the button.

**C7 `CallStrip` / `CallOfferCard`** — the escalation pair.
- Offer: white card, "This needs a doctor's eyes. Want me to call Dr. Chen's office now?"
  + [Call now] primary / [Not now] ghost.
- Consent → becomes status strip: pulsing green dot, "📞 Calling Dr. Chen's office — 00:14 …",
  ends as a green confirmation card ("Booked — Dr. Chen · Tue 10:00 AM").
- Crisis variant text: "Calling your caregiver's line now."

**C8 `SlotChip`** — slot in the call console: date/time pill; states open / selected /
booked (green check) / full (strikethrough).

Dashboard primitives:
- **`StatusHero`** — avatar circle (initials), name/age, last check-in time, `GradeBadge`,
  one-line spoken summary.
- **`AlertRow`** — level chip + message + [Got it] ghost ack button; unread = teal dot.
- **`CheckInRow`** — time, `GradeBadge`, symptom tags, nested ActionCards (muted).
- **`MedCard`** — name, dosage, refill chip (`ok` green / `requested` amber / `ordered` green).
- **`CallLogRow`** — direction arrow, destination, duration, outcome chip (booked ✅ / no-booking ⚠️).

## 5. Screens

### S1 Landing `/`
```
──────────────────────────────────────────────
cura.                       [Demo — not medical advice]
        Care between visits.
  Cura checks in by voice every day. When something's
  off, it makes the phone calls that matter — booking
     the doctor's appointment while family watches.
        [ Start my check-in → ]  [ I'm the caregiver ]
──────────────────────────────────────────────
   🎙️ Talk for 60 sec      📞 Cura calls the doctor      ✅ Booked & logged
   plain-language check-in   office on your behalf        your family sees it live
──────────────────────────────────────────────
```
Max-w-xl centered, generous py. CTAs are the only heavy elements.

### S2 Patient console `/patient`  (mobile-first, max-w-xl)
```
──────────────────────────────────────────────
cura.   ·                       [ HIGH ]  (badge)
              ⓘ Cura is calling Dr. Chen's office…

                  ( ( MicOrb listening ) )
                    "Listening… tap to stop"

        │ ┌─ you ───────────────────┐   (white, right)
        │ │ Dizzy since yesterday…  │
        │ ┌─ cura ────────────────┐    (teal-50, left)
        │ │ Noted. And your pills?│
        └─────────────────────────────┘
   [📎 relay_summary ✅] [💊 refill requested ⏳]
   [📅 booked Tue 10:00 ✅]        (ActionRail, newest first)
   ────────────────────────────────────────────────
   Prefer typing?  [ input ─────────────── ] [Send]
──────────────────────────────────────────────
```
Under the CallStrip the transcript keeps moving — the showpiece: conversation and
receipts at once.

### S3 Caregiver dashboard `/caregiver` (max-w-5xl, 2-col desktop / stacked mobile)
```
┌──────────────┬───────────────────────────────┐
│ StatusHero   │ [ Timeline · Meds · Calls ]   │
│ (M) Maria 72 │  Today 09:32  HIGH  …receipts │
│ last: 09:32  │  call: booked Tue 10:00 ✅    │
│ Summary line │                               │
├──────────────┤                               │
│ ALERTS (1!)  │                               │
│ • dizziness  │                               │
│   [Got it]   │                               │
└──────────────┴───────────────────────────────┘
```
Header: cura. + live linker chip "Demo — not medical advice". Polls 15s.

### S4 Call console `/call` (receptionist-facing… your two-actor stage; max-w-3xl)
```
──────────────────────────────────────────────
● In call — 00:47    Dr. Chen's office, Sunnyvale    [End call]
──────────────────────────────────────────────
[ cura ] Hi — I'm Cura, an assistant calling on behalf of Maria, 72.
[ you  ] Dr. Chen's office, how can I help?
[ cura ] She's had dizziness for two days and is out of Metformin.
        What's your earliest Tuesday morning?
      [Tue 10:00 ✅booked] [Tue 14:30 open] [Wed 9:00 open]
   [📎 relay_patient_summary ✅] [🔎 check_open_slots ✅]
   [📅 book_appointment ✅ Tue 10:00]
──────────────────────────────────────────────
```
Cura speaks over the phone; this screen mirrors the call. Styling identical to S2 but
staff-tone copy (§8). Crisis variant: red header, scripted line, `crisis_alert` + call
to caregiver line receipt.

### S5 Summary `/summary` (print sheet; max-w-3xl white card)
Plain printable: header (patient + generated-at), check-ins table
(time · grade · symptoms · actions), meds with refill chips, calls log incl.
"Outbound call — Dr. Chen's office — 2m04s — outcome: booked". `[Print]` →
`window.print()`. Ink-on-white, minimal color, LHS border only on grade chips.

## 6. State machines (wire the orb + strip by these)

```
Check-in:  idle → listening → thinking → speaking → idle
                        ↓ (crisis keywords)
                     CRISIS (banner; agent ≠ dials; human taps 911)
Call:      offer → consent → dialing → in-call → outcome(booked | no-booking | failed)
Tools loop: ≤3 iterations; every fired tool = one ActionCard, immediately.
```

## 7. Demo routing — ROUTE_ALL_TO_ME (shoot mode)
Env `ROUTE_ALL_TO_ME=1`: every agent-initiated call — doctor booking AND crisis-tier —
dials the **demo operator's verified cell**, with the on-dial persona label kept in the
call log ("clinic"/"caregiver"). The phone plays the actor. Real (non-demo) households:
the agent dials the clinic phone number stored on the household. **The 911 button stays
human-press only — the agent never dials emergency services.**

## 8. Copy rules & sample lines
- Patient tone: plain, warm, short ("Come in for a visit", never "schedule a consultative encounter").
- Staff tone (on calls): concise, professional, never claims to be human, leads with identity + patient + urgency + the ask.
- Crisis script is **fixed text** (deterministic, no LLM improvisation):
  "I'm concerned about this. Please don't wait. Your caregiver has an alert —
   and if you feel worse, call emergency services right now."

| Situation | Line |
|---|---|
| Opening | "Hi Maria, it's Cura. Quick check-in today — how did you sleep?" |
| Symptom logged | "Got it — dizziness logged." |
| Escalation offer | "This needs a doctor's eyes. Want me to call Dr. Chen's office now?" |
| Grade MEDIUM done | "I'll keep watching this. Drink water and rest — I'll check in tomorrow." |
| Staff opener | "Hi — I'm Cura, an automated assistant calling on behalf of Maria, 72." |
| Booked close | "Confirmed — Tuesday 10:00 AM. She'll get a reminder card. Thank you!" |

## 9. Accessibility contract (hard)
- Contrast ≥ 4.5:1 for all text (test `muted` on `surface`; fail → slate-400 raise).
- Focus ring: `ring-2 ring-teal-400 ring-offset-2` visible on every interactive element.
- `aria-live="polite"` on transcript; `aria-label` on orb per state; ≥48px targets.
- `prefers-reduced-motion`: kill pulse/ping, keep static rings.

## 10. Production notes
- Tailwind carries all tokens (extend theme colors to the names above).
- Components live `src/components/ui/*` + `patient/*` + `caregiver/*` per ARCHITECTURE.md.
- Static mockup `cura-ui-mockup.html` is reference-only — rebuild in JSX, don't port hacks
  (emoji → lucide, tab-switcher → routes, print stylesheet → /summary route).
