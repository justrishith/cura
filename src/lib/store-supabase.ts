// store-supabase.ts — PostgREST-backed CuraStore for the SUPABASE_SERVICE_ROLE_KEY path.
// Server-only; bypasses RLS by design (service key). Wire format = snake_case via REST,
// camelCase in app types. interactionId is deliberately not persisted (schema keeps it
// out); chaining still works per-process and the flattened-thread input covers restarts.
import type {
  ActionReceipt,
  Appointment,
  AppointmentStatus,
  CallPurpose,
  CallRecord,
  CallStatus,
  CaregiverNotification,
  Checkin,
  Grade,
  Household,
  Medication,
  NotificationLevel,
  RefillStatus,
  SymptomEvent,
  ToolName,
  ToolStatus,
} from "./types";
import type { CuraStore } from "./store";

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1`;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const HEADERS = (): Record<string, string> => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
});

async function sb<T = unknown[]>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  table: string,
  search?: string,
  body?: unknown
): Promise<T> {
  const url = `${BASE}/${table}${search ? `?${search}` : ""}`;
  // PostgREST only echoes inserted/updated/deleted rows when asked to. Without
  // this header, POST/PATCH return 201/200 with an EMPTY body and res.json()
  // explodes ("Unexpected end of JSON input") inside every route that inserts.
  const res = await fetch(url, {
    method,
    headers: method === "GET" ? HEADERS() : { ...HEADERS(), Prefer: "return=representation" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${method} ${table} → ${res.status} ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return [] as T;
  const text = await res.text();
  if (text.trim() === "") {
    throw new Error(`Supabase ${method} ${table} → ${res.status} EMPTY BODY (add Prefer: return=representation or select=*)`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Supabase ${method} ${table} → ${res.status} unparseable body: ${text.slice(0, 200)}`);
  }
}

const one = <T extends Record<string, unknown>>(rows: T[]): T | null => rows[0] ?? null;

// ---- row ↔ type mappers (snake_case → camelCase) ----------------------------

function rowToHousehold(r: Record<string, unknown>): Household {
  return {
    id: String(r.id),
    name: String(r.name),
    clinicPhone: r.clinic_phone == null ? null : String(r.clinic_phone),
    emergencyPhone: r.emergency_contact_phone == null ? null : String(r.emergency_contact_phone),
  };
}

function rowToMedication(r: Record<string, unknown>): Medication {
  return {
    id: String(r.id),
    householdId: String(r.household_id),
    name: String(r.name),
    dosage: r.dosage == null ? null : String(r.dosage),
    refillStatus: String(r.refill_status) as RefillStatus,
    lastRefillAt: r.last_refill_at == null ? null : String(r.last_refill_at),
  };
}

function rowToCheckin(r: Record<string, unknown>): Checkin {
  return {
    id: String(r.id),
    householdId: String(r.household_id),
    grade: String(r.grade) as Grade,
    summaryText: r.summary_text == null ? null : String(r.summary_text),
    thread: Array.isArray(r.thread) ? (r.thread as Checkin["thread"]) : [],
    interactionId: null,
    startedAt: String(r.started_at),
  };
}

function rowToReceipt(r: Record<string, unknown>): ActionReceipt {
  return {
    id: String(r.id),
    checkinId: String(r.checkin_id),
    tool: String(r.tool) as ToolName,
    status: String(r.status) as ToolStatus,
    payload: (r.payload ?? {}) as ActionReceipt["payload"],
    createdAt: String(r.created_at),
  };
}

function rowToAppointment(r: Record<string, unknown>): Appointment {
  return {
    id: String(r.id),
    householdId: String(r.household_id),
    provider: String(r.provider),
    slot: String(r.slot),
    status: String(r.status) as AppointmentStatus,
    via: String(r.via) as Appointment["via"],
    bookedByCallId: r.booked_by_call_id == null ? null : String(r.booked_by_call_id),
  };
}

function rowToCall(r: Record<string, unknown>): CallRecord {
  return {
    id: String(r.id),
    householdId: String(r.household_id),
    purpose: String(r.purpose) as CallPurpose,
    providerCallSid: r.provider_call_sid == null ? null : String(r.provider_call_sid),
    toNumber: String(r.to_number),
    status: String(r.status) as CallStatus,
    transcript: Array.isArray(r.transcript) ? (r.transcript as CallRecord["transcript"]) : [],
    startedAt: String(r.started_at),
  };
}

