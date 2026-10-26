# Cura — Project Rules

## Purpose lock
Hackathon build (NextSpark Hacks). Deadline: **2026-10-26 10:00pm CDT**.
**Feature freeze: 6:00pm CDT 2026-10-26.** The golden demo path (PRD) is sacred — any
change must keep it intact.

## Coding standards
- TypeScript **strict**; no `any` unless justified out loud.
- Naming: `PascalCase` components/types, `camelCase` hooks/vars, `kebab-case` files.
- One concern per file; components ≤ 200 lines.
- Secrets server-only (`src/lib/*-server.ts` / route handlers). Client imports only
  `NEXT_PUBLIC_*`.
- Every fetch has explicit loading + error + success state. No leftover `console.log`.
- Tailwind tokens from `design.md` only — no one-off hex. No gradients/glass/dark mode.

## Forbidden anti-patterns (instant revert)
1. Hardcoded env values, API keys, phone numbers, or emails in source.
2. Schema changes outside `supabase/schema.sql` + SQL editor (and never silently).
3. The LLM improvising on crisis keywords — `crisis.ts` prescreen always runs first.
4. AI claiming/copying "auto-dials 911" anywhere (UI, Devpost, video). 911 is
   human-press (CrisisBanner `tel:` link). Say "emergency-contact call" instead.
5. Storing call audio/recordings — text transcripts only, per DATABASE.md.
6. Conversation state cached in memory across requests — receipts always persist via
   store.ts (mock or Postgres).
7. Feature creep beyond PRD MVP/stretch without explicit user OK.
8. Refactor + feature in the same commit. Never force-push during the hackathon window.

## How the AI (you) behaves when editing files
- Before ANY edit: check **PRD.md** (scope), **ARCHITECTURE.md** (where it lives),
  **DATABASE.md** (table names), **design.md** (tokens/components — reuse, don't invent).
- Prefer small additive diffs; no "while I'm here" refactors before deadline.
- After every change: `npx tsc --noEmit`, then `npm run build`; fix before moving on.
- Touching `api/agent/route.ts`, `tools.ts`, `crisis.ts`, or `telephony.ts`? Say so and
  explain how the golden path stays intact.
- If a fix exceeds ~20 min of attempts: STOP, state what failed, use the documented
  fallback (MockStore, text fallback, scripted replies) and move on. The demo must survive.
- Never verify library APIs from memory: REST `generateContent` and TwiML/Twilio
  signatures must be checked against current docs before use.
- Never commit `.env.local`; never force-push; never leak keys into chat output when
  echoing config.

## Environment contract
- `.env.local` at project root (template exists; values pending from the user):
  `GEMINI_API_KEY` → brain; `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM_NUMBER` +
  `CLINIC_PHONE` + `EMERGENCY_CONTACT_PHONE` → telephony (ROUTE_ALL_TO_ME);
  `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` → data; when
  missing, `store.ts` DEMO_MODE MockStore keeps every flow demoable.
- `DEMO_MODE=1` until Supabase trio lands; then main thread clears it intentionally.
