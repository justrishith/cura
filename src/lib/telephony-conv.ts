// telephony-conv.ts — the live phone-call conversation loop (clinic-booking agent).
// Server-only. One exchange per Twilio <Gather> action hit on /api/telephony/turn:
//   staff speech (SpeechResult) → Gemini tool loop → Cura's next spoken line.
//
// Responsibilities here: persona + tool declarations for the call, runPhoneTurn,
// greetings/close-outs, and executing the booking tools against CuraStore.
// The Twilio webhook/XML layer lives in /api/telephony/turn/route.ts.
//
// Transient state (RULES.md #6 carve-out, per assignment): the module Map below
// holds ONLY the Gemini interaction pointer + exchange count (demo data; the
// Interactions API free tier retains interactions for 1 day). All conversation
// CONTENT persists immediately via store.updateCallStatus(…, transcriptTurn) on
// every turn — the store, not memory, is the source of truth.
//
// GEMINI TRANSPORT (verified 2026-10-25 against ai.google.dev/gemini-api/docs/
// interactions, "Server-side state management"): new turns chain via
// createInteraction({ input, previousId }) — input is a plain text string for a
// spoken turn, or a function_result step array (lib/gemini.functionResultStep)
// after executing tool calls. tools / system_instruction are interaction-scoped
// → both re-sent on every call.
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import { createInteraction, functionResultStep } from "@/lib/gemini";
import type { Appointment, CallPurpose } from "@/lib/types";

/** How many staff↔Cura exchanges one call may run before the polite wrap-up. */
export const MAX_PHONE_EXCHANGES = 5;
/** Tool-call rounds allowed within a single exchange (booking = lookup → decide → book). */
const MAX_TOOL_ROUNDS = 3;

// ── Persona & script ────────────────────────────────────────────────────────────

/**
 * First line Cura says when the clinic answers (Url-style initial fetch).
 * Keep in sync with buildOpeningTwiml's clinic branch in telephony.ts — real
 * Twilio calls open with that TwiML before this webhook is ever hit.
 */
export const STAFF_GREETING =
  "Hello — this is Cura, an automated care assistant calling on behalf of Maria, a 72-year-old patient under your clinic's care. She reported she's been dizzy for two days and is nearly out of her treatment and diabetes medication. On her behalf, I'd like to set up an appointment. What's the earliest you have for her this week?";

export const PHONE_SYSTEM_INSTRUCTION = [
  "You are Cura, a polite, competent AI assistant making a phone call to a medical clinic's front desk on behalf of Maria, a 72-year-old patient.",
  "You are the CALLER. The other party is clinic staff (the receptionist). Speak to them respectfully in brief, natural spoken sentences — one or two short sentences per turn. No lists, no markdown, no special characters.",
  "Context: Maria has been dizzy for two days and is nearly out of her diabetes medication. Goal: book her earliest suitable appointment this week.",
  "Tool policy:",
  "- Call lookup_open_slots before naming specific times, so you only offer slots we actually hold.",
  "- When the receptionist confirms an option, call decide_slot with that slot's spoken label (e.g. 'Tuesday, Oct 27, 10:00 AM'), then REPEAT the exact day and time back to the receptionist clearly.",
  "- Call book_slot with the same label ONLY after the receptionist has confirmed the slot works.",
  "- Call say_goodbye EXACTLY ONCE at the very end: outcome='booked' when an appointment was confirmed (thank the receptionist warmly); outcome='no-booking' when nothing worked (thank them politely, make no promises).",
  "Never state or book a slot the tools did not give you. Never invent medical details, insurance, or payment information. If the receptionist asks for something you cannot provide, note it politely and continue, or say goodbye(outcome no-booking).",
].join("\n");

/** Escalation-safe close-outs: deterministic lines, never model-fabricated. */
export const GOODBYE_BOOKED =
  "Perfect — that's confirmed on our end. Thank you so much for your help, have a great day. Goodbye!";
export const GOODBYE_NO_BOOKING =
  "I understand, no problem at all. Thank you so much for your time — we'll be in touch another way if something opens up. Have a great day. Goodbye!";
const CAP_WRAPUP =
  "Thanks so much for your time — I'll let you go now and follow up another way. Take care. Goodbye!";
const DEGRADED_RETRY =
  "I'm sorry, I lost you for a second — could you repeat that once more?";
const EMPTY_REPROMPT = "Sorry, I didn't catch that — whenever you're ready.";
const NON_CLINIC_CLOSE =
  "Understood — I'll make sure she gets the message. Thank you, goodbye.";

/** Greeting for the initial webhook fetch, per call purpose. */
export function phoneGreeting(purpose: CallPurpose): string {
  return purpose === "crisis_outreach"
    ? "Hello — this is Cura, an automated care assistant for Maria. This is urgent, not routine. We graded her check-in as emergency-level. Please make contact with her right now, and consider emergency services if needed. Thank you — goodbye."
    : STAFF_GREETING; // keep in sync with buildOpeningTwiml in telephony.ts
}

