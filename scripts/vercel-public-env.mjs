// scripts/vercel-public-env.mjs — add NEXT_PUBLIC_* Supabase vars as plain (not sensitive).
// The CLI rejects secret visibility for public-prefixed vars; REST API handles it.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const authCandidates = [
  path.join(os.homedir(), "AppData", "Roaming", "xdg.data", "com.vercel.cli", "auth.json"),
  path.join(os.homedir(), ".local", "share", "com.vercel.cli", "auth.json"),
  path.join(os.homedir(), ".vercel", "auth.json"),
];
const authFile = authCandidates.find((p) => fs.existsSync(p));
if (!authFile) {
  console.error("Vercel auth.json not found");
  process.exit(1);
}
const auth = JSON.parse(fs.readFileSync(authFile, "utf8"));

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

// Project id from `vercel link` output (.vercel/project.json)
const proj = JSON.parse(fs.readFileSync(".vercel/project.json", "utf8"));
const projectId = proj.projectId;

const keys = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

for (const key of keys) {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${projectId}/env?upsert=true`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: env[key], type: "plain", target: ["production", "preview"] }),
    }
  );
  const text = await res.text();
  console.log(`${key} → ${res.status} ${text.slice(0, 200)}`);
}
