// scripts/seed-demo-history.mjs — seeds a believable week+ of life for Maria
// so the caregiver dashboard, the brain card and the memory graph have real
// material on camera. assumes a CLEAN store (run clean-demo-data.mjs first).
// Usage: node scripts/seed-demo-history.mjs [--undo]
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const read = (k) => {
  const line = env.split("\n").find((l) => l.startsWith(`${k}=`));
  return line ? line.slice(k.length + 1).trim() : "";
};
const BASE = `${read("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1`;
const KEY = read("SUPABASE_SERVICE_ROLE_KEY");
if (!BASE || !KEY) { console.error("[seed] missing Supabase env"); process.exit(1); }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const HOUSE = "11111111-1111-1111-1111-111111111111";
const UNDO = process.argv.includes("--undo");

if (UNDO) {
  for (const t of ["checkins", "calls", "caregiver_notifications"]) {
    const del = await fetch(`${BASE}/${t}?id=neq.x`, { method: "DELETE", headers: H });
    console.log(`[undo] ${t} → ${del.status}`);
  }
  process.exit(0);
}

// 8 days of mornings/evenings, oldest first. Each: offsetDays, hour, grade, summary, actions[].
// Authentic elderly texture: tea, garden, mail, church, the knee, the flowers, the phone.
const DAYS = [
  { day: -8, hour: 9, grade: "low", summary: "Good morning — slept well, asked about her garden.", actions: [{ tool: "suggest_health_tip", payload: { text: "Let the morning light in — sit by a window for a few minutes with a book or your tea." } }] },
  { day: -8, hour: 19, grade: "low", summary: "Evening — mentioned the grandkids' call made her day.", actions: [] },
  { day: -7, hour: 9, grade: "low", summary: "Took meds with breakfast without prompt, knee aches lightly.", actions: [{ tool: "log_symptom", payload: { text: "Left knee aching mildly after rain" } }, { tool: "suggest_health_tip", payload: { text: "For the knee: a warm compress for ten minutes helps more than you'd think." } }] },
  { day: -7, hour: 19, grade: "low", summary: "Watched jeopardy, slept early.",
    actions: [{ tool: "suggest_health_tip", payload: { text: "A short evening walk — even to the mailbox — eases morning stiffness." } }] },
  { day: -6, hour: 8, grade: "low", summary: "Church phone call with sister Margaret; spirits high.", actions: [] },
  { day: -5, hour: 9, grade: "low", summary: "Napped mid-morning, felt a bit foggy after.", actions: [] },
  { day: -4, hour: 9, grade: "high", summary: "Dizzy by the sink this morning, sat down quickly — no fall.", actions: [
      { tool: "log_symptom", payload: { text: "Dizziness standing at the kitchen sink, steadied by the counter" } },
      { tool: "notify_caregiver", payload: { message: "Maria felt dizzy this morning and nearly slipped by the sink. She is resting now. Call (567) 405-1070 to reach her through Cura." } },
    ] },
  { day: -4, hour: 13, grade: "high", summary: "Follow-up: still unsteady, agrees a doctor should hear this.", actions: [
      { tool: "schedule_telephone_call", payload: { provider: "Dr. Chen", callRecordId: "seed-history-booking" } },
      { tool: "suggest_health_tip", payload: { text: "Get up slowly — sit, then feet, then stand. Count to ten on the way up." } },
    ] },
  { day: -3, hour: 9, grade: "low", summary: "Doctor visit booked Tuesday 10:30; BP cuff reading 118/74.", actions: [] },
  { day: -2, hour: 9, grade: "low", summary: "Bright morning, baked with her granddaughter's recipe.", actions: [{ tool: "suggest_health_tip", payload: { text: "Water first, coffee second — mornings go easier hydrated." } }] },
  { day: -1, hour: 9, grade: "low", summary: "Walked to the mailbox on her own; knee only faint.", actions: [] },
  { day: 0, hour: 0, grade: "low", summary: "Today's check-in waits for Maria.", actions: [] },
];

const stamps = [];
for (const d of DAYS) {
  const base = new Date();
  base.setDate(base.getDate() + d.day);
  base.setHours(d.hour < 9 ? 9 : d.hour, Math.floor(6 + Math.random() * 44), 0, 0);
  const iso = base.toISOString();
  const cre = await fetch(`${BASE}/checkins`, { method: "POST", headers: H, body: JSON.stringify({ household_id: HOUSE, grade: d.grade, summary_text: d.summary, started_at: iso, thread: [] }) });
  if (!cre.ok) { console.error(`[seed] checkin FAILED ${cre.status} ${await cre.text()}`); process.exit(1); }
  const row = (await (await fetch(`${BASE}/checkins?household_id=eq.${HOUSE}&order=started_at.desc&limit=1`, { headers: H })).json())[0];
  stamps.push(row.id);
  console.log(`[seed] checkin ${d.day === 0 ? "today" : `${-d.day}d ago`} ${d.grade} → ${row.id.slice(0, 8)}`);
  for (const a of d.actions) {
    const are = await fetch(`${BASE}/actions`, { method: "POST", headers: H, body: JSON.stringify({ checkin_id: row.id, tool: a.tool, status: "succeeded", payload: a.payload, created_at: iso }) });
    if (!are.ok && are.status !== 400) { console.error(`[seed] action FAILED ${are.status}`); process.exit(1); }
    if (are.status === 400) { // older schema without created_at: retry bare
      await fetch(`${BASE}/actions`, { method: "POST", headers: H, body: JSON.stringify({ checkin_id: row.id, tool: a.tool, status: "succeeded", payload: a.payload }) });
    }
  }
}
console.log(`[seed] done — ${stamps.length} check-ins of history (${DAYS.reduce((n, d) => n + d.actions.length, 0)} actions)`);
process.exit(0);
