// store.ts — the single data layer. Same interface everywhere:
//   MockStore (DEMO_MODE=1): in-memory seeded demo, survives within the server runtime
//   SupabaseStore (wired keys): Postgres via service-role client (added when keys land)
// Server-only; route handlers call getStore().

import { SupabaseStore } from "./store-supabase";
import type {
  ActionReceipt,
  Appointment,
  CallPurpose,
  CallRecord,
  CallStatus,
  CaregiverNotification,
  Checkin,
  Grade,
  Household,
  Medication,
  RefillStatus,
  SymptomEvent,
  ToolName,
  ToolStatus,
} from "./types";

export interface CuraStore {
  getHousehold(id: string): Promise<Household | null>;
  getMedications(householdId: string): Promise<Medication[]>;
  setRefillStatus(medId: string, status: RefillStatus): Promise<Medication | null>;
  createCheckin(input: { householdId: string; grade?: Grade }): Promise<Checkin>;
  updateCheckin(
    id: string,
    patch: {
      grade?: Grade;
      summaryText?: string;
      thread?: Checkin["thread"];
      interactionId?: string | null;
    }
  ): Promise<Checkin | null>;
  getCheckin(id: string): Promise<Checkin | null>;
  /** All check-ins for a household, newest first (caregiver/summary views). */
  getCheckinsForHousehold(householdId: string): Promise<Checkin[]>;
  addSymptomEvent(input: {
    checkinId: string;
    description: string;
    severity: Grade;
  }): Promise<SymptomEvent>;
  addAction(input: {
    checkinId: string;
    tool: ToolName;
    status?: ToolStatus;
    payload: Record<string, string | number | boolean | undefined>;
  }): Promise<ActionReceipt>;
  getActionsForCheckin(checkinId: string): Promise<ActionReceipt[]>;
  getOpenAppointments(householdId: string): Promise<Appointment[]>;
  /** All appointments (any status) for a household, soonest slot first (summary view). */
  getAppointments(householdId: string): Promise<Appointment[]>;
  bookAppointment(
    appointmentId: string,
    via: "web" | "phone",
    callId?: string
  ): Promise<Appointment | null>;
  createCall(input: {
    householdId: string;
    purpose: CallPurpose;
    toNumber: string;
    providerCallSid?: string;
  }): Promise<CallRecord>;
  updateCallStatus(
    providerCallSid: string,
    status: CallStatus,
    transcriptTurn?: { role: "cura" | "other"; text: string }
  ): Promise<CallRecord | null>;
  getCallBySid(providerCallSid: string): Promise<CallRecord | null>;
  getCallLog(householdId: string): Promise<CallRecord[]>;
  getNotifications(householdId: string): Promise<CaregiverNotification[]>;
  createNotification(input: {
    householdId: string;
    checkinId?: string;
    level: CaregiverNotification["level"];
    message: string;
  }): Promise<CaregiverNotification>;
  acknowledgeNotification(id: string): Promise<CaregiverNotification | null>;
}

const DEMO_HOUSEHOLD_ID = "11111111-1111-1111-1111-111111111111";