function rowToNotification(r: Record<string, unknown>): CaregiverNotification {
  return {
    id: String(r.id),
    householdId: String(r.household_id),
    checkinId: r.checkin_id == null ? null : String(r.checkin_id),
    level: String(r.level) as NotificationLevel,
    message: String(r.message),
    acknowledged: Boolean(r.acknowledged),
    createdAt: String(r.created_at),
  };
}

export class SupabaseStore implements CuraStore {
  async getHousehold(id: string): Promise<Household | null> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "households",
      `select=*&id=eq.${encodeURIComponent(id)}`
    );
    return one(rows) ? rowToHousehold(one(rows)!) : null;
  }

  async getMedications(householdId: string): Promise<Medication[]> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "medications",
      `select=*&household_id=eq.${householdId}&order=name.asc`
    );
    return rows.map(rowToMedication);
  }

  async setRefillStatus(medId: string, status: RefillStatus): Promise<Medication | null> {
    const rows = await sb<Record<string, unknown>[]>(
      "PATCH",
      "medications",
      `select=*&id=eq.${medId}`,
      { refill_status: status, last_refill_at: new Date().toISOString() }
    );
    return one(rows) ? rowToMedication(one(rows)!) : null;
  }

  async createCheckin(input: { householdId: string; grade?: Grade }): Promise<Checkin> {
    const rows = await sb<Record<string, unknown>[]>(
      "POST",
      "checkins",
      "select=*",
      { household_id: input.householdId, grade: input.grade ?? "low", thread: [] }
    );
    return rowToCheckin(one(rows)!);
  }

  async updateCheckin(
    id: string,
    patch: { grade?: Grade; summaryText?: string; thread?: Checkin["thread"]; interactionId?: string | null }
  ): Promise<Checkin | null> {
    const body: Record<string, unknown> = {};
    if (patch.grade !== undefined) body.grade = patch.grade;
    if (patch.summaryText !== undefined) body.summary_text = patch.summaryText;
    if (patch.thread !== undefined) body.thread = patch.thread;
    // interactionId intentionally not persisted (see header comment)
    if (Object.keys(body).length === 0) return this.getCheckin(id);
    const rows = await sb<Record<string, unknown>[]>("PATCH", "checkins", `select=*&id=eq.${id}`, body);
    return one(rows) ? rowToCheckin(one(rows)!) : null;
  }

  async getCheckin(id: string): Promise<Checkin | null> {
    const rows = await sb<Record<string, unknown>[]>("GET", "checkins", `select=*&id=eq.${id}`);
    return one(rows) ? rowToCheckin(one(rows)!) : null;
  }

  async getCheckinsForHousehold(householdId: string): Promise<Checkin[]> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "checkins",
      `select=*&household_id=eq.${householdId}&order=started_at.desc&limit=50`
    );
    return rows.map(rowToCheckin);
  }

  async addSymptomEvent(input: { checkinId: string; description: string; severity: Grade }): Promise<SymptomEvent> {
    const rows = await sb<Record<string, unknown>[]>(
      "POST",
      "symptom_events",
      "select=*",
      { checkin_id: input.checkinId, description: input.description, severity: input.severity }
    );
    const r = one(rows)!;
    return { id: String(r.id), checkinId: String(r.checkin_id), description: String(r.description), severity: String(r.severity) as Grade };
  }

  async addAction(input: {
    checkinId: string;
    tool: ToolName;
    status?: ToolStatus;
    payload: Record<string, string | number | boolean | undefined>;
  }): Promise<ActionReceipt> {
    const rows = await sb<Record<string, unknown>[]>(
      "POST",
      "actions",
      "select=*",
      { checkin_id: input.checkinId, tool: input.tool, status: input.status ?? "succeeded", payload: input.payload }
    );
    return rowToReceipt(one(rows)!);
  }

  async getActionsForCheckin(checkinId: string): Promise<ActionReceipt[]> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "actions",
      `select=*&checkin_id=eq.${checkinId}&order=created_at.asc`
    );
    return rows.map(rowToReceipt);
  }

  async getOpenAppointments(householdId: string): Promise<Appointment[]> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "appointments",
      `select=*&household_id=eq.${householdId}&status=eq.hold&order=slot.asc`
    );
    return rows.map(rowToAppointment);
  }

  async getAppointments(householdId: string): Promise<Appointment[]> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "appointments",
      `select=*&household_id=eq.${householdId}&order=slot.asc`
    );
    return rows.map(rowToAppointment);
  }

  async bookAppointment(appointmentId: string, via: "web" | "phone", callId?: string): Promise<Appointment | null> {
    const body: Record<string, unknown> = {
      status: "booked",
      via,
      ...(callId ? { booked_by_call_id: callId } : {}),
    };
    const rows = await sb<Record<string, unknown>[]>(
      "PATCH",
      "appointments",
      `select=*&id=eq.${appointmentId}&status=eq.hold`,
      body
    );
    return one(rows) ? rowToAppointment(one(rows)!) : null;
  }

  async createCall(input: {
    householdId: string;
    purpose: CallPurpose;
    toNumber: string;
    providerCallSid?: string;
  }): Promise<CallRecord> {
    const rows = await sb<Record<string, unknown>[]>(
      "POST",
      "calls",
      "select=*",
      {
        household_id: input.householdId,
        purpose: input.purpose,
        to_number: input.toNumber,
        provider_call_sid: input.providerCallSid ?? null,
        status: "ringing",
        transcript: [],
      }
    );
    return rowToCall(one(rows)!);
  }

  async updateCallStatus(
    providerCallSid: string,
    status: CallStatus,
    transcriptTurn?: { role: "cura" | "other"; text: string }
  ): Promise<CallRecord | null> {
    const existing = await this.getCallBySid(providerCallSid);
    if (!existing) return null;
    const transcript = transcriptTurn ? [...existing.transcript, transcriptTurn] : existing.transcript;
    const rows = await sb<Record<string, unknown>[]>(
      "PATCH",
      "calls",
      `select=*&provider_call_sid=eq.${providerCallSid}`,
      { status, transcript }
    );
    return one(rows) ? rowToCall(one(rows)!) : null;
  }

  async attachProviderSid(recordId: string, providerCallSid: string): Promise<CallRecord | null> {
    const rows = await sb<Record<string, unknown>[]>(
      "PATCH",
      "calls",
      `select=*&id=eq.${recordId}`,
      { provider_call_sid: providerCallSid }
    );
    return one(rows) ? rowToCall(one(rows)!) : null;
  }

  async getCallBySid(providerCallSid: string): Promise<CallRecord | null> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "calls",
      `select=*&provider_call_sid=eq.${providerCallSid}`
    );
    return one(rows) ? rowToCall(one(rows)!) : null;
  }

  async getCallLog(householdId: string): Promise<CallRecord[]> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "calls",
      `select=*&household_id=eq.${householdId}&order=started_at.desc&limit=30`
    );
    return rows.map(rowToCall);
  }

  async getNotifications(householdId: string): Promise<CaregiverNotification[]> {
    const rows = await sb<Record<string, unknown>[]>(
      "GET",
      "caregiver_notifications",
      `select=*&household_id=eq.${householdId}&order=created_at.desc&limit=30`
    );
    return rows.map(rowToNotification);
  }

  async createNotification(input: {
    householdId: string;
    checkinId?: string;
    level: CaregiverNotification["level"];
    message: string;
  }): Promise<CaregiverNotification> {
    const rows = await sb<Record<string, unknown>[]>(
      "POST",
      "caregiver_notifications",
      "select=*",
      {
        household_id: input.householdId,
        ...(input.checkinId ? { checkin_id: input.checkinId } : {}),
        level: input.level,
        message: input.message,
      }
    );
    return rowToNotification(one(rows)!);
  }

  async acknowledgeNotification(id: string): Promise<CaregiverNotification | null> {
    const rows = await sb<Record<string, unknown>[]>(
      "PATCH",
      "caregiver_notifications",
      `select=*&id=eq.${id}`,
      { acknowledged: true }
    );
    return one(rows) ? rowToNotification(one(rows)!) : null;
  }
}
