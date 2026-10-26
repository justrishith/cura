// Shared types for Cura. Server + client both import; keep this dependency-free.
// Per RULES.md: naming camelCase for members, no `any`.

export type Grade = "low" | "medium" | "high" | "crisis";

export type ToolName =
  | "log_symptom"
  | "check_meds"
  | "request_refill"
  | "book_appointment"
  | "notify_caregiver"
  | "crisis_alert"
  | "schedule_telephone_call"
  | "finalize_checkin";

export type ToolStatus = "succeeded" | "scheduled" | "failed";

export type RefillStatus = "ok" | "requested" | "ordered";

export type AppointmentStatus = "hold" | "booked" | "kept" | "unused";

export type CallPurpose = "clinic_booking" | "crisis_outreach";

export type CallStatus = "ringing" | "in-progress" | "completed" | "failed";

export type NotificationLevel = "info" | "urgent" | "crisis";

export type Role = "patient" | "caregiver";

export interface Household {
  id: string;
  name: string;
  clinicPhone: string | null;
  emergencyPhone: string | null;
}

export interface Profile {
  userId: string;
  displayName: string;
  role: Role;
  householdId: string;
}

export interface Medication {
  id: string;
  householdId: string;
  name: string;
  dosage: string | null;
  refillStatus: RefillStatus;
  lastRefillAt: string | null; // ISO
}

export interface Checkin {
  id: string;
  householdId: string;
  grade: Grade;
  summaryText: string | null;
  thread: { role: "cura" | "patient"; text: string }[];
  /** Gemini Interactions API id — chained with previous_interaction_id across turns. */
  interactionId?: string | null;
  startedAt: string; // ISO
}

export interface SymptomEvent {
  id: string;
  checkinId: string;
  description: string;
  severity: Grade;
}

export interface ActionReceipt {
  id: string;
  checkinId: string;
  tool: ToolName;
  status: ToolStatus;
  payload: Record<string, string | number | boolean | undefined>;
  createdAt: string; // ISO
}

export interface Appointment {
  id: string;
  householdId: string;
  provider: string;
  slot: string; // ISO
  status: AppointmentStatus;
  via: "web" | "phone";
  bookedByCallId: string | null;
}

export interface CallRecord {
  id: string;
  householdId: string;
  purpose: CallPurpose;
  providerCallSid: string | null;
  toNumber: string;
  status: CallStatus;
  transcript: { role: "cura" | "other"; text: string }[];
  startedAt: string; // ISO
}

export interface CaregiverNotification {
  id: string;
  householdId: string;
  checkinId: string | null;
  level: NotificationLevel;
  message: string;
  acknowledged: boolean;
  createdAt: string; // ISO
}

/** One full agent turn response to the patient console. */
export interface AgentTurnResult {
  reply: string; // spoken/text reply from Cura
  grade: Grade; // grade so far for the running check-in
  receipts: ActionReceipt[]; // tools fired this turn (render as ActionCards)
  checkinId: string;
  callOffer: CallOffer | null; // set when grade === high (consent-gated)
  crisis: boolean; // true when the scripted crisis path fired
}

export interface CallOffer {
  type: CallPurpose;
  provider: string; // display name, e.g. "Dr. Chen's office"
}

/** Turn input from client to /api/agent. */
export interface AgentTurnInput {
  householdId: string;
  checkinId: string | null; // null = start a new check-in
  message: string;
  history: { role: "cura" | "patient"; text: string }[];
}
