// /api/agent — THE stateless pipeline. One POST = one conversation turn:
// crisis prescreen → Gemini tool loop (≤3 rounds) → tier enforcement → persist → reply.
// Response shape: AgentTurnResult (src/lib/types.ts). Server-only.
import { NextResponse } from "next/server";
import type { AgentTurnInput, AgentTurnResult, CallOffer } from "@/lib/types";
import { preScreenCrisis, CRISIS_PATIENT_SCRIPT, CRISIS_GRADE } from "@/lib/crisis";
import { createInteraction, sendFunctionResults } from "@/lib/gemini";
import { TOOL_DECLARATIONS, executeToolCall, type ToolExecResult } from "@/lib/tools";
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import { triggerCall } from "@/lib/telephony";

const MAX_TOOL_ROUNDS = 3;

function systemInstruction(h: { patientName: string; medsSummary: string; slotsSummary: string }): string {
  return [
    `You are Cura, a warm, plain-spoken (9th-grade-or-easier, short sentences) AI companion doing a periodic WELLNESS CHECK-IN for ${h.patientName}, an older adult managing health at home.`,
    "You are NOT a doctor. Never diagnose, never mention dosages, never give medical instructions beyond general encouragement. Serious, worsening, or persistent symptoms get routed to a real clinician — that's what the tools are for.",
    "Tone: kind, unhurried, respectful. One to three short sentences per turn. A friendly nurse at the clinic front desk, not a chatbot.",
    "Never speculate on emergency symptoms; stay calm and end the turn — the scripted safety layer covers emergencies.",
    `Facts you may use — Medications: ${h.medsSummary}. Open appointment slots: ${h.slotsSummary}.`,
    "Tool policy:",
    "- Log every notable symptom with log_symptom.",
    "- If medication is running out or was missed: check_meds, then request_refill.",
    "- If symptoms sound concerning (new + several days, or she sounds frightened): offer the doctor visit in words — 'Want me to call the doctor's office and get you on their calendar?' — and ONLY if she says yes, call schedule_telephone_call with purpose=clinic_booking.",
    "- notify_caregiver for anything medium-or-worse.",
    "- ALWAYS end the turn by calling finalize_checkin (grade low/medium/high + short spoken summary).",
    "Grades: low = ordinary life; medium = new/worsening symptom worth a doctor soon; high = needs action today (refill, or she agreed to the phone call).",
  ].join("\n");
}

function summaries(store: ReturnType<typeof getStore>) {
  return { store };
}

function flattenHistory(input: AgentTurnInput): string {
  const t = input.history
    .slice(-8)
    .map((x) => `${x.role === "patient" ? "Patient" : "Cura"}: ${x.text}`)
    .join("\n");
  return t
    ? `Conversation so far:\n${t}\n\nLatest patient message: "${input.message}"`
    : `Latest patient message: "${input.message}"`;
}

async function ensureCheckin(input: AgentTurnInput) {
  const store = getStore();
  if (input.checkinId) {
    const existing = await store.getCheckin(input.checkinId);
    if (existing && existing.householdId === input.householdId) return existing;
  }
  return store.createCheckin({ householdId: input.householdId });
}

function receiptsAreHealthy(r: { status: string }) {
  return r.status === "succeeded" || r.status === "scheduled";
}

