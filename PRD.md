# Cura — Product Requirements Document
> "Care between visits." The voice AI that checks in daily — and calls the doctor when it matters.

## One-liner
Cura runs daily voice check-ins with patients at home, **grades** what they say
(low / medium / high / crisis), and **acts on the grade** — logging symptoms, refilling
medications, and when it matters, **making the phone calls for the patient**: calling the
doctor's office to book an appointment, or auto-alerting the emergency contact — all
visible live to the family caregiver.

## One idea, not many apps (product spine)
**Cura talks → grades → acts.** Every feature is a consequence of the grade:
| Grade | The app shows up as… |
|---|---|
| 🟢 LOW | A 60-second daily wellbeing check-in — warm conversation, quiet logging. The app is invisible. |
| 🟡 MEDIUM | Wellbeing + light actions: refill, appointment if wanted. |
| 🔴 HIGH | Agent goes to work: consent-gated clinic booking call. |
| 🆘 CRISIS | Auto-fire (no consent pause): emergency-contact call + patient told to call 911 themselves. |

Grade color (green/amber/red) is the one visual thread across every screen.

## Problem
Older adults managing health at home go days without anyone checking on them. Early signs
of decline — dizziness, new pain, running out of medication — go unreported. Clinics cannot
call every patient daily, and the patients who most need help are the ones least able to
use an app. Family caregivers want visibility but lack it. Result: preventable
deterioration, avoidable readmissions, and the "awkward phone call" falling through cracks.

## Users & roles
| Role | Who | What they do |
|---|---|---|
| Patient | Maria, 72 (demo persona, condition-agnostic) | Daily voice check-in; reviews what Cura did; confirms escalation |
| Caregiver | Family member | Watches dashboard: status, timeline, meds, call log, alerts; acknowledges |
| Phone actors (demo) | The builder's verified cell | Plays "Dr. Chen's office" during booking call; plays "caregiver line" during crisis call. All agent-initiated calls route here by design (ROUTE_ALL_TO_ME). |

## Primary user flows
1. **Daily check-in:** patient console → mic orb (Web Speech voice) or text → Cura
   converses in plain language → grades the check-in → fires tools (live action cards) →
   spoken summary. A calm check-in stays green; a bad one swings red.
2. **Grade → action orchestration (hard-coded map, server-enforced):**
   - LOW → `log_symptom` + monitor + "see you tomorrow"
   - MEDIUM → `log_symptom` + `check_meds`/`request_refill` + optional `book_appointment`
   - HIGH → `log_symptom` + consent-gated **clinic booking call** (`Cura calls you` →
     "Want me to call Dr. Chen's office now?") → in-call booking talk → appointment saved
   - CRISIS → **no consent** — `crisis_alert` + auto-call to emergency contact +
     sticky red banner telling the patient to call 911 themselves (human presses 911,
     the agent never auto-dials 911) + caregiver alert
3. **Clinic call (the signature demo moment):** Twilio calls `CLINIC_PHONE` → the
   "receptionist" answers → Cura introduces itself, relays patient summary and urgency,
   checks open slots, and books one — every tool fires mid-call as receipts on screen.
4. **Caregiver dashboard:** status hero (grade badge, last check-in, one-line summary) →
   alerts (acknowledge) → timeline with receipts → meds with refill states → call log.
5. **Doctor visit summary (stretch #1):** printable page (print → PDF) of graded
   symptoms, med status, actions, calls.

## Golden demo path (protect this — the video is built on it)
1. Calm check-in ends in 🟢 LOW (30s) — proves the wellbeing app exists.
2. Maria: "Dizzy since yesterday… and I'm out of my pills" → 🔴 HIGH: refill receipt
   slides in + CallOfferCard → consent → phone rings (real Twilio call) → builder answers
   as Dr. Chen's office → in-call booking conversation → slot booked ✅ → hang-up →
   dashboard already has: grade, receipts, call record, appointment, caregiver alert.
3. Bead the crisis cut as its own beat if time: "chest pain" → banner + auto-call,
   no consent asked.
Under 2 minutes total. One phone, two actor hats.

## MVP features
1. Voice check-in: browser Web Speech (STT + TTS) with always-available text fallback.
2. Agent brain: Gemini free tier, function-calling loop (max 3 tool iterations), short
   voice-friendly replies, plain-language persona.
3. Tools (server-executed, receipts rendered live): `log_symptom`, `check_meds`,
   `request_refill`, `book_appointment`, `notify_caregiver`, `crisis_alert`.
4. Grading: model-assisted per check-in + **deterministic regex crisis pre-screen**
   that bypasses the LLM entirely.
5. Telephony: Twilio trial outbound — `clinic_booking` (consent-gated) and
   `crisis_outreach` (auto-fire); both routes dial ROUTE_ALL_TO_ME numbers.
6. Live call console: status machine (idle/ringing/in-call), mid-call receipts,
   transcript building per turn, grade badge on hang-up.
7. Caregiver dashboard + notifications (acknowledge) + call log.
8. Auth: Supabase magic-link; one household pairs patient + caregiver.
9. Sticky "Demo — not medical advice" banner. No diagnosis language anywhere.

## Stretch (only after golden path is done, in order)
1. Doctor visit summary (print/PDF).
2. Tomorrow's reminder card (next check-in + med schedule).
3. Language toggle (ES/PT-BR) for check-in copy.

## Out of scope (do NOT build — deadline 2026-10-26 10:00pm CDT, freeze 6:00pm)
Real pharmacy/SMS/lot booking integrations; diagnosis or dosage advice; HIPAA-compliance
claims; auto-dials-to-911 claims (forbidden in UI/Devpost/video); multi-patient
households; admin panel; native apps; Gemini Live native-audio as default voice
(attempt after golden path, behind a flag); i18n framework; e2e test suites.

## Known limits (say these honestly on the Devpost page)
- Twilio trial: calls open with a trial voice notice; outbound only to verified numbers
  (this is exactly why ROUTE_ALL_TO_ME works); credit is finite; not transcribing 911.
- Telephony requires the CLINIC/EMERGENCY numbers = builder's verified cell in this demo.
- Mock/seeded data only; no real PHI; demo approved-care voice is non-production TTS.

## Rubric mapping (NextSpark Hacks)
- **Creativity/Originality** — one pipeline, two products: wellbeing app + agentic
  escalation engine, switched by a grade. Plus the AI makes the awkward phone call.
- **Impact** — between-visit care in the first sentence; elders answer phones, not apps.
- **Technical Execution** — real tool calls with receipts, real DB, real auth,
  real PSTN call, deployed URL.
- **Design & UX** — voice-first elder console, text fallback, grade color language,
  caregiver mission-control.
