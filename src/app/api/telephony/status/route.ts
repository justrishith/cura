// /api/telephony/status — call console polling (GET) + optional Twilio status callback (POST).
//   GET  ?sid=… → { status, purpose, transcript (last 12 turns) }
//   POST  urlencoded CallSid + CallStatus → mapped into store.updateCallStatus.
// Note: triggerCall currently creates calls without a statusCallback URL, so the POST
// side only fires when that parameter is added during live wiring.
// The booking outcome is not recorded here — say_goodbye/book_slot already persisted
// the appointment (via "phone", bookedByCallId) inside the turn tool.
import { NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { clearPhoneSession } from "@/lib/telephony-conv";
import type { CallStatus } from "@/lib/types";

/** Twilio CallStatus webhook values → CuraStatus. (Doc-verified 2026-10-25.) */
const TWILIO_STATUS_MAP: Record<string, CallStatus> = {
  completed: "completed",
  failed: "failed",
  busy: "failed",
  "no-answer": "failed",
  canceled: "failed",
  "in-progress": "in-progress",
  ringing: "ringing",
  queued: "ringing",
  initiated: "ringing",
};

export async function GET(req: Request) {
  const sid = new URL(req.url).searchParams.get("sid");
  if (!sid) return NextResponse.json({ error: "sid required" }, { status: 400 });

  const call = await getStore().getCallBySid(sid);
  if (!call) return NextResponse.json({ error: "call not found" }, { status: 404 });

  return NextResponse.json({
    status: call.status,
    purpose: call.purpose,
    transcript: call.transcript.slice(-12),
  });
}

export async function POST(req: Request) {
  const form = new URLSearchParams(await req.text().catch(() => ""));
  const sid = form.get("CallSid");
  if (!sid) return new Response(null, { status: 204 });

  const mapped = TWILIO_STATUS_MAP[form.get("CallStatus") ?? ""] ?? null;
  if (!mapped) return new Response(null, { status: 204 });

  await getStore().updateCallStatus(sid, mapped);

  // Terminal states: release the transient Gemini chain for this call.
  if (mapped === "completed" || mapped === "failed") clearPhoneSession(sid);

  // Status callbacks don't control call flow — an empty 204 keeps the Debugger quiet.
  return new Response(null, { status: 204 });
}
