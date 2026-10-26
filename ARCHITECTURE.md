# Cura — Architecture

## Stack
- **Framework:** Next.js 16 (App Router, TypeScript strict, src dir, `@/*` alias) — scaffold done
- **Styling:** Tailwind CSS v4 (tokens in `design.md` — supersedes UI.md)
- **DB/Auth:** Supabase (Postgres + magic-link + RLS), free tier
- **LLM:** Gemini API free tier — **REST `generateContent` via `fetch`** (no SDK; version-stable)
- **Voice (in-app):** Web Speech API (SpeechRecognition + speechSynthesis), Chrome/Edge; text fallback
- **Voice (phone):** Twilio Programmable Voice trial — TwiML `<Gather input="speech">` loop,
  Twilio STT + `<Say>` neural TTS; voice official `twilio` npm package
- **Hosting:** Vercel free tier (HTTPS required for mic)

## Philosophy
- ONE endpoint owns the whole agentic loop; clients only render.
- Postgres is the source of truth; the client never holds durable state.
- Secrets server-only. **DEMO_MODE=1** runs the app with a mock store before/without
  Supabase keys so the demo never blocks on signup friction.

## Folder structure
```
cura/
├── PRD.md ARCHITECTURE.md DATABASE.md RULES.md AGENTS.md design.md   ← source of truth (UI.md = pointer to design.md)
├── cura-ui-mockup.html          ← visual target; rebuild in JSX, don't port hacks
├── supabase/schema.sql          ← tables + RLS + seed (paste into SQL editor)
├── src/
│   ├── app/
│   │   ├── page.tsx             ← landing: hero + "I'm the patient" / "I'm the caregiver"
│   │   ├── patient/page.tsx     ← check-in console (voice + text + escalation)
│   │   ├── caregiver/page.tsx   ← dashboard (client, polls every 15s)
│   │   ├── summary/page.tsx     ← printable doctor summary (stretch)
│   │   └── api/
│   │       ├── agent/route.ts   ← THE stateless agent endpoint (one turn = full loop)
│   │       ├── call/route.ts    ← consent-gated trigger → Twilio outbound call
│   │       └── telephony/
│   │           ├── turn/route.ts    ← Twilio webhook: speech→grade→tools→TwiML reply
│   │           └── status/route.ts  ← Twilio webhook: call lifecycle → calls table
│   ├── lib/
│   │   ├── types.ts             ← Grade, Receipt, Tool names, Checkin, Call
│   │   ├── gemini.ts            ← REST generateContent + tool schemas (server-only)
│   │   ├── tools.ts             ← tool impls + tier orchestration map (server-only)
│   │   ├── crisis.ts            ← regex prescreen + scripted lines (server-only)
│   │   ├── telephony.ts         ← personas (staff/crisis) + TwiML builders (server-only)
│   │   ├── store.ts             ← data layer: Supabase server client, or MockStore
│   │   │                          when DEMO_MODE=1 (in-memory, same interface)
│   │   ├── supabase-client.ts   ← anon client for RLS-scoped pages
│   │   └── speech.ts            ← client hooks: useSpeech() (listen/speak, fallback)
│   └── components/
│       ├── ui/                  ← CuraMark, GradeBadge, ActionCard, TranscriptBubble,
│       │                          CrisisBanner, CallOfferCard, SlotChip, MedCard, AlertRow…
│       ├── patient/             ← MicOrb, CheckInConsole, ActionRail, CallStrip
│       └── caregiver/           ← StatusHero, CheckInRow, CallLogRow, MedsList
```

## The agent loop (POST /api/agent) — one request = one full conversational turn
```
Patient console (speech.ts → text, or text input)
  │ {householdId, message, recentHistory}
  ▼
crisis.ts prescreen ──regex hit──► SCRIPTED CRISIS PATH (no LLM):
  │                                  checkin(grade=crisis) + actions(crisis_alert)
  │                                  + caregiver_notification + trigger crisis_outreach call
  │                                  returns {reply: SCRIPT, grade, receipts}
  ▼ clean
gemini.ts → generateContent (system prompt: Cura persona, grading rubric, tool schemas,
  patient profile + meds; rule: never diagnose, route care)
  ├── function call? → tools.ts executes against store.ts (Service-role or MockStore),
  │     appends receipt, re-prompts (max 3 iterations)  [HIGH tier: also ensure
  │     required receipt exists regardless of model output]
  ├── final text + grade (low|medium|high)
  ▼
Persist checkins row (+symptom_events) + actions receipts (+ caregiver notification
  if HIGH)
  │ {reply, grade, receipts, callOffer?: {type: 'clinic_booking' | none}}
  ▼
Client: ActionCards slide in, TTS speaks reply, transcript updates; HIGH renders
  CallOfferCard ("Want me to call Dr. Chen's office now?")
```

## Telephony (lib/telephony.ts + /api/call + /api/telephony/*)
- `/api/call` POST {purpose: 'clinic_booking'|'crisis_outreach'}:
  - clinic_booking: requires a HIGH-grade open callOffer from a live check-in (consent
    state). Server: Twilio REST call to `CLINIC_PHONE` → webhook `/api/telephony/turn`.
  - crisis_outreach: fires immediately on CRISIS (no consent), to
    `EMERGENCY_CONTACT_PHONE`.
- `/api/telephony/turn` (TwiML webhook): each Gather turn = SpeechResult →
  crisis prescreen → Gemini tool loop (same tools.ts, staff/crisis persona prompt) →
  next `<Say>`/`<Gather>` or `<Hangup>`. Every tool = receipt row (same as in-app).
- `/api/telephony/status` (webhook): call lifecycle → `calls.status`
  (ringing|in-progress|completed|failed).
- Identity: `To`/`From` E.164 number → household lookup (`CLINIC_PHONE`/
  `EMERGENCY_CONTACT_PHONE` are household config = ROUTE_ALL_TO_ME).
- Validate Twilio request signatures on all webhooks. Text transcripts only; no
  recordings stored.

## Grading (mirrors PRD)
Model proposes grade per check-in; crisis regex overrides to `crisis`; server enforces
tier-required tools. Deterministic where it matters, model where it helps.

## External APIs + fallbacks
| API | Tier | Used for | Failure fallback |
|---|---|---|---|
| Gemini REST | Free | grade/conversation/tools | retry ×1 → spoken friendly error; in-app loop never breaks |
| Supabase | Free | auth+data (when wired) | DEMO_MODE=1 → MockStore (in-memory), same interface; flip off after wiring |
| Twilio trial | ~$15 credit | real calls | in-app check-in always works; telephony degrades gracefully |
| Web Speech | Browser | STT/TTS | text fallback (also the a11y story) |
| Vercel | Free | hosting | local `next dev` for dev |

## State management
- Server/DB owns everything via store.ts single interface (Supabase or MockStore).
- Patient console: local React state for transcript; receipts drive ActionCards.
- Caregiver dashboard: RLS-scoped fetch + 15s polling; acknowledge writes directly.
- No global state library. No SWR. One poll. Keep it boring.

## Deployment / env
- Vercel ← GitHub main auto-deploy; build checks before every push:
  `npx tsc --noEmit` then `npm run build`. After deploy, run the golden path live
  (mic needs HTTPS — voice testing on the Vercel URL, not localhost).
- Env keys live in `.env.local` (never committed) — order of urgency: GEMINI →
  TWILIO trio + CLINIC/EMERGENCY phones → SUPABASE trio (then set DEMO_MODE="").
