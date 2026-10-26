"use client";

// /patient — voice-first check-in console (design.md §5-S2 + §6 state machines).
// Voice I/O via useUserSpeech; one turn POSTs /api/agent; consent POSTs /api/call.
import { useEffect, useRef, useState } from "react";
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
// Elderly-first sizing: generous targets the thumb never misses.
const INPUT_CLASS =
  "r-ctl min-h-16 w-full border border-hairline bg-paper px-4 text-lg text-ink placeholder:text-inkmuted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-sand";
const SEND_CLASS =
  "r-ctl min-h-16 bg-moss px-6 text-lg font-semibold text-paper transition-[background-color,transform] duration-[240ms] ease-out hover:bg-mosshover active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-sand";

type CallFlow =
  | { kind: "offer"; offer: CallOffer } | { kind: "live"; provider: string; sid: string }
  | { kind: "done"; message: string } | { kind: "declined" };

/** One poll against agent D's contract. null ⇒ keep waiting (404, network, no outcome yet). */
async function telephonyOutcome(sid: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/telephony/state?sid=${encodeURIComponent(sid)}`);
    if (!res.ok) return null;
    const s = (await res.json()) as { status?: string; outcome?: string | null; bookedSlot?: string | null };
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
      if (r.receipts.length > 0) setReceipts((prev) => [...r.receipts, ...prev]); // newest first
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
    const greeting = `Hello! I'm Cura, your daily care bird. How are you feeling today — anything bothering you?`;
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

  // Live call: 1s ticks drive the elapsed timer; every 4th tick polls agent D's
  // GET /api/telephony/state?sid=… → {status, outcome, bookedSlot}; 404/network keeps "live".
  useEffect(() => {
    if (call?.kind !== "live") return;
    const sid = call.sid;
    let n = 0;
    const id = window.setInterval(() => {
      n += 1;
      if (n % 4 === 1) {
        void telephonyOutcome(sid).then((done) => {
          if (done) { setCall({ kind: "done", message: done }); setNote(null); }
          else setNote(WAIT_NOTE);
        });
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
      const data = (await res.json()) as { simulated: boolean; callSid: string | null; doneMessage?: string };
      if (data.simulated || !data.callSid) {
        setCall({ kind: "done", message: data.doneMessage ?? "Call simulated — booking continues on the dashboard." }); setNote(null);
      } else {
        setCallStartedAt(Date.now()); setCall({ kind: "live", provider, sid: data.callSid }); setNote(WAIT_NOTE);
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
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-10">
        <header className="flex items-center justify-between gap-3">
          <CuraMark />
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-inkmuted">Demo — not medical advice</span>
        </header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Daily check-in</h1>
            <p className="mt-0.5 text-sm text-inkmuted">Just tell Cura how things are.</p>
          </div>
          {grade && <GradeBadge grade={grade} size="md" />}
        </div>
        {/* Crisis speaks for the phone: when it matters, Cura calls the caregiver
            automatically — no button, no number, nothing to learn. */}
        {sessionStarted ? (
          <>
            <MicOrb state={orb} onToggle={onOrbToggle} onSwitchToText={() => setTextMode((v) => !v)} />
            {feed.length === 0 ? (
              <p className="r-sheet border border-hairline bg-paper px-4 py-3 text-lg leading-relaxed text-inkmuted">
                Tap the circle and tell Cura how you&apos;re doing today.
              </p>
            ) : (
              <TranscriptFeed items={feed} />
            )}
          </>
        ) : (
          /* Pre-session: one giant, unmistakable start. The click grants the mic
             (browser rule), Cura speaks her greeting, then it's voice-in/voice-out. */
          <button
            type="button"
            onClick={beginSession}
            className="r-ctl flex min-h-36 w-full items-center gap-4 bg-moss px-5 text-left transition-transform duration-[240ms] ease-out hover:bg-mosshover active:scale-[0.98] motion-reduce:active:scale-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-sand"
          >
            <CuraBird className="a-bob h-16 w-16 shrink-0" title="Start the check-in" />
            <span>
              <span className="block font-display text-2xl font-semibold text-paper">Start today&apos;s check-in</span>
              <span className="mt-1 block text-sm text-paper/80">
                One tap — then just talk. Cura listens and answers out loud.
              </span>
              <span className="mt-1 block text-xs text-paper/60">No account, no setup, nothing to remember.</span>
            </span>
          </button>
        )}
        {orb === "thinking" && <TranscriptThinking />}
        {orb === "listening" && interim && <p aria-live="polite" className="text-sm italic text-inkmuted/70">…{interim}</p>}
        {receipts.length > 0 && (
          <section aria-label="What Cura did for you" className="flex flex-col gap-3">{receipts.map((r, i) => <ActionCard key={r.id} receipt={r} delay={i * 70} />)}</section>
        )}
        {call?.kind === "offer" && <CallStrip mode="offer" offer={call.offer} onCallNow={() => void onCallNow()} onDismiss={onDecline} />}
        {call?.kind === "live" && <CallStrip mode="live" provider={call.provider} elapsedSeconds={elapsed} />}
        {call?.kind === "done" && <CallStrip mode="done" message={call.message} />}
        {call?.kind === "declined" && <p className="text-sm text-inkmuted/70">Offered to book — declined.</p>}
        <TextFallback
          open={textMode}
          busy={orb === "thinking"}
          value={draft}
          onChange={setDraft}
          onSubmit={() => { const m = draft; setDraft(""); void submit(m, false); }}
        />
        {note && <p className="text-xs text-inkmuted/80">{note}</p>}
        {error && <p role="alert" className="r-panel border border-danger/30 bg-dangersoft px-3 py-2 text-sm text-danger">{error}</p>}
      </div>
    </div>
  );
}
