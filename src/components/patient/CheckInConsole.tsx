"use client";

// /patient — voice-first check-in console (design.md §5-S2 + §6 state machines).
// Voice I/O via useUserSpeech; one turn POSTs /api/agent; consent POSTs /api/call.
import { useEffect, useRef, useState } from "react";
import { ActionCard } from "@/components/ui/ActionCard";
import { CallStrip } from "@/components/ui/CallStrip";
import { CrisisBanner } from "@/components/ui/CrisisBanner";
import { CuraMark } from "@/components/ui/CuraMark";
import { GradeBadge } from "@/components/ui/GradeBadge";
import { MicOrb, type MicOrbState } from "@/components/ui/MicOrb";
import { TranscriptFeed, type TranscriptBubbleProps } from "@/components/ui/TranscriptBubble";
import { useUserSpeech } from "@/lib/use-user-speech";
import type { ActionReceipt, AgentTurnResult, CallOffer, Grade } from "@/lib/types";

const DEMO_HOUSEHOLD_ID = "11111111-1111-1111-1111-111111111111";
const WAIT_NOTE = "awaiting call outcome…";
const INPUT_CLASS =
  "min-h-12 w-full rounded-full border border-slate-200 bg-white px-4 text-base text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2";
const SEND_CLASS =
  "min-h-12 rounded-full bg-teal-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2";

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
      if (fromVoice || r.crisis) { setOrb("speaking"); speak(r.reply, () => setOrb("idle")); }
      else { setOrb("idle"); }
    } catch {
      push("cura", "I couldn't reach my notes just now — please tell me again in a moment.");
      setOrb("idle");
      setError("The check-in turn failed; Cura replied with its fallback. Please try once more.");
    }
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
    <div className="min-h-svh bg-slate-50">
      <CrisisBanner visible={crisis} />
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8">
        <header className="flex items-center justify-between gap-3">
          <CuraMark />
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-500">Demo — not medical advice</span>
        </header>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Daily check-in</h1>
            <p className="text-sm text-slate-500">Just tell Cura how things are.</p>
          </div>
          {grade && <GradeBadge grade={grade} size="md" />}
        </div>
        <MicOrb state={orb} onToggle={onOrbToggle} onSwitchToText={() => setTextMode((v) => !v)} />
        {feed.length === 0 ? <p className="text-base text-slate-400">Tap the orb and say how you&apos;re doing — or switch to text below.</p> : <TranscriptFeed items={feed} />}
        {orb === "listening" && interim && <p aria-live="polite" className="text-sm italic text-slate-400">…{interim}</p>}
        {receipts.length > 0 && (
          <section aria-label="What Cura did for you" className="flex flex-wrap gap-3">{receipts.map((r) => <ActionCard key={r.id} receipt={r} />)}</section>
        )}
        {call?.kind === "offer" && <CallStrip mode="offer" offer={call.offer} onCallNow={() => void onCallNow()} onDismiss={onDecline} />}
        {call?.kind === "live" && <CallStrip mode="live" provider={call.provider} elapsedSeconds={elapsed} />}
        {call?.kind === "done" && <CallStrip mode="done" message={call.message} />}
        {call?.kind === "declined" && <p className="text-sm text-slate-400">Offered to book — declined.</p>}
        <TextFallback
          open={textMode}
          busy={orb === "thinking"}
          value={draft}
          onChange={setDraft}
          onSubmit={() => { const m = draft; setDraft(""); void submit(m, false); }}
        />
        {note && <p className="text-xs text-slate-500">{note}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