export async function POST(req: Request) {
  let input: AgentTurnInput;
  try {
    input = (await req.json()) as AgentTurnInput;
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const message = String(input.message ?? "").trim();
  if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

  const store = getStore();
  const hhId = (await store.getHousehold(input.householdId)) ? input.householdId : DEMO_HOUSEHOLD_ID;
  const hh = await store.getHousehold(hhId);
  if (!hh) return NextResponse.json({ error: "unknown household" }, { status: 404 });

  // ── 1) Crisis prescreen — deterministic, before any model call (RULES.md)
  const crisis = preScreenCrisis(message);
  if (crisis) {
    const checkin = await ensureCheckin(input);
    await store.updateCheckin(checkin.id, {
      grade: CRISIS_GRADE,
      summaryText: CRISIS_PATIENT_SCRIPT,
      thread: [...checkin.thread, { role: "patient", text: message }, { role: "cura", text: CRISIS_PATIENT_SCRIPT }],
    });
    const alert = await store.addAction({ checkinId: checkin.id, tool: "crisis_alert", status: "succeeded", payload: { category: crisis.category } });
    await store.createNotification({
      householdId: hhId,
      checkinId: checkin.id,
      level: "crisis",
      message: `Crisis alert (${crisis.category}) — auto-call placed to the emergency contact line.`,
    });
    const call = await triggerCall(hhId, "crisis_outreach", crisis.category).catch(() => null);

    const result: AgentTurnResult = {
      reply: CRISIS_PATIENT_SCRIPT,
      grade: "crisis",
      receipts: [alert],
      checkinId: checkin.id,
      callOffer: null,
      crisis: true,
    };
    void call;
    return NextResponse.json(result);
  }

  // ── 2) Gemini tool loop (≤3 rounds)
  const medsSummary =
    (await store.getMedications(hhId))
      .map((m) => `${m.name} (${m.dosage ?? ""}, refill ${m.refillStatus})`.trim())
      .join("; ") || "none on file";
  const slots = await store.getOpenAppointments(hhId);
  const slotsSummary =
    slots.map((s) => new Date(s.slot).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })).join(" | ") || "none";
  const sys = systemInstruction({ patientName: "Maria", medsSummary, slotsSummary });

  const checkin = await ensureCheckin(input);
  const receipts: AgentTurnResult["receipts"] = [];
  let grade: AgentTurnResult["grade"] = "low";
  let summary: string | null = null;
  let reply: string | null = null;
  let callFired = false;

  try {
    let exchange = await createInteraction({
      input: flattenHistory({ ...input, householdId: hhId }),
      tools: TOOL_DECLARATIONS,
      systemInstruction: sys,
    });

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (exchange.calls.length === 0) break;
      const results: ToolExecResult[] = [];
      for (const call of exchange.calls) {
        const r = await executeToolCall(hhId, checkin.id, call.name, call.arguments);
        results.push(r);
        if (r.receipt && receiptsAreHealthy(r.receipt)) receipts.push(r.receipt);
        if (r.wantsCall && !callFired) {
          callFired = true;
          const trigger = await triggerCall(hhId, "clinic_booking", "").catch(() => null);
          void trigger;
        }
      }
      const final = results.find((r) => r.whole);
      if (final) {
        if (final.grade) grade = final.grade;
        if (final.summary) summary = final.summary;
        reply = final.summary ?? final.text;
        break;
      }
      if (exchange.interactionId == null) break;
      exchange = await sendFunctionResults({
        previousInteractionId: exchange.interactionId,
        results: exchange.calls.map((c, i) => ({ name: c.name, callId: c.callId, text: results[i]?.text ?? "ok" })),
        tools: TOOL_DECLARATIONS,
        systemInstruction: sys,
      });
    }

    if (reply == null) reply = exchange.text ?? "Okay — noted. Anything else on your mind today?";
    if (summary == null) summary = reply;

    // Tier enforcement (deterministic bumps, server-side):
    if (grade === "low" && callFired) grade = "high";
    if (grade === "low" && receipts.some((r) => r.tool === "request_refill")) grade = "medium";
    if (grade === "medium" && receipts.some((r) => r.tool === "schedule_telephone_call")) grade = "high";
  } catch (err) {
    const degraded = err instanceof Error ? err.message : "unknown";
    const thread = [...input.history.slice(-6), { role: "patient" as const, text: message }];
    await store.updateCheckin(checkin.id, { thread });
    return NextResponse.json({
      reply:
        "I hit a small snag reaching my notes, but nothing urgent in what you said. Let's pick this up in a minute — anything else to tell me?",
      grade: "low",
      receipts,
      checkinId: checkin.id,
      callOffer: null,
      crisis: false,
      degraded,
    } satisfies AgentTurnResult & { degraded?: string });
  }

  // ── 3) Persist the turn + tier outputs
  await store.updateCheckin(checkin.id, {
    grade,
    summaryText: summary,
    thread: [...input.history.slice(-6), { role: "patient", text: message }, { role: "cura", text: summary }],
  });

  if (grade === "medium" || grade === "high") {
    await store.createNotification({
      householdId: hhId,
      checkinId: checkin.id,
      level: grade === "high" ? "urgent" : "info",
      message: `${hh.name}: check-in graded ${grade.toUpperCase()} — ${summary ?? ""}`,
    });
  }

  void summaries(store);
  const callOffer: CallOffer | null =
    !callFired && grade === "high" ? { type: "clinic_booking", provider: "Dr. Chen's office" } : null;

  const result: AgentTurnResult = { reply, grade, receipts, checkinId: checkin.id, callOffer, crisis: false };
  return NextResponse.json(result);
}
