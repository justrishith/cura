"use client";

// /patient — voice-first check-in console (design.md §5-S2 + §6 state machines).
// Voice I/O via useUserSpeech; one turn POSTs /api/agent; consent POSTs /api/call.
import { useEffect, useMemo, useRef, useState } from "react";
import { ActionCard } from "@/components/ui/ActionCard";
import { CallStrip } from "@/components/ui/CallStrip";
import { CrisisBanner } from "@/components/ui/CrisisBanner";
import { CuraBird } from "@/components/ui/CuraBird";
import { CuraMark } from "@/components/ui/CuraMark";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { MicOrb, type MicOrbState } from "@/components/ui/MicOrb";
import { TranscriptFeed, TranscriptThinking, type TranscriptBubbleProps } from "@/components/ui/TranscriptBubble";
import { useUserSpeech } from "@/lib/use-user-speech";
import type { ActionReceipt, AgentTurnResult, CallOffer, Grade } from "@/lib/types";

const DEMO_HOUSEHOLD_ID = "11111111-1111-1111-1111-111111111111";
const WAIT_NOTE = "awaiting call outcome…";
// Trial accounts: the outbound call is a fixed ~25 s recorded notice that Twilio
// itself hangs up (inline TwiML is a paid feature). The demo reflects reality:
// the ring is real, and the done-state says where the conversation continues.
const TRIAL_DONE_NOTE =
  "Call placed — the caregiver's phone got the alert call (Twilio trial line: ~25 s recorded notice). The real conversation continues right here on Cura's line.";
const TRIAL_CALL_SECONDS = 26;
// Elderly-first sizing: generous targets the thumb never misses.
const INPUT_CLASS =
  "r-ctl min-h-16 w-full border border-hairline bg-paper px-4 text-lg text-ink placeholder:text-inkmuted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-sand";
const SEND_CLASS =
  "r-ctl min-h-16 bg-moss px-6 text-lg font-semibold text-paper transition-[background-color,transform] duration-[240ms] ease-out hover:bg-mosshover active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-sand";

type CallFlow =
  | { kind: "offer"; offer: CallOffer } | { kind: "live"; provider: string; sid: string; trialOpener?: boolean }
  | { kind: "done"; message: string } | { kind: "declined" };

