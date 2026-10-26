// scripts/latency-test.mjs — measure Interactions API latency for the Cura turn shape.
// Two calls: (1) new interaction with tools, (2) continuation after function_result.
// Prints timing + step types + output text, no secrets.

import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const KEY = env.GEMINI_API_KEY;
const MODEL = process.env.MODEL_OVERRIDE || "gemini-3.5-flash-lite";

const TOOLS = [
  {
    type: "function",
    name: "log_symptom",
    description: "Record a symptom the patient reported.",
    parameters: {
      type: "object",
      properties: {
        description: { type: "string" },
        severity: { type: "string", enum: ["mild", "moderate", "severe", "critical"] },
      },
      required: ["description", "severity"],
    },
  },
  {
    type: "function",
    name: "submit_checkin_grade",
    description: "Submit your grade for this check-in.",
    parameters: {
      type: "object",
      properties: { grade: { type: "string", enum: ["low", "medium", "high"] } },
      required: ["grade"],
    },
  },
];

const SYSTEM =
  "You are Cura, a warm automated care assistant running a daily check-in with Maria, 72. " +
  "Reply in under 60 words, plain English, spoken aloud to an older adult. " +
  "Log any symptom she reports with log_symptom, then always finish with submit_checkin_grade.";

async function call(body, label) {
  const t0 = Date.now();
  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: { "x-goog-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const ms = Date.now() - t0;
  if (!res.ok) {
    console.log(`[${label}] FAIL ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
    process.exit(1);
  }
  const steps = (json.steps ?? []).map((s) => s.type);
  console.log(`[${label}] ${ms}ms  id=${json.id}  steps=[${steps.join(", ")}]  text="${(json.output_text ?? "").slice(0, 120)}"`);
  return json;
}

const first = await call({ model: MODEL, tools: TOOLS, system_instruction: SYSTEM, input: "Morning! I slept okay and took my metformin with breakfast." }, "turn-1");

const fcs = (first.steps ?? []).filter((s) => s.type === "function_call");
if (fcs.length) {
  const results = fcs.map((fc) => ({
    type: "function_result",
    name: fc.name,
    call_id: fc.id,
    result: [{ type: "text", text: '{"status":"succeeded"}' }],
  }));
  await call(
    {
      model: MODEL,
      tools: TOOLS,
      system_instruction: SYSTEM,
      previous_interaction_id: first.id,
      input: results,
    },
    "turn-2-continuation"
  );
}
console.log("MODEL_USED:", MODEL);
