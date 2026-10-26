// tools.ts — tool implementations + tier orchestration. SERVER-ONLY.
// The model only *proposes* tool calls; this file executes them through store.ts
// and enforces tier-required receipts deterministically (PRD grade→action map).

import type {
  ActionReceipt,
  Checkin,
  Grade,
  ToolName,
  ToolStatus,
} from "./types";
import { getStore } from "./store";
import { fireOutboundCall } from "./telephony";
import { HEALTH_TIPS, tipPhraseFor, type HealthTipKind } from "./health-tips";

/** What the model proposes: a tool call parsed from an Interactions step. */
export interface ProposedCall {
  name: ToolName | "submit_checkin_grade";
  args: Record<string, unknown>;
  callId?: string;
}

export interface ExecutionContext {
  householdId: string;
  checkin: Checkin;
  patientName: string;
}

const SEVERITY_MAP: Record<string, Grade> = {
  mild: "low",
  low: "low",
  moderate: "medium",
  medium: "medium",
  severe: "high",
  high: "high",
  critical: "crisis",
  crisis: "crisis",
};

function normGrade(v: unknown): Grade {
  const key = typeof v === "string" ? v.toLowerCase() : "";
  return SEVERITY_MAP[key] ?? "low";
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function slotReadable(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Execute one proposed call. Returns a receipt for real tools; null for control calls. */
export async function executeProposedCall(
  call: ProposedCall,
  ctx: ExecutionContext
): Promise<ActionReceipt | null> {
  const store = getStore();

  switch (call.name) {
    case "log_symptom": {
      const description = str(call.args.description) || "reported discomfort";
      const ev = await store.addSymptomEvent({
        checkinId: ctx.checkin.id,
        description,
        severity: normGrade(call.args.severity),
      });
      return store.addAction({
        checkinId: ctx.checkin.id,
        tool: "log_symptom",
        payload: { description: ev.description, severity: ev.severity },
      });
    }

    case "check_meds": {
      const meds = await store.getMedications(ctx.householdId);
      return store.addAction({
        checkinId: ctx.checkin.id,
        tool: "check_meds",
        payload: {
          meds: meds.map((m) => `${m.name} (${m.refillStatus})`).join("; "),
        },
      });
    }

    case "log_med_taken": {
      const medName = str(call.args.med_name);
      const taken = call.args.taken === true;
      const note = str(call.args.note) || undefined;
      const meds = await store.getMedications(ctx.householdId);
      const needle = medName.toLowerCase();
      const matched = meds.find((m) => m.name.toLowerCase().includes(needle)) ?? meds[0] ?? null;
      const matchedId = matched ? matched.id : "unknown";
      return store.addAction({
        checkinId: ctx.checkin.id,
        tool: "log_med_taken",
        status: "succeeded" as ToolStatus,
        payload: {
          med_name: medName,
          taken,
          note: note ?? undefined,
          matched_id: matchedId,
        },
      });
    }

    case "request_refill": {
      const meds = await store.getMedications(ctx.householdId);
      const needle = str(call.args.med_name).toLowerCase();
      const med =
        meds.find((m) => m.name.toLowerCase().includes(needle)) ??
        meds.find((m) => m.refillStatus === "ok");
      if (!med) {
        return store.addAction({
          checkinId: ctx.checkin.id,
          tool: "request_refill",
          status: "failed" as ToolStatus,
          payload: { error: "no matching medication" },
        });
      }
      await store.setRefillStatus(med.id, "requested");
      const existing = (await store.getActionsForCheckin(ctx.checkin.id)).find(
        (a) => a.tool === "request_refill" && a.payload.med === med.name
      );
      if (existing) {
        // idempotent: asking twice per check-in shouldn't double-book the pharmacy
        return existing;
      }
      return store.addAction({
        checkinId: ctx.checkin.id,
        tool: "request_refill",
        payload: { med: med.name, dosage: med.dosage ?? "", refill_status: "requested" },
      });
    }

    case "book_appointment": {
      const open = await store.getOpenAppointments(ctx.householdId);
      const prefProvider = str(call.args.provider).toLowerCase();
      const apt =
        open.find((a) => a.provider.toLowerCase().includes(prefProvider)) ?? open[0];
      if (!apt) {
        return store.addAction({
          checkinId: ctx.checkin.id,
          tool: "book_appointment",
          status: "failed" as ToolStatus,
          payload: { error: "no open slots" },
        });
      }
      const booked = await store.bookAppointment(apt.id, "web");
      return store.addAction({
        checkinId: ctx.checkin.id,
        tool: "book_appointment",
        status: booked ? "succeeded" : "failed",
        payload: {
          provider: apt.provider,
          slot: slotReadable(apt.slot),
          slot_iso: apt.slot,
        },
      });
    }

    case "notify_caregiver": {
      const level = str(call.args.level) === "info" ? "info" : "urgent";
      const message =
        (str(call.args.message) || `${ctx.patientName} needs attention.`) +
        " To speak with Cura about her now, call (567) 405-1070.";
      await store.createNotification({
        householdId: ctx.householdId,
        checkinId: ctx.checkin.id,
        level,
        message,
      });
      return store.addAction({
        checkinId: ctx.checkin.id,
        tool: "notify_caregiver",
        payload: { level, message },
      });
    }

    case "crisis_alert": {
      await store.createNotification({
        householdId: ctx.householdId,
        checkinId: ctx.checkin.id,
        level: "crisis",
        message: str(call.args.message) || `Emergency concern reported: ${str(call.args.concern)}`,
      });
      // Record what actually happened at Twilio — never a placebo "fired".
      const callResult = await fireOutboundCall("crisis_outreach", ctx.householdId, {
        patientName: ctx.patientName,
        concern: str(call.args.concern),
      });
      return store.addAction({
        checkinId: ctx.checkin.id,
        tool: "crisis_alert",
        payload: {
          concern: str(call.args.concern),
          outreach: callResult.fired ? "fired" : "not_fired",
          ...(callResult.providerSid ? { provider_call_sid: callResult.providerSid } : {}),
          ...(callResult.mode ? { mode: callResult.mode } : {}),
          ...(callResult.reason ? { reason: callResult.reason } : {}),
        },
      });
    }

    case "submit_checkin_grade": {
      const grade = normGrade(call.args.grade) === "low" && call.args.grade === "low"
        ? "low"
        : normGrade(call.args.grade);
      await store.updateCheckin(ctx.checkin.id, { grade });
      // control tool: no ActionCard receipt
      return null;
    }

    case "suggest_health_tip": {
      const kind = str(call.args.kind) as HealthTipKind;
      // Phrase is always the FIXED server-side text — never model-composed advice
      const phrase = tipPhraseFor(kind) ?? HEALTH_TIPS[0].phrase;
      return store.addAction({
        checkinId: ctx.checkin.id,
        tool: "suggest_health_tip",
        payload: { kind, phrase },
      });
    }

    default:
      return null;
  }
}

/** Server-side tier enforcement — the grade map from PRD, applied AFTER the model loop. */
export async function ensureTierReceipts(
  grade: Grade,
  ctx: ExecutionContext
): Promise<ActionReceipt[]> {
  const store = getStore();
  const existing = await store.getActionsForCheckin(ctx.checkin.id);
  const missing: ActionReceipt[] = [];

  if (grade === "high") {
    const hasNotify = existing.some((a) => a.tool === "notify_caregiver");
    if (!hasNotify) {
      const pushed = await executeProposedCall(
        {
          name: "notify_caregiver",
          args: {
            level: "urgent",
            message: `${ctx.patientName}'s check-in was graded urgent — please check in on her. To speak with Cura about her now, call (567) 405-1070.`,
          },
        },
        ctx
      );
      if (pushed) missing.push(pushed);
    }
  }
  return missing.filter((a): a is ActionReceipt => Boolean(a));
}

/**
 * Deterministic crisis path — runs in /api/agent BEFORE any model call.
 * Scripted reply (never generated), receipt, notification, emergency-contact call.
 */
export async function runCrisisPath(
  concern: string,
  ctx: ExecutionContext
): Promise<ActionReceipt[]> {
  const store = getStore();
  const receipts: ActionReceipt[] = [];
  await store.updateCheckin(ctx.checkin.id, { grade: "crisis" });
  const alert = await executeProposedCall(
    { name: "crisis_alert", args: { concern, message: `Possible ${concern}. Immediate attention requested. To speak with Cura about her now, call (567) 405-1070. If this is an emergency, call 911.` } },
    ctx
  );
  if (alert) receipts.push(alert);
  return receipts;
}

/** Function declarations sent to Gemini each interaction — wire format per Interactions API. */
export const CURA_TOOLS: unknown[] = [
  {
    type: "function",
    name: "log_symptom",
    description: "Record a symptom the patient reported during this check-in. Call this whenever she describes how she feels.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "Plain description of the symptom in her words" },
        severity: {
          type: "string",
          enum: ["mild", "moderate", "severe", "critical"],
          description: "Your judgment of severity from her description",
        },
      },
      required: ["description", "severity"],
    },
  },
  {
    type: "function",
    name: "check_meds",
    description: "List the patient's medications and their current refill statuses.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    type: "function",
    name: "log_med_taken",
    description: "Record that the patient took (or skipped) a medication during this check-in.",
    parameters: {
      type: "object",
      properties: {
        med_name: { type: "string", description: "Medication name, e.g. Metformin" },
        taken: { type: "boolean", description: "true if she took it, false if skipped" },
        note: { type: "string", description: "Optional note about how it went" },
      },
      required: ["med_name", "taken"],
    },
  },
  {
    type: "function",
    name: "request_refill",
    description: "Request a prescription refill so she doesn't run out of a medication.",
    parameters: {
      type: "object",
      properties: {
        med_name: { type: "string", description: "Medication name, e.g. Metformin" },
      },
      required: ["med_name"],
    },
  },
  {
    type: "function",
    name: "book_appointment",
    description: "Book one of the pre-approved appointment slots with a clinic provider.",
    parameters: {
      type: "object",
      properties: {
        provider: { type: "string", description: "Optional provider preference, e.g. Dr. Chen or Dr. Patel" },
      },
      required: [],
    },
  },
  {
    type: "function",
    name: "notify_caregiver",
    description: "Send a message to the patient's family caregiver — it appears on the caregiver dashboard immediately.",
    parameters: {
      type: "object",
      properties: {
        level: { type: "string", enum: ["info", "urgent"], description: "urgent only when it cannot wait until tomorrow" },
        message: { type: "string", description: "Short, warm, complete summary for the family" },
      },
      required: ["message"],
    },
  },
  {
    type: "function",
    name: "crisis_alert",
    description: "EMERGENCY ONLY — top-priority alert to the caregiver plus an immediate outreach call. No patient confirmation needed.",
    parameters: {
      type: "object",
      properties: {
        concern: { type: "string", description: "Short emergency label, e.g. chest pain" },
        message: { type: "string", description: "What she reported, briefly" },
      },
      required: ["concern"],
    },
  },
  {
    type: "function",
    name: "suggest_health_tip",
    description: "Offer one safe, fixed encouragement from Cura's own list — movement, hydration, light, or rest. The phrase is always fixed server-side; never improvise medical advice.",
    parameters: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["movement", "hydration", "light", "rest"],
          description: "Category of nudge to offer",
        },
      },
      required: ["kind"],
    },
  },
  {
    type: "function",
    name: "submit_checkin_grade",
    description: "MANDATORY before finishing — submit your grade for how this check-in sounds overall.",
    parameters: {
      type: "object",
      properties: {
        grade: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "low = routine wellbeing; medium = needs a light action soon; high = needs doctor-level attention today",
        },
      },
      required: ["grade"],
    },
  },
];