/** One poll of the call-state contract. null ⇒ keep waiting (404, network, not finished). */
async function telephonyOutcome(sid: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/telephony/status?sid=${encodeURIComponent(sid)}`);
    if (!res.ok) return null;
    const s = (await res.json()) as { status?: string; outcome?: string | null; bookedSlot?: string | null };
    if (s.status === "failed") return "The call didn't connect — please try again.";
    if (s.status !== "completed") return null;
    return s.bookedSlot ? `Booked — ${s.bookedSlot}` : `Call finished — ${s.outcome ?? "no outcome reported"}`;
  } catch { return null; }
}

function TextFallback(props: { open: boolean; busy: boolean; value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  if (!props.open) return null;
  return (
    <form
      className="flex items-center gap-3"
      onSubmit={(e) => { e.preventDefault(); if (!props.busy && props.value.trim()) props.onSubmit(); }}
    >
      <input value={props.value} onChange={(e) => props.onChange(e.target.value)} placeholder="Type instead…" aria-label="Type your check-in message" className={INPUT_CLASS} />
      <button type="submit" disabled={props.busy} className={SEND_CLASS}>Send</button>
    </form>
  );
}

export default function CheckInConsole() {
  const { isSupported, interim, start, stop, speak, cancelSpeech } = useUserSpeech();
  const [feed, setFeed] = useState<TranscriptBubbleProps[]>([]);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [receipts, setReceipts] = useState<ActionReceipt[]>([]);
  const [checkinId, setCheckinId] = useState<string | null>(null);
  const [orb, setOrb] = useState<MicOrbState>("idle");
  const [textMode, setTextMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [crisis, setCrisis] = useState(false);
  const [call, setCall] = useState<CallFlow | null>(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [callStartedAt, setCallStartedAt] = useState(0);
  const [, setTick] = useState(0); // re-render for the live elapsed timer
  const refThread = useRef<{ role: "cura" | "patient"; text: string }[]>([]);
  const refSubmit = useRef<(m: string, fromVoice: boolean) => void>(() => {});

  function push(role: "cura" | "patient", text: string) {
    refThread.current = [...refThread.current, { role, text }];
    setFeed((prev) => [...prev, { role, text, timestamp: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) }]);
  }

  // Push-style receipts: every completed tool call arrives as a floating toast
  // (screen-reader live region included) and stays in the side panel log.
  const [toasts, setToasts] = useState<string[]>([]);
  const toastTimers = useRef<number[]>([]);
  function announceReceipts(incoming: ActionReceipt[]) {
    if (incoming.length > 0) {
      setReceipts((prev) => [...incoming, ...prev]); // newest first
      const ids = incoming.map((r) => r.id);
      setToasts((prev) => [...ids, ...prev]);
      for (const id of ids) {
        toastTimers.current.push(window.setTimeout(() => {
          setToasts((ts) => ts.filter((t) => t !== id));
        }, 6500));
      }
    }
  }
  useEffect(() => () => { for (const t of toastTimers.current) window.clearTimeout(t); }, []);
  const toastReceipts = useMemo(
    () => toasts.map((id) => receipts.find((r) => r.id === id)).filter((r): r is ActionReceipt => !!r),
    [toasts, receipts],
  );

  async function submit(message: string, fromVoice: boolean) {
    const text = message.trim();
    if (!text) return;
    setError(null);
    const history = refThread.current; // turns BEFORE this utterance
    push("patient", text);
    setOrb("thinking");
    try {
      const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ householdId: DEMO_HOUSEHOLD_ID, checkinId, message: text, history }) });
      if (!res.ok) throw new Error(`/api/agent returned ${res.status}`);
      const r = (await res.json()) as AgentTurnResult;
      setCheckinId(r.checkinId); setGrade(r.grade);
      push("cura", r.reply); // degraded replies arrive here as a normal bubble
      announceReceipts(r.receipts); // push toasts + persistent log, newest first
      if (r.crisis) setCrisis(true);
      else if (r.callOffer) setCall({ kind: "offer", offer: r.callOffer });
      // The vision: Cura's voice always answers, then a voice session rolls
      // straight back into listening — the patient never touches the screen.
      setOrb("speaking");
      speak(r.reply, () => { if (sessionStarted || fromVoice) startListeningAgain(fromVoice); else setOrb("idle"); });
    } catch {
      push("cura", "I couldn't reach my notes just now — please tell me again in a moment.");
      setOrb("idle");
      setError("The check-in turn failed; Cura replied with its fallback. Please try once more.");
    }
  }

  /** Post-speech handoff: voice turns roll straight back into listening; typed turns don't. */
  function startListeningAgain(fromVoice: boolean) {
    if (!fromVoice || !isSupported) { setOrb("idle"); return; }
    setOrb("listening");
    start(
      (nextText) => refSubmit.current(nextText, true),
      () => setOrb((cur) => (cur === "listening" ? "idle" : cur)),
    );
  }

  /** The one-tap session start: gesture grants the mic, Cura speaks the greeting, then listens. */
  function beginSession() {
    setSessionStarted(true);
    const h = new Date().getHours();
    const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
    const greeting = `Good ${part}, Maria. I'm Cura, your daily care bird. How are you feeling today — anything bothering you?`;
    push("cura", greeting);
    if (!isSupported) {
      setTextMode(true);
      setNote("Your browser can't listen here — typing works exactly the same.");
      setOrb("idle");
      return;
    }
    setOrb("speaking");
    // Speaks because the click is the user gesture browsers require; listens after.
    speak(greeting, () => startListeningAgain(true));
  }

  // Mic callbacks go through a ref so a fresh checkinId is never captured stale.
  useEffect(() => { refSubmit.current = submit; });

  // Live call: 1s ticks drive the elapsed timer. Paid flow: every 4th tick polls
  // GET /api/telephony/status?sid=… → {status, outcome, bookedSlot}. Trial flow
  // (trialOpener): Twilio owns the ~25 s notice + hang-up and sends no callback
  // for it — the done-state arrives on a fixed timer instead.
  useEffect(() => {
    if (call?.kind !== "live") return;
    const sid = call.sid;
    const trial = call.trialOpener === true;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (!trial && n % 4 === 1) {
        void telephonyOutcome(sid).then((done) => {
          if (done) { setCall({ kind: "done", message: done }); setNote(null); }
          else setNote(WAIT_NOTE);
        });
      }
      if (trial && n >= TRIAL_CALL_SECONDS) {
        setCall({ kind: "done", message: TRIAL_DONE_NOTE }); setNote(null);
      }
      setTick((t) => t + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [call]);

  function onOrbToggle() {
    if (orb === "thinking") return;
    if (orb === "speaking") { cancelSpeech(); setOrb("idle"); return; }
    if (orb === "listening") { stop(); return; }
    if (!isSupported) { setTextMode(true); setNote("Voice input is not available in this browser — you can type instead."); return; }
    setNote(null);
    start(
      (finalText) => refSubmit.current(finalText, true),
      () => setOrb((cur) => (cur === "listening" ? "idle" : cur)),
    );
  }

  async function onCallNow() {
    if (call?.kind !== "offer") return;
    const provider = call.offer.provider;
    setNote("Dialing…");
    try {
      const res = await fetch("/api/call", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose: "clinic_booking", householdId: DEMO_HOUSEHOLD_ID, checkinId }) });
      if (!res.ok) throw new Error(`/api/call returned ${res.status}`);
      const data = (await res.json()) as { simulated: boolean; callSid: string | null; trialTemplate?: boolean; doneMessage?: string };
      if (data.simulated || !data.callSid) {
        setCall({ kind: "done", message: data.doneMessage ?? "Call simulated — booking continues on the dashboard." }); setNote(null);
      } else {
        setCallStartedAt(Date.now());
        setCall({ kind: "live", provider, sid: data.callSid, trialOpener: data.trialTemplate === true }); setNote(WAIT_NOTE);
      }
    } catch {
      setNote("The call could not be started — please try again.");
    }
  }

  const onDecline = () => { setCall({ kind: "declined" }); setNote(null); };
  const elapsed = call?.kind === "live" ? Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)) : 0;

  return (
    <div className="min-h-svh bg-sand">
      <CrisisBanner visible={crisis} />

      {/* Push notifications: completed actions arrive as floating toasts, not a
          pile at the bottom. They keep the bottom-of-screen space clean. */}
      {toastReceipts.length > 0 && (
        <div
          aria-live="polite"
          aria-label="Notifications"
          className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col-reverse gap-3"
          style={{ top: crisis ? "4.5rem" : "1rem" }}
        >
          {toastReceipts.map((r) => (
            <div className="pointer-events-auto a-toast shadow-[0_10px_26px_rgba(41,37,29,0.16)] motion-reduce:[animation:none] motion-reduce:shadow-none" key={r.id}>
              <ActionCard receipt={r} />
            </div>
          ))}
        </div>
      )}

      {/* Two working areas, both full width: the conversation lives left, the
          record of what Cura did — receipts, calls — lives right and stays visible. */}
      <div className="mx-auto grid w-full min-h-svh max-w-[110rem] gap-6 px-5 py-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start lg:gap-8 lg:px-10 lg:py-10">
        {/* Left column: the conversation. */}
        <main className="flex min-w-0 flex-col gap-6">
          <header className="flex items-center justify-between gap-3">
            <CuraMark />
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-inkmuted">Demo — not medical advice</span>
          </header>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-4xl font-semibold tracking-tight text-ink lg:text-5xl">Daily check-in</h1>
              <p className="mt-1 text-lg text-inkmuted">Just tell Cura how things are.</p>
            </div>
            {grade && <GradeBadge grade={grade} size="md" />}
          </div>

          {sessionStarted ? (
            <>
              <MicOrb state={orb} onToggle={onOrbToggle} onSwitchToText={() => setTextMode((v) => !v)} />
              {feed.length === 0 ? (
                <p className="r-sheet border border-hairline bg-paper px-5 py-4 text-xl leading-relaxed text-inkmuted">
                  Tap the circle and tell Cura how you&apos;re doing today.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  <TranscriptFeed items={feed} />
                </div>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={beginSession}
              className="r-ctl a-rise flex min-h-40 w-full items-center gap-5 bg-moss px-6 text-left text-xl transition-[background-color,transform] duration-[240ms] ease-out hover:bg-mosshover active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-sand"
            >
              <CuraBird className="a-bob h-20 w-20 shrink-0" title="Start the check-in" />
              <span>
                <span className="block font-display text-3xl font-semibold text-paper">Start today&apos;s check-in</span>
                <span className="mt-1 block text-base text-paper/80">
                  One tap — then just talk. Cura listens and answers out loud.
                </span>
                <span className="mt-1 block text-sm text-paper/60">No account, no setup, nothing to remember.</span>
              </span>
            </button>
          )}
          {orb === "thinking" && <TranscriptThinking />}
          {orb === "listening" && interim && <p aria-live="polite" className="text-base italic text-inkmuted/70">…{interim}</p>}
          <TextFallback
            open={textMode}
            busy={orb === "thinking"}
            value={draft}
            onChange={setDraft}
            onSubmit={() => { const m = draft; setDraft(""); void submit(m, false); }}
          />
          {error && <p role="alert" className="r-panel border border-danger/30 bg-dangersoft px-3 py-2 text-sm text-danger">{error}</p>}
          {note && !textMode && <p className="text-xs text-inkmuted/80">{note}</p>}
        </main>

        {/* Right column: the permanent record — receipts, call flow. Toasts above
            announce each new row; this panel holds the full day's history. */}
        <aside aria-label="What Cura did for you" className="flex flex-col gap-4 lg:sticky lg:top-8">
          <h2 className="font-display text-xl font-semibold text-ink">What Cura did</h2>

          {call?.kind === "offer" && <CallStrip mode="offer" offer={call.offer} onCallNow={() => void onCallNow()} onDismiss={onDecline} />}
          {call?.kind === "live" && <CallStrip mode="live" provider={call.provider} elapsedSeconds={elapsed} />}
          {call?.kind === "done" && <CallStrip mode="done" message={call.message} />}
          {call?.kind === "declined" && <p className="text-sm text-inkmuted/70">Offered to book — declined.</p>}

          <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-1">
            {receipts.length > 0 ? (
              receipts.map((r, i) => <ActionCard key={r.id} receipt={r} delay={Math.min(i, 4) * 70} />)
            ) : (
              <p className="r-panel border border-hairline bg-paper px-4 py-3 text-sm leading-relaxed text-inkmuted">
                Nothing yet — during your check-in, Cura&apos;s actions (symptoms logged, caregiver notified, helpful tips) appear here in real time.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