function isoDaysFromNow(days: number, hour: number, minute: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** In-memory demo store seeded with the golden-path demo state (Maria, 72). */
class MockStore implements CuraStore {
  private households = new Map<string, Household>([
    [
      DEMO_HOUSEHOLD_ID,
      {
        id: DEMO_HOUSEHOLD_ID,
        name: "Demo Household",
        clinicPhone: process.env.CLINIC_PHONE ?? null,
        emergencyPhone: process.env.EMERGENCY_CONTACT_PHONE ?? null,
      },
    ],
  ]);

  private meds: Medication[] = [
    { id: "med-metformin", householdId: DEMO_HOUSEHOLD_ID, name: "Metformin", dosage: "500mg — 2x daily", refillStatus: "ok", lastRefillAt: null },
    { id: "med-lisinopril", householdId: DEMO_HOUSEHOLD_ID, name: "Lisinopril", dosage: "10mg — 1x morning", refillStatus: "ok", lastRefillAt: null },
    { id: "med-statin", householdId: DEMO_HOUSEHOLD_ID, name: "Atorvastatin", dosage: "20mg — nightly", refillStatus: "ok", lastRefillAt: null },
  ];

  private appointments: Appointment[] = [
    { id: "apt-chen-tue-10", householdId: DEMO_HOUSEHOLD_ID, provider: "Dr. Chen — Internal Medicine, Sunnyvale Clinic", slot: isoDaysFromNow(2, 10, 0), status: "hold", via: "web", bookedByCallId: null },
    { id: "apt-chen-wed-14", householdId: DEMO_HOUSEHOLD_ID, provider: "Dr. Chen — Internal Medicine, Sunnyvale Clinic", slot: isoDaysFromNow(3, 14, 30), status: "hold", via: "web", bookedByCallId: null },
    { id: "apt-patel-tue-15", householdId: DEMO_HOUSEHOLD_ID, provider: "Dr. Patel — Cardiology, Sunnyvale Clinic", slot: isoDaysFromNow(2, 15, 0), status: "hold", via: "web", bookedByCallId: null },
  ];

  private checkins = new Map<string, Checkin>();
  private symptomEvents: SymptomEvent[] = [];
  private actions: ActionReceipt[] = [];
  private calls: CallRecord[] = [];
  private notifications: CaregiverNotification[] = [];

  private now(): string {
    return new Date().toISOString();
  }

  async getHousehold(id: string): Promise<Household | null> {
    return this.households.get(id) ?? null;
  }

  async getMedications(householdId: string): Promise<Medication[]> {
    return this.meds.filter((m) => m.householdId === householdId);
  }

  async setRefillStatus(medId: string, status: RefillStatus): Promise<Medication | null> {
    const med = this.meds.find((m) => m.id === medId) ?? null;
    if (med) {
      med.refillStatus = status;
      if (status === "ordered") med.lastRefillAt = this.now();
    }
    return med;
  }

  async createCheckin(input: { householdId: string; grade?: Grade }): Promise<Checkin> {
    const checkin: Checkin = {
      id: crypto.randomUUID(),
      householdId: input.householdId,
      grade: input.grade ?? (await this.initialGrade()),
      summaryText: null,
      thread: [],
      startedAt: this.now(),
    };
    this.checkins.set(checkin.id, checkin);
    return checkin;
  }

  private async initialGrade(): Promise<Grade> {
    return "low";
  }

  async updateCheckin(
    id: string,
    patch: { grade?: Grade; summaryText?: string; thread?: Checkin["thread"] }
  ): Promise<Checkin | null> {
    const checkin = this.checkins.get(id) ?? null;
    if (!checkin) return null;
    Object.assign(checkin, patch);
    return checkin;
  }

  async getCheckin(id: string): Promise<Checkin | null> {
    return this.checkins.get(id) ?? null;
  }

  async getCheckinsForHousehold(householdId: string): Promise<Checkin[]> {
    return [...this.checkins.values()]
      .filter((c) => c.householdId === householdId)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async addSymptomEvent(input: {
    checkinId: string;
    description: string;
    severity: Grade;
  }): Promise<SymptomEvent> {
    const ev: SymptomEvent = { id: crypto.randomUUID(), ...input };
    this.symptomEvents.push(ev);
    return ev;
  }

  async addAction(input: {
    checkinId: string;
    tool: ToolName;
    status?: ToolStatus;
    payload: Record<string, string | number | boolean | undefined>;
  }): Promise<ActionReceipt> {
    const receipt: ActionReceipt = {
      id: crypto.randomUUID(),
      checkinId: input.checkinId,
      tool: input.tool,
      status: input.status ?? "succeeded",
      payload: input.payload,
      createdAt: this.now(),
    };
    this.actions.push(receipt);
    return receipt;
  }

  async getActionsForCheckin(checkinId: string): Promise<ActionReceipt[]> {
    return this.actions.filter((a) => a.checkinId === checkinId);
  }

  async getOpenAppointments(householdId: string): Promise<Appointment[]> {
    return this.appointments.filter(
      (a) => a.householdId === householdId && a.status === "hold"
    );
  }

  async getAppointments(householdId: string): Promise<Appointment[]> {
    return this.appointments
      .filter((a) => a.householdId === householdId)
      .sort((a, b) => a.slot.localeCompare(b.slot));
  }

  async bookAppointment(
    appointmentId: string,
    via: "web" | "phone",
    callId?: string
  ): Promise<Appointment | null> {
    const apt = this.appointments.find((a) => a.id === appointmentId) ?? null;
    if (!apt || apt.status !== "hold") return null;
    apt.status = "booked";
    apt.via = via;
    apt.bookedByCallId = callId ?? null;
    return apt;
  }

  async createCall(input: {
    householdId: string;
    purpose: CallPurpose;
    toNumber: string;
    providerCallSid?: string;
  }): Promise<CallRecord> {
    const call: CallRecord = {
      id: crypto.randomUUID(),
      householdId: input.householdId,
      purpose: input.purpose,
      providerCallSid: input.providerCallSid ?? null,
      toNumber: input.toNumber,
      status: "ringing",
      transcript: [],
      startedAt: this.now(),
    };
    this.calls.push(call);
    return call;
  }

  async updateCallStatus(
    providerCallSid: string,
    status: CallStatus,
    transcriptTurn?: { role: "cura" | "other"; text: string }
  ): Promise<CallRecord | null> {
    const call = this.calls.find((c) => c.providerCallSid === providerCallSid) ?? null;
    if (!call) return null;
    call.status = status;
    if (transcriptTurn) call.transcript.push(transcriptTurn);
    return call;
  }

  async getCallBySid(providerCallSid: string): Promise<CallRecord | null> {
    return this.calls.find((c) => c.providerCallSid === providerCallSid) ?? null;
  }

  async getCallLog(householdId: string): Promise<CallRecord[]> {
    return this.calls.filter((c) => c.householdId === householdId);
  }

  async getNotifications(householdId: string): Promise<CaregiverNotification[]> {
    return this.notifications
      .filter((n) => n.householdId === householdId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createNotification(input: {
    householdId: string;
    checkinId?: string;
    level: CaregiverNotification["level"];
    message: string;
  }): Promise<CaregiverNotification> {
    const n: CaregiverNotification = {
      id: crypto.randomUUID(),
      householdId: input.householdId,
      checkinId: input.checkinId ?? null,
      level: input.level,
      message: input.message,
      acknowledged: false,
      createdAt: this.now(),
    };
    this.notifications.unshift(n);
    return n;
  }

  async acknowledgeNotification(id: string): Promise<CaregiverNotification | null> {
    const n = this.notifications.find((x) => x.id === id) ?? null;
    if (n) n.acknowledged = true;
    return n;
  }
}

/** DEMO MODE guard: mock when explicitly set, or when Supabase envs absent (never crash the demo). */
export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "1" || !process.env.NEXT_PUBLIC_SUPABASE_URL;
}

let mockSingleton: MockStore | null = null;
let supabaseSingleton: SupabaseStore | null = null;

const EXPORTED_DEMO_HOUSEHOLD_ID = DEMO_HOUSEHOLD_ID;

export { EXPORTED_DEMO_HOUSEHOLD_ID as DEMO_HOUSEHOLD_ID };

export function getStore(): CuraStore {
  if (isDemoMode()) return (mockSingleton ??= new MockStore());
  return (supabaseSingleton ??= new SupabaseStore());
}
