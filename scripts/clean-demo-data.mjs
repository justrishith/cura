// scripts/clean-demo-data.mjs — wipes probe/rehearsal data from the live Supabase
// project (checkins, their cascade children, calls, caregiver_notifications) so the
// demo starts clean. Meds / appointments / household stay.
// Usage: node scripts/clean-demo-data.mjs
import fs from "node:fs";

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const read = (k) => {
  const line = env.split("\n").find((l) => l.startsWith(`${k}=`));
  return line ? line.slice(k.length + 1).trim() : "";
};

const BASE = `${read("NEXT_PUBLIC_SUPABASE_URL")}/rest/v1`;
const KEY = read("SUPABASE_SERVICE_ROLE_KEY");
if (!BASE || KEY === "") {
  console.error("[clean] missing Supabase env in .env.local");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

let ok = true;
for (const t of ["checkins", "calls", "caregiver_notifications"]) {
  const res = await fetch(`${BASE}/${t}?id=neq.11111111-1111-1111-1111-111111111111`, {
    method: "DELETE",
    headers: H,
  });
  console.log(`[clean] DELETE ${t} → ${res.status}`);
  ok &&= res.ok;
}
const probe = await fetch(`${BASE}/checkins?select=id&household_id=eq.11111111-1111-1111-1111-111111111111`, {
  headers: H,
});
const rows = await probe.json();
console.log(`[clean] remaining checkins: ${rows.length}`);
process.exit(ok ? 0 : 1);
