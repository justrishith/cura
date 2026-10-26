// /summary — printable doctor-visit sheet (PRD stretch #1, design.md §S5).
// Server component: reads the store directly; plain ink-on-white layout for print.
// The async body sits inside <Suspense> so Next's cacheComponents can prerender
// the shell while store reads / generatedAt resolve at request time.
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import type { ActionReceipt } from "@/lib/types";
import { getStore, DEMO_HOUSEHOLD_ID } from "@/lib/store";
import { CuraMark } from "@/components/ui/CuraMark";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = {
  title: "Visit summary — cura",
  description: "Printable visit summary: graded check-ins, medications, booked appointments.",
};

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function slotLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function symptomsFor(actions: ActionReceipt[]): string[] {
  const out: string[] = [];
  for (const a of actions) {
    if (a.tool !== "log_symptom") continue;
    const { description } = a.payload;
    if (typeof description === "string" && description.length > 0 && !out.includes(description)) out.push(description);
  }
  return out;
}

const REFILL_CHIP: Record<string, string> = {
  ok: "text-ok",
  requested: "text-warn",
  ordered: "text-ok",
};

export default function SummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string }>;
}) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-3xl bg-sand p-8 text-inkmuted">Preparing summary…</main>}>
      <SummaryBody searchParams={searchParams} />
    </Suspense>
  );
}

async function SummaryBody({
  searchParams,
}: {
  searchParams: Promise<{ householdId?: string }>;
}) {
  const householdId = (await searchParams).householdId ?? DEMO_HOUSEHOLD_ID;
  const store = getStore();
  if (!(await store.getHousehold(householdId))) {
    return <main className="mx-auto max-w-3xl bg-sand p-8 text-inkmuted">Unknown household.</main>;
  }

  // PRD persona constant: the demo patient is Maria, 72.
  const patientName = "Maria";
  const meds = await store.getMedications(householdId);
  const checkins = await store.getCheckinsForHousehold(householdId);
  const withActions = await Promise.all(
    checkins.map(async (c) => ({ ...c, actions: await store.getActionsForCheckin(c.id) }))
  );
  const bookedAppointments = (await store.getAppointments(householdId)).filter((a) => a.status === "booked");
  const calls = await store.getCallLog(householdId);
  // Opt into request-time rendering (allowed inside Suspense) so the timestamp is stable.
  await connection();
  const generatedAt = new Date().toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <main className="min-h-dvh bg-sand text-ink">
      <div className="mx-auto w-full max-w-3xl bg-paper px-6 py-10 print:border-0 print:bg-white print:px-0 print:py-4 print:shadow-none">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight">Visit summary for {patientName}</h1>
            <p className="mt-1 text-sm text-inkmuted">Generated {generatedAt}</p>
          </div>
          <div className="flex items-center gap-4 print:hidden">
            <CuraMark />
            <PrintButton />
          </div>
        </header>

        {/* Check-ins: time · grade · symptoms → actions */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold tracking-tight">Check-ins</h2>
          {withActions.length === 0 ? (
            <p className="mt-2 text-sm text-inkmuted">No check-ins recorded yet.</p>
          ) : (
            <table className="mt-2 w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-stone text-xs uppercase tracking-wide text-inkmuted">
                  <th scope="col" className="py-2 pr-3 font-semibold">Time</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Grade</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Symptoms</th>
                  <th scope="col" className="py-2 font-semibold">Actions taken</th>
                </tr>
              </thead>
              <tbody>
                {withActions.map((c) => (
                  <tr key={c.id} className="border-b border-hairline align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-inkmuted">
                      {dateLabel(c.startedAt)} {timeLabel(c.startedAt)}
                    </td>
                    <td className="py-2 pr-3"><GradeBadge grade={c.grade} /></td>
                    <td className="py-2 pr-3 text-inkmuted">{symptomsFor(c.actions).join(", ") || "—"}</td>
                    <td className="py-2 text-xs text-inkmuted">
                      {c.actions.length === 0
                        ? "—"
                        : c.actions.map((a) => (
                            <span key={a.id} className="block">
                              {a.tool} · {a.status}
                            </span>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Medications with refill states */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold tracking-tight">Medications</h2>
          <ul className="mt-2 divide-y divide-hairline text-sm">
            {meds.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="font-semibold">{m.name}</span>
                {m.dosage && <span className="text-inkmuted">{m.dosage}</span>}
                <span className={`font-semibold ${REFILL_CHIP[m.refillStatus] ?? "text-inkmuted"}`}>
                  refill: {m.refillStatus}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* Booked appointments */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold tracking-tight">Booked appointments</h2>
          {bookedAppointments.length === 0 ? (
            <p className="mt-2 text-sm text-inkmuted">No appointments booked yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-hairline text-sm">
              {bookedAppointments.map((a) => (
                <li key={a.id} className="py-2">
                  <span className="font-semibold">{a.provider}</span>
                  <span className="text-inkmuted"> — {slotLabel(a.slot)}</span>
                  <span className="text-xs text-inkmuted/70"> · via {a.via === "phone" ? "phone (Cura)" : "web"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Call log */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-semibold tracking-tight">Calls</h2>
          {calls.length === 0 ? (
            <p className="mt-2 text-sm text-inkmuted">No calls recorded.</p>
          ) : (
            <ul className="mt-2 divide-y divide-hairline text-sm">
              {calls.map((c) => (
                <li key={c.id} className="py-2 text-inkmuted">
                  Outbound call — {c.toNumber} · {timeLabel(c.startedAt)} ·{" "}
                  {c.purpose === "clinic_booking" ? "clinic booking" : "emergency outreach"} · {c.status}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="mt-10 text-xs text-inkmuted/60 print:mt-6">
          Demo — not medical advice. All data mocked.
        </p>
      </div>
    </main>
  );
}
