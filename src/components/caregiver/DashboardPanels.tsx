"use client";

// Right-column tab panels for the caregiver dashboard: Timeline / Meds / Call log.
// Kept separate from DashboardClient so each component file stays ≤ 200 lines.
import Link from "next/link";
import type { CallPurpose, CallStatus } from "@/lib/types";
import type {
  CaregiverSnapshot,
  CheckinWithActions,
} from "@/app/api/caregiver/route";
import {
  CallLogRow,
  CheckInRow,
  MedCard,
} from "@/components/ui/DashboardPrimitives";

export type DashboardTab = "timeline" | "meds" | "calls";

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function symptomTagsFor(checkin: CheckinWithActions): string[] {
  const tags: string[] = [];
  for (const action of checkin.actions) {
    if (action.tool !== "log_symptom") continue;
    const { description } = action.payload;
    if (typeof description === "string" && description.length > 0 && !tags.includes(description)) {
      tags.push(description);
    }
  }
  return tags;
}

/** CallRecord carries no outcome — infer from purpose/status for the log chip. */
function outcomeFor(
  purpose: CallPurpose,
  status: CallStatus
): "booked" | "no-booking" | "urgent-alert" {
  if (purpose === "crisis_outreach") return "urgent-alert";
  return status === "completed" ? "booked" : "no-booking";
}

export function DashboardPanels({ tab, data }: { tab: DashboardTab; data: CaregiverSnapshot | null }) {
  return (
    <>
      {tab === "timeline" &&
        ((data?.checkins.length ?? 0) === 0 ? (
          <p className="text-sm text-inkmuted">
            No check-ins yet —{" "}
            <Link href="/patient" className="font-medium text-clay underline-offset-4 hover:underline">
              try the patient console
            </Link>
            .
          </p>
        ) : (
          data?.checkins.map((checkin) => (
            <CheckInRow
              key={checkin.id}
              timeLabel={timeLabel(checkin.startedAt)}
              grade={checkin.grade}
              symptomTags={symptomTagsFor(checkin)}
              receipts={checkin.actions}
            />
          ))
        ))}

      {tab === "meds" &&
        ((data?.meds.length ?? 0) === 0 ? (
          <p className="text-sm text-inkmuted">No medications on file.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data?.meds.map((med) => (
              <MedCard key={med.id} name={med.name} dosage={med.dosage} refillStatus={med.refillStatus} />
            ))}
          </div>
        ))}

      {tab === "calls" &&
        ((data?.calls.length ?? 0) === 0 ? (
          <p className="text-sm text-inkmuted">No calls yet — calls Cura places will show up here.</p>
        ) : (
          data?.calls.map((call) => (
            <div key={call.id}>
              <CallLogRow
                direction="out"
                destination={call.toNumber}
                outcome={outcomeFor(call.purpose, call.status)}
                timeLabel={timeLabel(call.startedAt)}
              />
              <p className="pb-2 text-xs text-inkmuted/70">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${
                    call.purpose === "clinic_booking" ? "bg-oksoft text-ok" : "bg-dangersoft text-danger"
                  }`}
                >
                  {call.purpose === "clinic_booking" ? "clinic" : "emergency"}
                </span>
                <span className="ml-2">{call.status}</span>
              </p>
            </div>
          ))
        ))}
    </>
  );
}

export default DashboardPanels;
