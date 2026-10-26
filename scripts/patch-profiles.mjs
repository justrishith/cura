// scripts/patch-profiles.mjs — one-shot: auto-profile trigger (seed gap fix).
// The schema.sql seed couldn't insert profiles because auth.users is empty until
// someone actually magic-links in. This installs the standard handle_new_user
// trigger so the FIRST login gets a profile row, bound to the demo household.
// Read-only secret handling: uses SUPABASE_TOKEN from env, prints nothing sensitive.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_TOKEN;
const REF = (() => {
  const env = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const m = env.match(/^NEXT_PUBLIC_SUPABASE_URL=https:\/\/([^.]+)\.supabase\.co$/m);
  return m?.[1] ?? "efbgwosligdvtmxrdipx";
})();

const SQL = /* sql */ `
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, display_name, role, household_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'caregiver')::profile_role,
    (select id from public.households order by created_at limit 1)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

select 'trigger-installed' as result;
`;

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query: SQL }),
});
const text = await res.text();
console.log(`[${res.status}]`, text.slice(0, 400));
process.exit(res.ok ? 0 : 1);
