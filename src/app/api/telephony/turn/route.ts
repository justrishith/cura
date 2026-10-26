// /api/telephony/turn — Twilio webhook for the live outbound call (POST, urlencoded).
// Conversation flow:
//   • call-create (fireOutboundCall) opens real calls with TwiML passed via the `Twiml`
//     parameter — buildOpeningTwiml (telephony.ts) is the first thing callers hear.
//   • Each <Gather> action posts here (CallSid + SpeechResult in the urlencoded body)
//     → runPhoneTurn → next <Gather> with Cura's reply, or <Say> + <Hangup> when done.
//
// VERIFIED-AT-BUILD: confirm TwiML attr names + Gather action semantics against current
// Twilio docs during live testing. Attribute set below was verified 2026-10-25 against
// twilio.com/docs/voice/twiml and /docs/voice/twiml/gather:
//   - <Response> root required; verbs/nouns are case-sensitive, attrs camelCased.
//   - <Gather input="speech dtmf" speechTimeout="auto">: SpeechResult (+Confidence) is
//     POSTed to `action` when input is received; with actionOnEmptyResult="true" the
//     action URL is also hit on silence — we re-prompt instead of dead-ending. Without
//     input and without actionOnEmptyResult, the interpreter proceeds past the Gather
//     (or ends the call).
//   - Call-create with the `Twiml` parameter REQUIRES ABSOLUTE action URLs on <Gather>
//     (<Record>/<Pay> too) — why action below is built from PUBLIC_BASE_URL/req origin.
//   - Content-Type application/xml is interpreted as an XML instruction set.
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import { phoneGreeting, runPhoneTurn } from "@/lib/telephony-conv";
import type { CallPurpose } from "@/lib/types";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapResponse(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

function twimlResponse(bodyXml: string): Response {
  return new Response(bodyXml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

function gatherBlock(speech: string, action: string): string {
  return (
    `<Gather input="speech dtmf" speechTimeout="auto" timeout="8" ` +
    `actionOnEmptyResult="true" method="POST" action="${xmlEscape(action)}">` +
    `<Say>${xmlEscape(speech)}</Say></Gather>`
  );
}

function resolveBaseUrl(url: URL): string {
  // PUBLIC_BASE_URL is the deploy address Twilio can reach (same var triggerCall used);
  // fall back to the request origin for local/manual testing.
  return (process.env.PUBLIC_BASE_URL?.trim() || url.origin).replace(/\/$/, "");
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  const purpose: CallPurpose =
    url.searchParams.get("purpose") === "crisis_outreach" ? "crisis_outreach" : "clinic_booking";

  // Twilio posts the webhook as urlencoded form data.
  const form = new URLSearchParams(await req.text().catch(() => ""));
  // Real calls: CallSid always comes in the body. Manual/demo replays may only pass
  // ?sid= (via the gather action URL) — fall back to a generated sid so it still runs.
  const callSid =
    form.get("CallSid") ?? url.searchParams.get("sid") ?? crypto.randomUUID();

  const store = getStore();
  let call = await store.getCallBySid(callSid);
  if (!call) {
    // Registry detail: fireOutboundCall created a CallRecord (providerCallSid null at
    // create; no store API to backfill the Twilio sid), so the webhook anchors a new
    // record keyed by the real CallSid. Demo runs on the DEMO household regardless.
    call = await store.createCall({
      householdId: DEMO_HOUSEHOLD_ID,
      purpose,
      toNumber: form.get("To") ?? "unknown",
      providerCallSid: callSid,
    });
  }

  const base = resolveBaseUrl(url);
  const action = `${base}/api/telephony/turn?purpose=${encodeURIComponent(purpose)}&sid=${encodeURIComponent(callSid)}`;
  const speech = (form.get("SpeechResult") ?? "").trim();

  if (!speech) {
    if (call.transcript.length === 0) {
      // Initial fetch with standard params only (no SpeechResult): Url-style calls
      // (or a manual replay) get the greeting + first gather here. ringing → in-progress.
      await store.updateCallStatus(callSid, "in-progress");
      return twimlResponse(wrapResponse(gatherBlock(phoneGreeting(purpose), action)));
    }
    // Mid-call silence (actionOnEmptyResult fired): gentle re-prompt, no exchange cost.
    return twimlResponse(
      wrapResponse(gatherBlock("Sorry, I missed that — whenever you're ready.", action))
    );
  }

  let turn = { reply: "Sorry, I had a technical hiccup — let's try once more.", done: false };
  try {
    turn = await runPhoneTurn(callSid, purpose, speech);
  } catch {
    // runPhoneTurn degrades internally and persists; this guards only webhook surprises.
  }

  if (turn.done) {
    await store.updateCallStatus(callSid, "completed");
    return twimlResponse(wrapResponse(`<Say>${xmlEscape(turn.reply)}</Say><Hangup/>`));
  }
  return twimlResponse(wrapResponse(gatherBlock(turn.reply, action)));
}