// ── Tool declarations ──────────────────────────────────────────────────────────

export interface PhoneToolDeclaration {
  type: "function";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const BUILD_DECLARATIONS: PhoneToolDeclaration[] = [
  {
    type: "function",
    name: "lookup_open_slots",
    description:
      "List the appointment slots Cura is holding at the clinic (shared calendar). Call before naming options to the receptionist.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "decide_slot",
    description:
      "Lock in your slot choice by its spoken label (e.g. 'Tuesday, Oct 27, 10:00 AM') and get its exact details to confirm with the receptionist. Does not book yet.",
    parameters: {
      type: "object",
      properties: {
        slotLabel: {
          type: "string",
          description: "The slot's spoken date and time, e.g. 'Tuesday, Oct 27, 10:00 AM'",
        },
      },
      required: ["slotLabel"],
    },
  },
  {
    type: "function",
    name: "book_slot",
    description:
      "Book the chosen slot for Maria. Call only after the receptionist confirmed the slot works. Returns the confirmed appointment.",
    parameters: {
      type: "object",
      properties: {
        slotLabel: { type: "string", description: "Same spoken label used with decide_slot" },
      },
      required: ["slotLabel"],
    },
  },
  {
    type: "function",
    name: "say_goodbye",
    description: "End the call politely. Call once, at the end of the conversation.",
    parameters: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          enum: ["booked", "no-booking"],
          description:
            "booked = an appointment was confirmed; no-booking = nothing worked this time",
        },
      },
      required: ["outcome"],
    },
  },
];

// ── Tool execution (against CuraStore) ─────────────────────────────────────────

/** Matches tools.ts's slot formatting so the agent speaks the same labels. */
export function slotLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Loose match of a spoken label ("Tuesday around 10") to a held slot.
 * Scores word overlap with the formatted label plus an am/pm hint; no match → null,
 * so the agent can never book a slot that was never offered.
 */
function matchSlot(open: Appointment[], want: string): Appointment | null {
  const w = want.toLowerCase();
  const tokens = w
    .split(/[^a-z0-9:]+/)
    .filter((t) => t.length >= 3 || /\d/.test(t));
  const wantsAm = /a\.?m\b|morning/.test(w);
  const wantsPm = /p\.?m\b|afternoon/.test(w);

  let best: Appointment | null = null;
  let bestScore = 0;
  for (const apt of open) {
    const label = slotLabel(apt.slot).toLowerCase();
    let score = 0;
    for (const token of tokens) if (label.includes(token)) score += 1;
    const hour = new Date(apt.slot).getHours();
    if (wantsAm && hour < 12) score += 0.5;
    if (wantsPm && hour >= 12) score += 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = apt;
    }
  }
  return bestScore >= 1 ? best : null;
}

async function execPhoneTool(
  hhId: string,
  callId: string | null,
  name: string,
  args: Record<string, unknown>
): Promise<{ text: string }> {
  const store = getStore();
  switch (name) {
    case "lookup_open_slots": {
      const slots = await store.getOpenAppointments(hhId);
      return {
        text: slots.length
          ? slots.map((s) => `${s.provider} — ${slotLabel(s.slot)}`).join("; ")
          : "no slots are currently available",
      };
    }
    case "decide_slot": {
      const open = await store.getOpenAppointments(hhId);
      const picked = matchSlot(open, String(args.slotLabel ?? ""));
      return picked
        ? {
            text: `chosen: ${picked.provider} at ${slotLabel(picked.slot)}. Repeat this exact day and time to the receptionist for confirmation, then call book_slot with "${slotLabel(picked.slot)}".`,
          }
        : {
            text: "no held slot matches what you said. Call lookup_open_slots for the times that actually exist.",
          };
    }
    case "book_slot": {
      const open = await store.getOpenAppointments(hhId);
      const picked = matchSlot(open, String(args.slotLabel ?? ""));
      if (!picked) {
        return {
          text: "no matching open slot — apologize for the confusion and call say_goodbye with outcome no-booking",
        };
      }
      const booked = await store.bookAppointment(picked.id, "phone", callId ?? undefined);
      if (!booked) {
        return { text: "that slot was just taken — check lookup_open_slots for another" };
      }
      // The booking itself is the persisted receipt (status "booked", via "phone",
      // bookedByCallId = this call). No checkin exists on the phone path, so instead
      // of addAction the caregiver learns of it via a notification.
      await store.createNotification({
        householdId: booked.householdId,
        level: "info",
        message: `Cura booked by phone while calling the clinic: ${booked.provider}, ${slotLabel(booked.slot)}.`,
      });
      return {
        text: `booked: ${booked.provider} at ${slotLabel(booked.slot)} (appointment id ${booked.id}). You may now call say_goodbye with outcome booked.`,
      };
    }
    case "say_goodbye":
      return { text: "the call will now end with a polite thank-you" };
    default:
      return { text: `unknown tool "${name}"` };
  }
}

// ── Session state (transient; content persists in the store) ───────────────────

