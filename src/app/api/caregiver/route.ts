// /api/caregiver — read snapshot for the caregiver dashboard + notification ack.
// GET  (?householdId=..., defaults to the demo household) → CaregiverSnapshot.
// POST { notificationId } → acknowledgeNotification. Server-only; uses getStore().
import { NextResponse } from "next/server";
import type {
  ActionReceipt,
  Appointment,
  CallRecord,
  CaregiverNotification,
  Checkin,
  Medication,
} from "@/lib/types";
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import { getBrainSummaryForCard, type BrainCard } from "@/lib/patient-brain";

export interface CheckinWithActions extends Checkin {
  actions: ActionReceipt[];
}

export interface CaregiverSnapshot {
  householdId: string;
  /** PRD persona constant: household.name is "Demo Household"; the patient is Maria, 72. */
  patientName: string;
  meds: Medication[];
  checkins: CheckinWithActions[];
  notifications: CaregiverNotification[];
  calls: CallRecord[];
  appointments: Appointment[];
  brainCard?: BrainCard;
}

/** Caregiver surface fetch: every list the dashboard renders, in one round trip. */
export async function GET(req: Request) {
  const householdId =
    new URL(req.url).searchParams.get("householdId") ?? DEMO_HOUSEHOLD_ID;

  const store = getStore();
  if (!(await store.getHousehold(householdId))) {
    return NextResponse.json({ error: "unknown household" }, { status: 404 });
  }

  // PRD persona: household.name is "Demo Household"; the patient display name is Maria.
  const patientName = "Maria";

  const meds = await store.getMedications(householdId);
  // Newest first; each check-in carries its own agent receipts.
  const checkins = await store.getCheckinsForHousehold(householdId);
  const withActions = await Promise.all(
    checkins.map(async (checkin): Promise<CheckinWithActions> => ({
      ...checkin,
      actions: await store.getActionsForCheckin(checkin.id),
    }))
  );
  const notifications = await store.getNotifications(householdId);
  const calls = await store.getCallLog(householdId);
  const appointments = await store.getAppointments(householdId);
  const brainSummary = await getBrainSummaryForCard(store, householdId, patientName);

  const snapshot: CaregiverSnapshot = {
    householdId,
    patientName,
    meds,
    checkins: withActions,
    notifications,
    calls,
    appointments,
    brainCard: brainSummary,
  };
  return NextResponse.json(snapshot);
}

/** Caregiver acknowledges an alert. 404 when the notification does not exist. */
export async function POST(req: Request) {
  let body: { notificationId?: unknown };
  try {
    body = (await req.json()) as { notificationId?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const notificationId = body.notificationId;
  if (typeof notificationId !== "string" || notificationId.length === 0) {
    return NextResponse.json({ error: "notificationId required" }, { status: 400 });
  }

  const acknowledged = await getStore().acknowledgeNotification(notificationId);
  if (!acknowledged) {
    return NextResponse.json({ error: "unknown notification" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, notification: acknowledged });
}
