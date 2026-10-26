# AGENTS.md — context for any coding session on Cura

**Cura** — voice-first AI care companion for the NextSpark Hacks hackathon.
Deadline: **2026-10-26 10:00pm CDT** · feature freeze 6:00pm CDT · solo builder.

## Stack
Next.js 16 (App Router, TS strict, src dir) · Tailwind v4 · Supabase (Postgres+RLS+
magic-link; MockStore fallback in DEMO_MODE) · Gemini **REST** (generateContent,
function calling; free tier) · Web Speech API (in-app voice) · Twilio Programmable
Voice trial (real calls; Gather/Say loop, no websockets) · Vercel.

## Doc map (read before touching code)
`PRD.md` scope + golden path · `ARCHITECTURE.md` loop/routes/state · `DATABASE.md`
tables/RLS/seed · `design.md` **supersedes UI.md** (tokens, components, screens,
persona copy) · `RULES.md` standards + forbidden patterns.

## Environment (`.env.local`, never committed)
Status: template created; **values pending** —
`GEMINI_API_KEY` (user has key, gate tonight) · `TWILIO_ACCOUNT_SID/AUTH_TOKEN/
FROM_NUMBER` + `CLINIC_PHONE` + `EMERGENCY_CONTACT_PHONE` (user verifying cell) ·
`NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (user restores/
creates project; system `SUPABASE_TOKEN` exists and works for CLI assistance) ·
`DEMO_MODE=1` clears only when Supabase trio lands.

## Commands
- Dev: `npm run dev` → http://localhost:3000
- Type check: `npx tsc --noEmit` (after every change)
- Build: `npm run build` (green before every deploy; Next 16.4.3)
- Deploy: push to GitHub main → Vercel auto-deploy
- DB: copy SQL from DATABASE.md / `supabase/schema.sql` into Supabase SQL editor

## Demo mechanics (one phone, actor hats — ROUTE_ALL_TO_ME)
- All agent-initiated calls dial the builder's verified cell (`CLINIC_PHONE`,
  `EMERGENCY_CONTACT_PHONE`).
- Receptionist cheatsheet (`demo/receptionist-script.md`): answer "Dr. Chen's office,
  how can I help?", offer 2 slots, push back once ("Tuesday's full") so the agent
  shows adapting, then confirm.
- Caregiver cheatsheet (`demo/caregiver-script.md`): answer urgent, ask what
  happened, confirm acting on it.
- Video beats (PRD golden path): calm 🟢 check-in → 🔴 swings on "dizzy + out of
  pills" → refill receipt → consent → real call → booking talk → hang-up → dashboard.
  Crisis cut optional: banner + auto-call, human presses 911 button.

## Session log (update on every meaningful milestone)
| Date | State |
|---|---|
| 2025-10-25 | Next 16 scaffold committed (4efe57e) + design.md/mockup from design session. Source-of-truth docs written. npm deps: lucide-react, @supabase/supabase-js, twilio installed. `.env.local` template created, values pending (Gemini/Twilio/Supabase). Next: build check-in core + MockStore-first agent loop + patient console per design.md. |

## Hard constraints
1. No `any`-heavy hacks. 2. Crisis = regex prescreen before any model call. 3. Build
green before any deploy. 4. Respect feature freeze. 5. Golden path works after every
change (test in MockStore mode when keys absent). 6. New UI = design.md's 8 components
— never invent visual patterns. 7. Verify external APIs against live docs, not memory.
