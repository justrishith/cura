import type { CuraStore } from "./store";
import type { Grade } from "./types";

export interface PatientBrief {
  forPrompt: string;
  forCard: {
    checkinsTotal: number;
    lastCheckin: string;
    learnedLines: string[];
    energyTrend: string;
  };
}

export async function buildPatientBrief(
  store: CuraStore,
  householdId: string,
  patientName: string
): Promise<PatientBrief> {
  const checkins = await store.getCheckinsForHousehold(householdId);
  const recent = checkins.slice(0, 5);

  const grades = recent.map((c) => c.grade);
  const summaries = recent.map((c) => c.summaryText ?? "").filter(Boolean);

  // Learn from actions on recent checkins
  const learnedLines: string[] = [];
  const symptomsSeen = new Map<string, number>();
  const symptomDescriptions: string[] = [];

  for (const c of recent) {
    const receipts = await store.getActionsForCheckin(c.id);
    for (const r of receipts) {
      if (r.tool === "log_symptom") {
        const desc = String(r.payload?.description ?? r.payload?.symptom ?? "").trim();
        if (desc) {
          symptomsSeen.set(desc, (symptomsSeen.get(desc) ?? 0) + 1);
          symptomDescriptions.push(desc);
        }
      } else if (r.tool === "check_meds" && r.status === "succeeded") {
        learnedLines.push("meds checked");
      } else if (r.tool === "request_refill" && r.status === "scheduled") {
        learnedLines.push("refill requested (open loop)");
      } else if (r.tool === "book_appointment" && r.status === "scheduled") {
        learnedLines.push("appointment booked");
      } else if (r.tool === "schedule_telephone_call" && r.status === "scheduled") {
        learnedLines.push("call scheduled");
      }
    }
  }

  // Same symptom description in >=2 recent checkins => continued symptom line
  for (const [desc, count] of symptomsSeen.entries()) {
    if (count >= 2) {
      const existing = learnedLines.find((l) => l.startsWith("continued symptom"));
      if (!existing) {
        learnedLines.push(`continued symptom: ${desc}`);
      }
    } else {
      const existing = learnedLines.find((l) => l.startsWith("symptom"));
      if (!existing && desc) {
        learnedLines.push(`symptom: ${desc}`);
      }
    }
  }

  // Unused refill => open loop line (check meds/actions for requested status)
  const openApps = await store.getOpenAppointments(householdId);
  if (openApps.length > 0) {
    learnedLines.push(`open appointment slots: ${openApps.length}`);
  }

  // Deduplicate learned lines
  const uniqueLines = [...new Set(learnedLines)].slice(0, 8);

  // Energy trend: last 4 grades (no crisis)
  let up = 0;
  let down = 0;
  const last4 = grades.slice(0, 4);
  for (const g of last4) {
    if (g === "crisis") {
      // (no crisis) — exclude crisis grades from trend direction count per spec
      continue;
    }
    if (g === "high" || g === "medium") {
      up += 1;
    } else if (g === "low") {
      down += 1;
    }
  }
  let energyTrend = "flat";
  if (up > down) energyTrend = "up";
  else if (down > up) energyTrend = "down";

  const lastCheckinStr = recent[0]?.summaryText
    ? recent[0].summaryText.slice(0, 60) + (recent[0].summaryText.length > 60 ? "..." : "")
    : recent[0]?.grade ?? "none";

  const card = {
    checkinsTotal: checkins.length,
    lastCheckin: lastCheckinStr,
    learnedLines: uniqueLines,
    energyTrend,
  };

  // Build forPrompt under ~300 chars
  const summaryBits: string[] = [];
  if (summaries.length > 0) {
    summaryBits.push(`Recent summaries: ${summaries.join("; ").slice(0, 120)}`);
  }
  if (grades.length > 0) {
    summaryBits.push(`Grades: ${grades.join(", ")}`);
  }
  if (uniqueLines.length > 0) {
    summaryBits.push(`Learned: ${uniqueLines.join("; ")}`);
  }
  if (energyTrend !== "flat") {
    summaryBits.push(`Energy trend: ${energyTrend}`);
  }
  if (openApps.length > 0) {
    summaryBits.push(`Open slots: ${openApps.map((a) => a.provider).join(", ")}`);
  }

  const briefText = [
    `Patient: ${patientName}.`,
    ...summaryBits,
    `Checkins total: ${checkins.length}.`,
  ].join(" ");

  const forPrompt = briefText.length > 300 ? briefText.slice(0, 297) + "..." : briefText;

  return {
    forPrompt: forPrompt || `No prior check-ins yet for ${patientName}.`,
    forCard: card,
  };
}

/** Compact, card-only brain summary exposed to itself for the caregiver dashboard. */
export interface BrainCard {
  totalCheckins: number;
  lastCheckinGrade?: Grade;
  lastCheckinWhen?: string;
  learnedLines: string[];
  energyTrend: "up" | "flat" | "down";
}

/**
 * Compact brain summary, card-ready for the caregiver dashboard.
 * Delegates to buildPatientBrief and only reads what the store offers;
 * no schema is touched, nothing is persisted. Returns a single
 * BrainCard usable by both the API surface and the client component.
 */
export async function getBrainSummaryForCard(
  store: CuraStore,
  householdId: string,
  patientName: string
): Promise<BrainCard> {
  const brief = await buildPatientBrief(store, householdId, patientName);

  const checkins = await store.getCheckinsForHousehold(householdId);
  const recent = checkins.slice(0, 5);
  return {
    totalCheckins: brief.forCard.checkinsTotal,
    lastCheckinGrade: recent[0]?.grade,
    lastCheckinWhen: recent[0]?.startedAt,
    learnedLines: brief.forCard.learnedLines,
    energyTrend: brief.forCard.energyTrend as "up" | "flat" | "down",
  };
}
