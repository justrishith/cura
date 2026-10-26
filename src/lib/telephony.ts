// telephony.ts — Twilio Programmable Voice: the "call and talk" layer.
// SERVER-ONLY. ROUTE_ALL_TO_ME: every agent-initiated call dials the demo's
// verified numbers from .env.local (CLINIC_PHONE / EMERGENCY_CONTACT_PHONE).
// TwiML is hand-built (zero SDK surface risk); the REST call-create is plain
// fetch. Webhook signature validation lands with /api/telephony/* (next batch,
// per RULES.md).

import crypto from "node:crypto";
// (crypto reserved for webhook signature validation in the /api/telephony batch)

export type CallPurpose = "clinic_booking" | "crisis_outreach";

export interface FireCallResult {
  fired: boolean;
  recordId: string;
  providerSid?: string;
  reason?: string;
  /** True when the call was attempted via Url-mode (trial accounts can't pass Twiml). */
  mode?: "twiml" | "url" | "template";
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
export function buildOpeningTwiml(
  purpose: CallPurpose,
  patientName: string,
  concern: string,
  turnUrl?: string | null
): string {
  const say =
    purpose === "clinic_booking"
      ? `Hello — this is Cura, an automated care assistant calling on behalf of ${patientName}, who finished her daily check-in a few minutes ago. She reported concerning symptoms: ${concern || "a stiff low and worsening this morning"}. On her behalf, I'd like to set up an appointment. Can we talk about her calendar?`
      : `Hello — this is Cura, an automated care assistant for ${patientName}. This is urgent, not routine. We graded her check-in as emergency-level for ${concern || "an urgent symptom"}. Please make contact with her right now, and consider emergency services if needed. I'll hang up so you can call her directly.`;

  if (purpose === "clinic_booking") {
    // action must be an absolute URL when Twilio opens this TwiML via the Twiml or
    // Url parameter — the Gather hands the caller's speech to /api/telephony/turn.
    const action = turnUrl ? ` action="${escXml(turnUrl)}" actionOnEmptyResult="true"` : "";
    return `<Response><Say>${escXml(say)}</Say><Gather input="speech" speechTimeout="auto" language="en-US"${action}><Say>What's the earliest appointment you have for her?</Say></Gather></Response>`;
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
    const patientName = opts.patientName ?? "the patient";
    const concern = opts.concern ?? "";

    // Twilio's TWIML action URLs must be ABSOLUTE when opened with the Twiml param,
    // so the Gather inside our opening TwiML needs a base the internet can reach.
    const publicBase = (
      process.env.PUBLIC_BASE_URL?.trim() ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "")
    ).replace(/\/$/, "");
    const turnUrl = publicBase
      ? `${publicBase}/api/telephony/turn?purpose=${encodeURIComponent(purpose)}`
      : null;

    const createCall = async (mode: "twiml" | "url" | "template") => {
      const body =
        mode === "twiml"
          ? new URLSearchParams({
              To: to,
              From: from,
              Twiml: buildOpeningTwiml(purpose, patientName, concern, turnUrl),
            })
          : mode === "template"
            ? // Trial-legal opening move (docs/usage/trials/try-out-voice): the call
              // must start from one of Twilio's four hosted Voice Templates. The
              // template speaks its canned demo text; parameter names for injecting
              // Cura's script are TBD (console Start-a-call request shows them).
              new URLSearchParams({
                To: to,
                Url: "https://webhooks.twilio.com/v1/Voice/Template/voice_text_to_speech",
                ...(turnUrl
                  ? { StatusCallback: `${publicBase}/api/telephony/status`, StatusCallbackMethod: "POST" }
                  : {}),
              })
            : turnUrl
              ? new URLSearchParams({ To: to, From: from, Url: turnUrl })
              : null;
      if (!body) return { status: 0, json: {} as Record<string, unknown> };

      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${auth}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      });
      return { status: res.status, json: (await res.json()) as Record<string, unknown> };
    };

    // Attempt 1: Twiml param (works on paid accounts; self-hosted, no public URL needed).
    let { status, json } = await createCall("twiml");
    let mode: "twiml" | "url" | "template" = "twiml";

    // Fallback 2: trial accounts reject the Twiml parameter → use the hosted
    // template (phone rings for real; opening text is Twilio's canned demo).
    if (status !== 200 && status !== 201) {
      const attempt = await createCall("template");
      ({ status, json } = attempt);
      mode = "template";
    }

    // Fallback 3: own-webhook Url mode — the paid-account path for a public deploy.
    if (status !== 200 && status !== 201 && turnUrl) {
      const attempt = await createCall("url");
      ({ status, json } = attempt);
      mode = "url";
    }

    if (status !== 200 && status !== 201) {
      return {
        fired: false,
        recordId: record.id,
        reason: `Twilio ${status}: ${JSON.stringify(json).slice(0, 200)}`,
      };
    }
    const providerSid = typeof json.sid === "string" ? json.sid : undefined;
    if (providerSid) await store.updateCallStatus(providerSid, "in-progress");
    return { fired: true, recordId: record.id, providerSid, mode };
  } catch (err) {
    return {
      fired: false,
      recordId: record.id,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
