// scripts/voice-template-test.mjs — find the trial-legal call-create combo.
// Trial contract (docs/usage/trials/try-out-voice): To + one of four
// webhooks.twilio.com Voice Template URLs (+ optional statusCallback).
// Each combo is a real call attempt; a 201 means Twilio ACCEPTS and your phone rings.

import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const auth = `Basic ${Buffer.from(env.TWILIO_ACCOUNT_SID + ":" + env.TWILIO_AUTH_TOKEN).toString("base64")}`;
const API = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Calls.json`;
const TO = env.EMERGENCY_CONTACT_PHONE;
const OWNED = env.TWILIO_FROM_NUMBER;
const BASE = "https://webhooks.twilio.com/v1/Voice/Template";

const speech =
  "Hello. This is Cura, an automated care assistant for Maria, who reported chest pain and trouble breathing during her check-in. Please check on her right away. Goodbye.";

const combos = [
  { label: "A: To only + TTS template (no From)", body: { To: TO, Url: `${BASE}/voice_text_to_speech` } },
  { label: "B: To + TTS template + Owned From", body: { To: TO, From: OWNED, Url: `${BASE}/voice_text_to_speech` } },
  {
    label: "C: To + SampleCallInstructions param (no From)",
    body: { To: TO, SampleCallInstructions: `${BASE}/voice_text_to_speech` },
  },
  {
    label: "D: To + From + SampleCallInstructions",
    body: { To: TO, From: OWNED, SampleCallInstructions: `${BASE}/voice_text_to_speech` },
  },
  {
    label: "E: To + keyboard template (no From)",
    body: { To: TO, Url: `${BASE}/voice_keyboard_input` },
  },
];

for (const c of combos) {
  const t0 = Date.now();
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(c.body),
  });
  const text = await res.text();
  const took = Date.now() - t0;
  let summary;
  try {
    const j = JSON.parse(text);
    summary = j.sid
      ? `SID ${j.sid} | from=${j.from} | status=${j.status}`
      : `${j.code}: ${j.message}`;
  } catch {
    summary = text.slice(0, 160);
  }
  console.log(`[${c.label}] ${res.status} (${took}ms)\n   → ${summary}\n`);
  if (res.status === 201) {
    console.log("*** CALL FIRED — combo that works:", c.label);
    break;
  }
  await new Promise((r) => setTimeout(r, 800));
}
