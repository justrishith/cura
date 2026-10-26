// api/agent — THE stateless agent endpoint. One request = one full check-in turn.
// Order of operations per ARCHITECTURE.md:
//   1. persist patient turn
//   2. crisis.ts regex prescreen → scripted crisis path (NO LLM)
//   3. Gemini Interactions loop (≤3 iterations of tool calls, server-executed)
//   4. tier enforcement (server ensures HIGH ⇒ caregiver notified)
//   5. persist receipts + thread + interactionId, return AgentTurnResult

import { NextRequest, NextResponse } from "next/server";
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import { preScreenCrisis, CRISIS_PATIENT_SCRIPT } from "@/lib/crisis";
import {
  createInteraction,
  functionResultStep,
  hasGeminiKey,
  type AgentStep,
} from "@/lib/gemini";
import {
  CURA_TOOLS,
  ensureTierReceipts,
  executeProposedCall,
  runCrisisPath,
  type ProposedCall,
} from "@/lib/tools";
import type { AgentTurnInput, AgentTurnResult, CallOffer, Grade, Medication, Appointment } from "@/lib/types";

const PATIENT_NAME = "Maria";

/** Cold-start-safe turn input: flattened recent thread so a lost interaction
 *  chain (serverless restart) still gives the model full context. */
function flattenThread(thread: { role: string; text: string }[]): string {
  return thread
    .slice(-8)
    .map((t) => `${t.role === "patient" ? "Patient" : "Cura"}: ${t.text}`)
    .join("\n");
}

function buildSystemPrompt(householdName: string, meds: Medication[], openSlots: Appointment[]): string {
  const medsLine = meds
    .map((m) => `${m.name} — ${m.dosage ?? ""} (refill: ${m.refillStatus})`)
    .join("; ");
  const slots = openSlots
    .map((a) => `${a.provider}: ${new Date(a.slot).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`)
    .join(" | ");

  return [
    `You are Cura, a warm automated care assistant for ${householdName}. You are talking to Maria, age 72.`,
    `You run a DAILY CHECK-IN. Your job: sound human, notice how she is, take helpful actions, and grade how she is doing.`,
    `Tone: plain English at an 8th-grade level, warm, short (under 60 words per reply — it is spoken aloud to an older adult). Never mention that you follow rules.`,
    `HARD RULES:`,
    `- You are NOT a doctor. Never diagnose, never give dosage or treatment advice. Route care: log it, tell the caregiver, book appointments, get a human involved.`,
    `- Never say "that's probably fine". If something could be serious, escalate.`,
    `- If she mentions emergency symptoms, stay calm and say you've alerted her caregiver and read the on-screen banner about calling 911.`,
    `TOOLS: use them freely. Always call log_symptom for anything she reports. Always call submit_checkin_grade before finishing your final reply (grade: low = routine wellbeing, medium = light action needed soon, high = needs doctor-level attention today).`,
    `If she says she ran out of medication or is low on pills, use request_refill.`,
    `When her grade is HIGH (or she needs a doctor soon): DO NOT call book_appointment yourself on the first turn. Instead offer THIS: "Want me to call Dr. Chen's office right now and get you on the calendar?" — the on-screen call button will handle dialing when she agrees, so never say you are dialing yet. Only web-book if she refuses the call but still wants an appointment. Always notify_caregiver urgently on the same turn you offered. Never re-book if an appointment exists.`,
    `HER MEDS: ${medsLine}`,
    `OPEN SLOTS: ${slots || "none today"}`,
  ].join("\n");
}

