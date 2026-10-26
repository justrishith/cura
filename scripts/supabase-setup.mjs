#!/usr/bin/env node
// scripts/supabase-setup.mjs — one-shot Supabase bootstrap for Cura (Management API).
// Reads SUPABASE_TOKEN / SUPABASE_ACCESS_TOKEN from the environment. NEVER prints
// secret keys — writes them straight into .env.local. Idempotent: reuses an existing
// project with the same name, resumes if provisioning is still pending.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_TOKEN;
const NAME = process.argv[2] || "cura";
const ORG_ARG = process.argv[3] || null;
const REGION = process.argv[4] || "us-east-2";

const API = "https://api.supabase.com/v1";
const HEADERS = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

if (!TOKEN) {
  console.error("[supabase-setup] No SUPABASE_TOKEN in environment — aborting.");
  process.exit(1);
}

const mask = (s) =>
  !s ? "MISSING" : s.length <= 12 ? `${s[0]}***` : `${s.slice(0, 4)}…${s.slice(-4)} (len ${s.length})`;
const log = (...a) => console.log("[supabase-setup]", ...a);

async function api(method, url, body) {
  const res = await fetch(url, { method, headers: HEADERS, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${text.slice(0, 400)}`);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// --- 0. resolve org ------------------------------------------------------------
const orgs = await api("GET", `${API}/organizations`);
const org = ORG_ARG ? orgs.find((o) => o.id === ORG_ARG) : orgs[0];
if (!org) {
  console.error("[supabase-setup] Org not found. Orgs:", orgs.map((o) => `${o.id} (${o.name ?? o.slug})`).join(", "));
  process.exit(1);
}
log(`org ${org.id} (${org.slug ?? org.name ?? "?"})`);

// --- 1. get-or-create project --------------------------------------------------
const projects = await api("GET", `${API}/projects`);
let proj = projects.find((p) => p.name === NAME && p.organization_id === org.id);
if (proj) {
  log(`using existing project '${NAME}' (ref ${proj.id}, ${proj.status})`);
} else {
  // DB password: generated, never persisted — resettable in dashboard Settings→Database.
  const dbPassword = crypto.randomBytes(18).toString("base64url");
  log(`creating project '${NAME}' in ${REGION} … (provisioning takes ~1–4 min)`);
  proj = await api("POST", `${API}/projects`, {
    name: NAME,
    organization_id: org.id,
    db_pass: dbPassword,
    region: REGION,
  });
}
const ref = proj.id;

// --- 2. wait for ACTIVE ----------------------------------------------------------
const HEALTHY_STATUSES = new Set(["ACTIVE", "ACTIVE_HEALTHY"]);
const deadline = Date.now() + 8 * 60_000;
while (!HEALTHY_STATUSES.has(proj.status)) {
  if (Date.now() > deadline) {
    console.error(`[supabase-setup] Project still ${proj.status} after 8 min — rerun this script to resume.`);
    process.exit(2);
  }
  await new Promise((r) => setTimeout(r, 15_000));
  proj = await api("GET", `${API}/projects/${ref}`);
  log("status", proj.status);
}
log(`project ACTIVE ✓ (ref ${ref})`);

// --- 3. fetch API keys -----------------------------------------------------------
const keyList = await api("GET", `${API}/projects/${ref}/api-keys`);
const pick = (pred) => keyList.filter(pred).map((k) => k.api_key)[0] ?? null;
const anon = pick((k) => /publishable|anon/i.test(k.name ?? ""));
const service = pick((k) => /service_role|secret/i.test(k.name ?? ""));
if (!anon || !service) {
  console.error("[supabase-setup] Keys not found in api-keys response:", keyList.map((k) => k.name));
  process.exit(1);
}
log("anon key", mask(anon));
log("service key", mask(service));

// --- 4. run schema.sql -----------------------------------------------------------
const schema = fs.readFileSync(path.join(ROOT, "supabase", "schema.sql"), "utf8");
log("running schema.sql …");
const qres = await api("POST", `${API}/projects/${ref}/database/query`, { query: schema });
log("schema done:", JSON.stringify(qres).slice(0, 300));

// --- 5. write keys into .env.local -------------------------------------------------
const envPath = path.join(ROOT, ".env.local");
let envText = fs.readFileSync(envPath, "utf8");
const url = `https://${ref}.supabase.co`;
envText = envText.replace(/^NEXT_PUBLIC_SUPABASE_URL=.*$/m, `NEXT_PUBLIC_SUPABASE_URL=${url}`);
envText = envText.replace(/^NEXT_PUBLIC_SUPABASE_ANON_KEY=.*$/m, `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`);
envText = envText.replace(/^SUPABASE_SERVICE_ROLE_KEY=.*$/m, `SUPABASE_SERVICE_ROLE_KEY=${service}`);
// DEMO_MODE stays 1 until the app's SupabaseStore is wired — deliberate, see store.ts.
fs.writeFileSync(envPath, envText);
log(`.env.local updated → ${url} · (DEMO_MODE stays 1 until SupabaseStore is wired)`);

// --- 6. sanity check ----------------------------------------------------------------
const rest = await fetch(`${url}/rest/v1/medications?select=name`, {
  headers: { apikey: service, Authorization: `Bearer ${service}` },
});
log("sanity check (service-key GET medications) →", rest.status, (await rest.text()).slice(0, 200));
log("DONE ✓");
