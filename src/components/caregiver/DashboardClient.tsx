"use client";

// Caregiver dashboard client (design.md §S3): fetches /api/caregiver on mount,
// polls every 15s, renders StatusHero + Alerts on the left and a
// Timeline / Meds / Call log tab panel (DashboardPanels) on the right.
// Desktop 2-col, stacked mobile.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { CaregiverSnapshot } from "@/app/api/caregiver/route";
import { CuraMark } from "@/components/ui/CuraMark";
import { AlertRow, StatusHero } from "@/components/ui/DashboardPrimitives";
import { DashboardPanels, type DashboardTab } from "./DashboardPanels";

/** PRD persona: Maria, 72 (condition-agnostic demo patient). */
const PATIENT_AGE = 72;

const TABS: { id: DashboardTab; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "meds", label: "Meds" },
  { id: "calls", label: "Call log" },
];

export function DashboardClient() {
  const [data, setData] = useState<CaregiverSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<DashboardTab>("timeline");
  const [refetchNonce, setRefetchNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/caregiver", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const snapshot = (await res.json()) as CaregiverSnapshot;
        if (!cancelled) {
          setData(snapshot);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("Couldn't load the dashboard — retrying shortly.");
      } finally {
        if (!cancelled) setLoaded(true);
      }
    }
    void load();
    const timer = setInterval(load, 15000); // design.md §S3: poll 15s
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [refetchNonce]);

  const acknowledge = useCallback(async (notificationId: string) => {
    const res = await fetch("/api/caregiver", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notificationId }),
    });
    if (res.ok) setRefetchNonce((n) => n + 1); // immediate refetch instead of waiting a poll
  }, []);

  if (!loaded && !data) {
    return <main className="p-10 text-center text-inkmuted">Loading the dashboard…</main>;
  }

  const latest = data?.checkins[0] ?? null;

  return (
    <main className="bg-sand pb-10">
      <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pt-6">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Cura home" className="rounded-full">
            <CuraMark />
          </Link>
          <span className="rounded-full bg-muted px-3 py-1 text-xs text-inkmuted">
            Demo — not medical advice
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/patient" className="min-h-12 inline-flex items-center text-clay underline-offset-4 hover:underline">
            Patient console
          </Link>
          <Link href="/" className="min-h-12 inline-flex items-center text-inkmuted underline-offset-4 hover:underline">
            Home
          </Link>
        </nav>
      </header>

      <h1 className="sr-only">Caregiver dashboard</h1>

      {error && (
        <p role="alert" className="mx-auto mt-4 max-w-5xl rounded-xl bg-warnsoft px-4 py-2 text-sm text-warn">
          {error}
        </p>
      )}

      <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Left column: status + alerts */}
        <div className="flex flex-col gap-4">
          {latest ? (
            <StatusHero
              name={data?.patientName ?? ""}
              age={PATIENT_AGE}
              lastCheckInLabel={new Date(latest.startedAt).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}
              grade={latest.grade}
              summary={latest.summaryText ?? ""}
            />
          ) : (
            <section className="a-drop r-tray border border-hairline bg-paper p-6 text-sm text-inkmuted">
              No check-ins yet —{" "}
              <Link href="/patient" className="font-medium text-clay underline-offset-4 hover:underline">
                try the patient console
              </Link>
              .
            </section>
          )}

          <section aria-label="Alerts" className="a-drop d-2 r-panel border border-hairline bg-paper p-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-inkmuted/70">Alerts</h2>
            <div className="mt-3 flex flex-col gap-2">
              {(data?.notifications.length ?? 0) === 0 && (
                <p className="text-sm text-inkmuted">No alerts — nothing needs you right now.</p>
              )}
              {data?.notifications.map((notification) => (
                <AlertRow
                  key={notification.id}
                  level={notification.level}
                  message={notification.message}
                  unread={!notification.acknowledged}
                  acknowledged={notification.acknowledged}
                  onAck={notification.acknowledged ? undefined : () => void acknowledge(notification.id)}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Right column: tabbed feed */}
        <section aria-label="Activity" className="a-drop d-3 r-sheet border border-hairline bg-paper p-4 md:p-6">
          <div role="tablist" aria-label="Activity tabs" className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`min-h-12 inline-flex items-center rounded-full px-4 text-sm font-semibold transition-colors duration-[240ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 ${
                  tab === t.id ? "bg-moss text-paper" : "bg-muted text-inkmuted hover:bg-stone/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" className="mt-4">
            <div key={tab} className="a-tab">
              <DashboardPanels tab={tab} data={data} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default DashboardClient;
