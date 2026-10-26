// telephony.ts — Twilio Programmable Voice: the "call and talk" layer.
// SERVER-ONLY. ROUTE_ALL_TO_ME: every agent-initiated call dials the demo's
// verified numbers from .env.local (CLINIC_PHONE / EMERGENCY_CONTACT_PHONE).
// TwiML is hand-built (zero SDK surface risk); the REST call-create is plain
// fetch. Webhook signature validation lands with /api/telephony/* (next batch,
// per RULES.md).

import crypto from "node:crypto";

export type CallPurpose = "clinic_booking" | "crisis_outreach";

export interface FireCallResult {
  fired: boolean;
  recordId: string;
  providerSid?: string;
  reason?: string;
}

export interface FireCallResult {
  fired: boolean;
  recordId: string;
  providerSid?: string;
  reason?: string;
}

export function telephonyConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim()
  );
}

function numberFor(purpose: CallPurpose): string | null {
  const clinic = process.env.CLINIC_PHONE?.trim() ?? null;
  const emergency = process.env.EMERGENCY_CONTACT_PHONE?.trim() ?? null;
  return purpose === "clinic_booking" ? clinic : emergency;
}

function escXml(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Opening TwiML the person hears when the phone answers. */
export function buildOpeningTwiml(purpose: CallPurpose, patientName: string, concern: string): string {
  const say =
    purpose === "clinic_booking"
      ? `Hello — this is Cura, an automated care assistant calling on behalf of ${patientName}, who finished her daily check-in a few minutes ago. She reported concerning symptoms: ${concern || "a stiff low and worsening this morning"}. On her behalf, I'd like to set up an appointment. Can we talk about her calendar?`
      : `Hello — this is Cura, an automated care assistant for ${patientName}. This is urgent, not routine. We graded her check-in as emergency-level for ${concern || "an urgent symptom"}. Please make contact with her right now, and consider emergency services if needed. I'll hang up so you can call her directly.`;

  if (purpose === "clinic_booking") {
    return `<Response><Say>${escXml(say)}</Say><Gather input="speech" speechTimeout="auto" language="en-US"><Say>What's the earliest appointment you have for her?</Say></Gather></Response>`;
  }
  return `<Response><Say>${escXml(say)}</Say><Hangup/></Response>`;
}

/**
 * Fire a real outbound call via Twilio REST (call-create).
 * TwiML above is the opening move; /api/telephony/turn (wired next) continues
 * the conversation, and /api/telephony/status keeps `calls` rows current.
 * Missing config degrades gracefully — the in-app demo never depends on this.
 */
export async function fireOutboundCall(
  purpose: CallPurpose,
  householdId: string,
  opts: { patientName?: string; concern?: string } = {}
): Promise<FireCallResult> {
  const { getStore } = await import("./store");
  const store = getStore();
  const to = numberFor(purpose);
  const record = await store.createCall({ householdId, purpose, toNumber: to ?? "unset" });

  if (!to) return { fired: false, recordId: record.id, reason: `${purpose} number not set in .env.local` };
  if (!telephonyConfigured()) return { fired: false, recordId: record.id, reason: "Twilio not configured yet" };

  try {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
    const auth = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
    const from = process.env.TWILIO_FROM_NUMBER?.trim() ?? "";
    const twiml = buildOpeningTwiml(purpose, opts.patientName ?? "the patient", opts.concern ?? "");

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Twiml: twiml }),
    });

    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      return {
        fired: false,
        recordId: record.id,
        reason: `Twilio ${res.status}: ${JSON.stringify(json).slice(0, 200)}`,
      };
    }
    const providerSid = typeof json.sid === "string" ? json.sid : undefined;
    if (providerSid) await store.updateCallStatus(providerSid, "in-progress");
    return { fired: true, recordId: record.id, providerSid };
  } catch (err) {
    return {
      fired: false,
      recordId: record.id,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
