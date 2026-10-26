// scripts/vercel-env-sync.mjs — sync secrets from .env.local into Vercel (prod + preview).
// Skips VERCEL_OIDC_TOKEN + NEXT_PUBLIC_* (public values belong in code/deploy defaults),
// honors explicit key list when provided via CLI args.

import fs from "node:fs";
import { spawnSync } from "node:child_process";

const lines = fs
  .readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith("#") && l.includes("=") && !l.startsWith("VERCEL_OIDC_TOKEN"));

const SKIP = new Set(["VERCEL_OIDC_TOKEN"]);
const envPairs = lines.map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()]);

const requested = process.argv.slice(2); // optional explicit keys

function run(key, value, env) {
  const r = spawnSync("npx", ["vercel", "env", "add", key, env, "--force"], {
    input: value,
    encoding: "utf8",
    shell: true,
  });
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.status !== 0) console.log(`  ✗ ${key} → ${out.slice(-200).trim()}`);
  else console.log(`  ✓ ${key} (${env})`);
}

for (const [key, value] of envPairs) {
  if (SKIP.has(key) || key.startsWith("VERCEL_")) continue;
  if (requested.length && !requested.includes(key)) continue;
  run(key, value, "production");
  run(key, value, "preview");
}
console.log("DONE");
