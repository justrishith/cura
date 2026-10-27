// /api/call — consented outbound-call trigger. POSTed when the patient taps
// [Call now] on the CallStrip offer (design.md §4-C7 / §6 consent state).
// Always records the intent as a schedule_telephone_call receipt; the payload
// notes whether the call was simulated (Twilio env absent / number unset).
// Response: { simulated, callSid, doneMessage } — the exact contract CheckInConsole
// polls against; /api/telephony/state?sid=… handles the live outcome (agent D).
import { NextResponse } from "next/server";
import { fireOutboundCall } from "@/lib/telephony";
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import type { CallPurpose } from "@/lib/types";

const SIMULATED_DONE_MESSAGE =
  "Demo call simulated — in production this dials the clinic. Booking flow continues on the dashboard.";

interface CallRequestBody {
  purpose: CallPurpose;
  householdId: string;
  checkinId: string | null;
}

export async function POST(req: Request) {
  let body: Partial<CallRequestBody>;
  try {
    body = (await req.json()) as Partial<CallRequestBody>;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const householdId =
    typeof body.householdId === "string" && body.householdId.trim() ? body.householdId : DEMO_HOUSEHOLD_ID;
  const purpose: CallPurpose = body.purpose === "crisis_outreach" ? "crisis_outreach" : "clinic_booking";
  const checkinId = typeof body.checkinId === "string" && body.checkinId.trim() ? body.checkinId : null;

  // fireOutboundCall never throws — config/REST failures degrade to fired:false.
  const call = await fireOutboundCall(purpose, householdId, { patientName: "Maria" });

  const store = getStore();
  // Receipt needs a check-in to attach to; consent always follows a live check-in,
  // but a missing id must not lose the record the caregiver expects to see.
  const receiptCheckinId = checkinId ?? (await store.createCheckin({ householdId })).id;
  await store.addAction({
    checkinId: receiptCheckinId,
    tool: "schedule_telephone_call",
    status: "succeeded",
    payload: {
      simulated: !call.fired,
      callRecordId: call.recordId,
      ...(call.providerSid ? { providerCallSid: call.providerSid } : {}),
      // "template" = trial account: Twilio plays its fixed canned notice instead
      // of inline TwiML (documented trial limitation, see telephony.ts).
      ...(call.mode ? { mode: call.mode } : {}),
      ...(call.reason ? { reason: call.reason } : {}),
    },
  });

  return NextResponse.json({
    simulated: !call.fired,
    callSid: call.providerSid ?? null,
    trialTemplate: call.fired && call.mode === "template",
    doneMessage: call.fired ? undefined : SIMULATED_DONE_MESSAGE,
  });
}

export async function GET() {
  return NextResponse.json({ error: "method not allowed" }, { status: 405 });
}
