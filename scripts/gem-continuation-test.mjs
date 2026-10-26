// Continuation test: functionResponse round-trip on gemini-3.6-flash generateContent.
import { readFileSync } from "node:fs";

const key = readFileSync("C:/Users/krish/projects/cura/.env.local", "utf8")
  .split("\n").find((l) => l.startsWith("GEMINI_API_KEY=")).slice("GEMINI_API_KEY=".length).trim();
const prev = JSON.parse(readFileSync("C:/Users/krish/AppData/Local/Temp/opencode/gem-r4.json", "utf8"));

const modelContent = prev.candidates[0].content;
const body = {
  contents: [
    { role: "user", parts: [{ text: "Maria has run out of her Lisinopril and wants a refill. Use your tools, book nothing." }] },
    modelContent,
    { role: "user", parts: [{ functionResponse: { name: "request_refill", response: { status: "requested", medication_name: "Lisinopril" } } }] },
  ],
  tools: [prev.tools ? prev.tools[0] : { function_declarations: [] }],
  system_instruction: { parts: [{ text: "You are Cura. After tool results, confirm to the patient in one short spoken sentence." }] },
};

const sw = 0;
const t0 = Date.now();
const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
  method: "POST",
  headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
console.log(`HTTP=${res.status} elapsed_ms=${Date.now() - t0}`);
const json = await res.json();
if (!res.ok) {
  console.log(JSON.stringify(json).slice(0, 500));
} else {
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  console.log(JSON.stringify(parts.map((p) => ({ text: p.text, fn: p.functionCall?.name, args: p.functionCall?.args })), null, 1).slice(0, 900));
}