function turnReplyFallback(grade: Grade): string {
  switch (grade) {
    case "high":
      return "Thank you for telling me — I want a doctor to hear this in person, and your caregiver is being pinged right now.";
    case "medium":
      return "Thanks — I've noted it and taken care of the details.";
    case "crisis":
      return CRISIS_PATIENT_SCRIPT;
    default:
      return "Thank you for checking in with me. Rest well — I'll call again tomorrow.";
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as Partial<AgentTurnInput>;
    const message = (body.message ?? "").toString().trim();
    if (!message) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const store = getStore();
    const householdId = body.householdId ?? DEMO_HOUSEHOLD_ID;
    const household = await store.getHousehold(householdId);
    if (!household) {
      return NextResponse.json({ error: "household not found" }, { status: 404 });
    }

    let checkin = body.checkinId ? await store.getCheckin(body.checkinId) : null;
    if (!checkin) checkin = await store.createCheckin({ householdId });
    const ctx = { householdId, checkin, patientName: PATIENT_NAME };

    // 1) persist the patient's turn
    const thread = [...checkin.thread, { role: "patient" as const, text: message }];
    await store.updateCheckin(checkin.id, { thread });

    let receipts: AgentTurnResult["receipts"] = [];
    let grade: Grade = (await store.getCheckin(checkin.id))?.grade ?? "low";
    let reply = "";
    let crisisFired = false;

    // 2) deterministic crisis path — ALWAYS before any model call
    const crisisHit = preScreenCrisis(message);
    if (crisisHit) {
      receipts = await runCrisisPath(crisisHit.category, ctx);
      grade = "crisis";
      crisisFired = true;
      reply = CRISIS_PATIENT_SCRIPT;
    } else if (!hasGeminiKey()) {
      // 2b) demo brain without a key: record quietly so flows stay demoable
      reply =
        "Got it — noted for the family. This is offline demo mode: add the Gemini key to .env.local to hear my real voice.";
      grade = "low";
    } else {
      // 3) Gemini Interactions loop — server-executed tools, max 3 iterations
      const systemInstruction = buildSystemPrompt(
        household.name,
        await store.getMedications(householdId),
        await store.getOpenAppointments(householdId)
      );
      let interaction = null;
      let prevId: string | null = checkin.interactionId ?? null;
      let pendingResults: unknown[] = [];

      for (let iteration = 0; iteration < 3; iteration += 1) {
        interaction = await createInteraction({
          input: iteration === 0 ? flattenThread(thread) : pendingResults,
          tools: CURA_TOOLS,
          systemInstruction,
          previousId: prevId,
        });
        prevId = interaction.id;
        await store.updateCheckin(checkin.id, { interactionId: interaction.id });

        if (interaction.functionCalls.length === 0) break;

        pendingResults = [];
        for (const step of interaction.functionCalls as AgentStep[]) {
          const call: ProposedCall = {
            name: step.name as ProposedCall["name"],
            args: step.arguments ?? {},
            callId: step.id,
          };
          const receipt = await executeProposedCall(call, ctx);
          if (receipt) receipts.push(receipt);
          pendingResults.push(
            functionResultStep(call.name, call.callId ?? "", JSON.stringify(receipt ? { status: receipt.status } : { ok: true }))
          );
        }
        receipts = receipts; // accumulated above in-place
      }

      grade = (await store.getCheckin(checkin.id))?.grade ?? grade;
      reply = (interaction?.outputText ?? "").trim() || turnReplyFallback(grade);
    }

    // 4) tier enforcement after the model loop (HIGH ⇒ caregiver notified, etc.)
    const missing = await ensureTierReceipts(grade, ctx);
    receipts = [...receipts, ...missing];

    grade = (await store.getCheckin(checkin.id))?.grade ?? grade;
    reply = reply.trim() || turnReplyFallback(grade);

    // 5) persist cura turn + summary, then respond
    const finalThread = [...(thread ?? []), { role: "cura" as const, text: reply }];
    await store.updateCheckin(checkin.id, { thread: finalThread, summaryText: reply });

    const callOffer: CallOffer | null =
      grade === "high" && !crisisFired
        ? { type: "clinic_booking", provider: "Dr. Chen's office" }
        : null;

    const result: AgentTurnResult = {
      reply,
      grade,
      receipts,
      checkinId: checkin.id,
      callOffer,
      crisis: crisisFired,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/agent] turn failed:", err);
    return NextResponse.json(
      { error: "Agent turn failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
