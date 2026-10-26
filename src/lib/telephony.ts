// telephony.ts — outbound call trigger (Twilio trial: verified numbers only, per
// ROUTE_ALL_TO_ME). Simulates gracefully when Twilio env is absent so the product
// demos end-to-end regardless. Webhook loop lives in /api/telephony/*.
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import { crisisCallScript } from "@/lib/crisis";
import type { CallPurpose } from "@/lib/types";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

export type CallTrigger = {
  simulated: boolean;
  callSid: string | null;
  script: string;
  toNumber: string | null;
  error?: string;
};

export function clinicCallScript(patientName: string): string {
  return (
    `Hi, this is Cura, an automated assistant calling on behalf of ${patientName}, who is an older adult under your clinic's care. ` +
    "She's reported ongoing dizziness over the last two days and her diabetes medication is running out. " +
    "I'm looking for her earliest possible appointment this week — do you have anything Tuesday morning around ten?"
  );
}

export function toNumberFor(purpose: CallPurpose): string | null {
  return purpose === "clinic_booking"
    ? (process.env.CLINIC_PHONE ?? null)
    : (process.env.EMERGENCY_CONTACT_PHONE ?? null);
}

export async function triggerCall(
  householdIdRaw: string,
  purpose: CallPurpose,
  concernForScript: string
): Promise<CallTrigger> {
  const store = getStore();
  const hhId = (await store.getHousehold(householdIdRaw)) ? householdIdRaw : DEMO_HOUSEHOLD_ID;
  const hh = await store.getHousehold(hhId);
  const patientName = "the patient";
  const script =
    purpose === "crisis_outreach"
      ? crisisCallScript(patientName, concernForScript)
      : clinicCallScript(patientName);
  const to = toNumberFor(purpose);

  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const publicUrl = process.env.PUBLIC_BASE_URL; // Twilio must reach our webhook

  let callSid: string | null = null;
  let simulated = true;
  let error: string | undefined;

  if (sid && token && from && to && publicUrl) {
    simulated = false;
    const body = new URLSearchParams({
      To: to,
      From: from,
      Url: `${publicUrl.replace(/\/$/, "")}/api/telephony/turn?purpose=${purpose}`,
      Method: "POST",
    });
    const res = await fetch(`${TWILIO_API}/Accounts/${sid}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) {
      error = json.message ?? `Twilio HTTP ${res.status}`;
      simulated = true;
    } else {
      callSid = json.sid ?? null;
    }
  } else {
    error = "Twilio vars incomplete — simulated call recorded";
  }

  await store.createCall({
    householdId: hhId,
    purpose,
    toNumber: to ?? "unavailable",
    providerCallSid: callSid ?? undefined,
  });

  void hh;
  return { simulated, callSid, script, toNumber: to, error };
}
