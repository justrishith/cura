<div align="center">

<img src="assets/cura-bird-hero.svg" alt="Cura — a small perched bird that sings, next to the wordmark: Care between visits." width="440" />

[![Hackathon](https://img.shields.io/badge/NextSpark%20Hacks-2026-35422d?style=flat-square)](https://nextspakhacks.devpost.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![Gemini](https://img.shields.io/badge/AI-Gemini-8e75b2?style=flat-square&logo=google&logoColor=white)](https://ai.google.dev)
[![Twilio Voice](https://img.shields.io/badge/Voice-Twilio-f22f46?style=flat-square&logo=twilio)](https://www.twilio.com/voice)
[![Supabase](https://img.shields.io/badge/Records-Supabase-3ecf8e?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![Cost](https://img.shields.io/badge/runs%20on-%240aires-694737?style=flat-square)](#-stack)

**A voice-first AI care companion.** One minute of honest conversation every
day — and when something's off, Cura is the one who speaks up, logs everything,
and makes the phone calls that matter.

**[▶ Open the live demo](https://cura-king4rishiths-projects.vercel.app)**

</div>

<br>

## The story

The care system sees your parent twice a month. The person who actually knows
how last night went — the dizziness, the skipped pills, the rough night — is
nobody, because daily check-ins are a human's job, and humans get busy, forget,
or live three time zones away.

**Cura does the daily part.** She calls out on the speakerphone, asks how things
are in plain language, listens with care, and answers out loud — in her own
Gemini-generated voice, not a robotic browser voice. Every conversation ends
with a **grade** and visible **receipts**: exactly what Cura did, and why.

> **Our goal: no quiet bad days.** If something is wrong, it becomes a
> notification, a receipt, and a booked appointment — before dinner, not after
> the next scheduled visit.

<br>

## How a conversation flows

```mermaid
flowchart LR
    A[Voice check-in,<br/>60 seconds] --> B{Care grade}
    B -- LOW --> C[Reassurance +<br/>patient health tip]
    B -- HIGH --> D[Caregiver alerted,<br/>offer to call the doctor]
    B -- CRISIS --> E[Scripted calm-down path,<br/>auto-call to family]
    D --> F[Real Twilio call:<br/>Cura books the visit]
    E --> F
    C & D & E --> G[Everything logged:<br/>receipts + summary]
```

- **LOW** — a good day. Cura keeps it warm and short.
- **HIGH** — something's off. The caregiver gets a `notify_caregiver` receipt
  and the patient console offers (consent-first) a real phone call to the
  doctor's office, where Cura speaks to a human receptionist in conversation.
- **CRISIS** — dangerous wording routes to a fully **deterministic** path:
  scripted, calm, and the agent has no say in it.

<br>

## What's under the hood

| Layer | How it works |
|---|---|
| **Agent loop** | Gemini tool-calling, with a **tier guard**: proposed crisis actions are downgraded unless the check-in itself graded CRISIS |
| **Voice in** | Web Speech recognition, push-to-talk orb |
| **Voice out** | Gemini native TTS (`gemini-2.5-flash-preview-tts`, voice *Aoede*) → WAV → `<audio>`; browser `speechSynthesis` only as fallback |
| **Phone calls** | Twilio Programmable Voice — hand-built TwiML, a `<Gather>` loop that lets the receptionist talk back |
| **Records** | Supabase: check-ins, grades, receipts, calls, notifications |
| **Design** | "Organic" system — earth palette, Source Serif 4 + Instrument Sans, paper grain, animated but screen-reader-safe |

<br>

## The safety rails

- **Cura never dials 911.** Emergency escalation is a human decision — Cura's
  job is making the right humans know quickly and clearly.
- The agent **cannot** self-promote a crisis: a tier guard checks its proposals
  against the deterministic grade each turn.
- Receipts are the contract: every action Cura takes is visible to the patient
  push-style, and to the family in the dashboard. Nothing happens silently.
- Not medical advice. A companion, not a clinician.

<br>

## Stack

Next.js 16 · TypeScript · Tailwind · Gemini agent + native TTS · Twilio Voice ·
Supabase · Web Speech API · hand-built TwiML. Everything runs on **free tiers**
— the point of a companion is that anyone could run it.

```bash
git clone https://github.com/justrishith/cura
cd cura
npm install
# .env.local — Gemini, Supabase, Twilio creds
npm run dev
```

<br>

<div align="center">

Built end-to-end in one weekend by **[Rishith](https://github.com/justrishith)**
for **NextSpark Hacks**.

</div>
