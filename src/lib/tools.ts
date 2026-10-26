// tools.ts — Gemini function declarations + executors against CuraStore (parallel-session).
// Server-only. Every executed tool persists an ActionReceipt so the dashboard + UI show it.
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import type { ToolFunction } from "@/lib/gemini";
import type { ActionReceipt, Grade, Medication, ToolName, ToolStatus } from "@/lib/types";

export type ToolExecResult = {
  /** Compact result text fed back to the model. */
  text: string;
  /** Persisted receipt (already written to the store). */
  receipt?: ActionReceipt;
  /** finalize_checkin carries the terminal grade + spoken close-out. */
  grade?: Grade;
  summary?: string;
  whole?: boolean;
  /** schedule_telephone_call: route fires the actual triggerCall with this. */
  wantsCall?: "clinic_booking";
};

const label = (slot: string) =>
  new Date(slot).toLocaleString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const TOOL_DECLARATIONS: ToolFunction[] = [
  {
    type: "function",
    name: "log_symptom",
    description:
      "Log a symptom the patient reported, graded by impact on daily life. Not a diagnosis.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string", description: "What the patient told you, in their words" },
        severity: { type: "string", enum: ["low", "medium", "high"] },
      },
      required: ["description", "severity"],
    },
  },
  {
    type: "function",
    name: "check_meds",
    description: "Read the household's medication list and refill states.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "request_refill",
    description: "Request a refill for a named medication (mock pharmacy).",
    parameters: {
      type: "object",
      properties: { medication_name: { type: "string" } },
      required: ["medication_name"],
    },
  },
  {
    type: "function",
    name: "book_appointment",
    description:
      "Book one open clinic slot for the patient. Pass the slot's weekday hint like 'Tuesday'.",
    parameters: {
      type: "object",
      properties: { slot_day: { type: "string", description: "e.g. 'Tuesday'" } },
      required: ["slot_day"],
    },
  },
  {
    type: "function",
    name: "notify_caregiver",
    description: "Notify the family caregiver (in-app alert). Use level=urgent for concerning findings.",
    parameters: {
      type: "object",
      properties: {
        message: { type: "string", description: "One clear sentence for the caregiver" },
        level: { type: "string", enum: ["info", "urgent"] },
      },
      required: ["message", "level"],
    },
  },
  {
    type: "function",
    name: "schedule_telephone_call",
    description:
      "Place Cura's outbound call to the doctor's office to book the appointment. ONLY call this if the patient already said yes to calling. Crisis calls are dispatched automatically by the system and are never requested here.",
    parameters: {
      type: "object",
      properties: {
        purpose: { type: "string", enum: ["clinic_booking"] },
      },
      required: ["purpose"],
    },
  },
  {
    type: "function",
    name: "finalize_checkin",
    description:
      "Call ONCE at the very end of the turn with the overall grade and the kind spoken close-out. This ends the turn.",
    parameters: {
      type: "object",
      properties: {
        grade: { type: "string", enum: ["low", "medium", "high"], description: "crisis is assigned by the system only" },
        summary_text: { type: "string", description: "What Cura says to close the check-in, short and plain" },
      },
      required: ["grade", "summary_text"],
    },
  },
];

export async function executeToolCall(
  householdId: string,
  checkinId: string,
  name: string,
  args: Record<string, unknown>
): Promise<ToolExecResult> {
  const store = getStore();
  const hh = await store.getHousehold(householdId);
  const hhId = hh ? householdId : DEMO_HOUSEHOLD_ID;
  const at = () => new Date().toISOString();

  const mk = async (tool: ToolName, status: ToolStatus, payload: Record<string, string | number | boolean | undefined>): Promise<ActionReceipt> =>
    store.addAction({ checkinId, tool, status, payload });

  switch (name) {
    case "log_symptom": {
      const description = String(args.description ?? "unspecified");
      const severity = (args.severity === "low" || args.severity === "high" ? args.severity : "medium") as Grade;
      const ev = await store.addSymptomEvent({ checkinId, description, severity });
      const receipt = await mk("log_symptom", "succeeded", { description, severity });
      return { text: `logged "${description}" (severity ${severity}, event ${ev.id})`, receipt };
    }
    case "check_meds": {
      const meds = await store.getMedications(hhId);
      const receipt = await mk("check_meds", "succeeded", { count: meds.length });
      return {
        text: `medications: ${meds.map((m) => medLine(m)).join("; ") || "none on file"}`,
        receipt,
      };
    }
    case "request_refill": {
      const medName = String(args.medication_name ?? "");
      const meds = await store.getMedications(hhId);
      const med = meds.find((m) => m.name.toLowerCase().includes(medName.toLowerCase().split(" ")[0]));
      let statusText: string;
      if (med) {
        const updated = await store.setRefillStatus(med.id, "requested");
        statusText = `refill requested for ${updated?.name ?? med.name}`;
      } else {
        statusText = `no medication matching "${medName}" on file — tell the patient it needs to be added`;
      }
      const receipt: ActionReceipt = {
        id: crypto.randomUUID(),
        checkinId,
        tool: "request_refill",
        status: med ? "succeeded" : "failed",
        payload: { medication_name: medName },
        createdAt: at(),
      };
      if (med) {
        const persisted = await store.addAction({
          checkinId,
          tool: "request_refill",
          status: "succeeded",
          payload: { medication_name: med.name },
        });
        receipt.id = persisted.id;
      }
      return { text: statusText, receipt };
    }
    case "book_appointment": {
      const open = await store.getOpenAppointments(hhId);
      const want = String(args.slot_day ?? "").toLowerCase();
      const matched = want
        ? open.find((a) => label(a.slot).toLowerCase().includes(want.slice(0, 3)))
        : undefined;
      const picked = matched ?? open[0] ?? null;
      if (!picked || !picked.id) {
        const receipt = await store.addAction({ checkinId, tool: "book_appointment", status: "failed", payload: { reason: "no open slots" } });
        return { text: "there are no open slots right now", receipt };
      }
      const booked = await store.bookAppointment(picked.id, "web");
      const receipt = booked
        ? await store.addAction({ checkinId, tool: "book_appointment", status: "succeeded", payload: { provider: booked.provider, slot: label(booked.slot), appointment_id: booked.id } })
        : undefined;
      return {
        text: booked ? `booked ${booked.provider} — ${label(booked.slot)}` : "booking failed",
        receipt,
      };
    }
    case "notify_caregiver": {
      const message = String(args.message ?? "");
      const level = args.level === "urgent" ? "urgent" : "info";
      await store.createNotification({ householdId: hhId, checkinId, level, message });
      const receipt = await store.addAction({ checkinId, tool: "notify_caregiver", status: "succeeded", payload: { message, level } });
      return { text: `caregiver notified (${level})`, receipt };
    }
    case "schedule_telephone_call": {
      const receipt = await store.addAction({ checkinId, tool: "schedule_telephone_call", status: "scheduled", payload: { purpose: "clinic_booking" } });
      return { text: "phone call to the clinic is being placed now", receipt, wantsCall: "clinic_booking" };
    }
    case "finalize_checkin": {
      const grade = (args.grade === "low" || args.grade === "medium" || args.grade === "high" ? args.grade : "medium") as Grade;
      const summary = String(args.summary_text ?? "");
      return { text: `check-in finalized (${grade})`, grade, summary, whole: true };
    }
    default:
      return { text: `unknown tool "${name}"` };
  }
}

function medLine(m: Medication): string {
  return `${m.name} ${m.dosage ?? ""} (refill: ${m.refillStatus})`.trim();
}