type PhoneSession = { interactionId: string | null; turns: number; degraded: number };
const sessions = new Map<string, PhoneSession>();

/** Drop the Gemini chain for a call (status callback / completion cleanup). */
export function clearPhoneSession(callSid: string): void {
  sessions.delete(callSid);
}

async function finishTurn(
  callSid: string,
  reply: string,
  done: boolean
): Promise<{ reply: string; done: boolean }> {
  // Persist each turn immediately (RULES.md #6: content lives in the store).
  await getStore().updateCallStatus(callSid, "in-progress", { role: "cura", text: reply });
  if (done) clearPhoneSession(callSid);
  return { reply, done };
}

// ── The phone turn ─────────────────────────────────────────────────────────────

/**
 * One spoken exchange of the outbound call.
 * `userText` = the clinic staff member's speech (Twilio SpeechResult), "" on silence.
 * Returns Cura's next spoken line; `done` = true means the route should Hangup.
 */
export async function runPhoneTurn(
  callSid: string,
  purpose: CallPurpose,
  userText: string
): Promise<{ reply: string; done: boolean }> {
  const store = getStore();
  const call = await store.getCallBySid(callSid);
  const hhId = call?.householdId ?? DEMO_HOUSEHOLD_ID;

  const state = sessions.get(callSid) ?? { interactionId: null, turns: 0, degraded: 0 };
  sessions.set(callSid, state);
  state.turns += 1;

  // Persist the staff member's line first — the transcript must reflect the store.
  if (userText) {
    await store.updateCallStatus(callSid, "in-progress", { role: "other", text: userText });
  }

  // crisis_outreach is a fixed script with no dialogue loop; close politely on any turn.
  if (purpose !== "clinic_booking") {
    return finishTurn(callSid, NON_CLINIC_CLOSE, true);
  }

  // Silence reached the model anyway — cheap re-prompt, no exchange burned.
  if (!userText) {
    state.turns -= 1;
    return finishTurn(callSid, EMPTY_REPROMPT, false);
  }

  // Loop cap ≤5 exchanges; after that, polite wrap-up (route Hangups).
  if (state.turns > MAX_PHONE_EXCHANGES) {
    return finishTurn(callSid, CAP_WRAPUP, true);
  }

  // Context: the greeting was spoken before any model turn (Twiml param opening
  // on real calls; the route's initial Say on manual/Url-style replays).
  const opener =
    state.interactionId == null
      ? `You already opened the call by saying who you are and asking after Maria's (72) earliest appointment this week — she's been dizzy for two days and is nearly out of her diabetes medication. `
      : "";
  const input = `${opener}The clinic staff member just said: "${userText}" Reply with your next spoken line.`;

  try {
    let exchange = await createInteraction({
      input,
      tools: BUILD_DECLARATIONS,
      systemInstruction: PHONE_SYSTEM_INSTRUCTION,
      previousId: state.interactionId,
    });
    if (exchange.id) state.interactionId = exchange.id;

    let outcome: "booked" | "no-booking" | null = null;
    let reply: string | null = exchange.outputText;

    for (let round = 0; round < MAX_TOOL_ROUNDS && !outcome; round++) {
      const calls = exchange.functionCalls;
      if (calls.length === 0) break;

      const results: unknown[] = [];
      for (const c of calls) {
        if (c.name === "say_goodbye") {
          outcome =
            String(c.arguments?.outcome ?? "no-booking") === "booked" ? "booked" : "no-booking";
          results.push(
            functionResultStep("say_goodbye", c.id ?? "", "ending the call politely now")
          );
          continue;
        }
        const text = (
          await execPhoneTool(hhId, call?.id ?? null, c.name ?? "", c.arguments ?? {})
        ).text;
        results.push(functionResultStep(c.name ?? "", c.id ?? "", text));
      }

      if (outcome) break; // deterministic goodbye line replaces any further model text
      exchange = await createInteraction({
        input: results,
        tools: BUILD_DECLARATIONS,
        systemInstruction: PHONE_SYSTEM_INSTRUCTION,
        previousId: state.interactionId,
      });
      if (exchange.id) state.interactionId = exchange.id;
      if (exchange.outputText) reply = exchange.outputText;
    }

    if (outcome === "booked") return finishTurn(callSid, GOODBYE_BOOKED, true);
    if (outcome === "no-booking") return finishTurn(callSid, GOODBYE_NO_BOOKING, true);
    return finishTurn(
      callSid,
      reply ??
        (state.turns === 1
          ? "I see — thank you. Could you check what her earliest opening looks like this week?"
          : "Thank you, that's helpful."),
      false
    );
  } catch (err) {
    const degraded = err instanceof Error ? err.message : "unknown";
    void degraded; // kept out of the spoken reply; the store transcript shows the retry
    state.degraded += 1;
    if (state.degraded >= 2) {
      // Escalation-safe: never fake a booking — end the call honestly without one.
      return finishTurn(callSid, GOODBYE_NO_BOOKING, true);
    }
    return finishTurn(callSid, DEGRADED_RETRY, false);
  }
}
