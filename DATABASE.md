# Cura — Data Model (Supabase Postgres)

## ER overview
```
auth.users (supabase managed)
   │ 1:1
profiles ──▶ households (1 household = Maria + caregiver; holds ROUTE_ALL_TO_ME numbers)
               ├── medications (patient's meds, refill lifecycle)
               ├── appointments ( slot inventory + bookings )
               ├── checkins (1 per voice/text session) ── 1:N symptom_events
               │                                      └── 1:N actions (tool receipts)
               ├── calls (twilio calls: clinic_booking | crisis_outreach)
               └── caregiver_notifications (urgent/crisis alerts)
```

## Tables (run in Supabase SQL editor; file copy at supabase/schema.sql)
```sql
create type profile_role as enum ('patient','caregiver');
create type severity       as enum ('low','medium','high','crisis');
create type call_purpose   as enum ('clinic_booking','crisis_outreach');
create type call_status    as enum ('ringing','in-progress','completed','failed');

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  clinic_phone text,              -- E164; demo = builder's verified cell (ROUTE_ALL_TO_ME)
  emergency_contact_phone text,   -- E164; demo = same cell
  created_at timestamptz not null default now()
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role profile_role not null,
  household_id uuid not null references households(id)
);

create table medications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  name text not null,                        -- 'Metformin'
  dosage text,                               -- '500mg — 2x daily'
  refill_status text not null default 'ok',  -- ok | requested | ordered
  last_refill_at timestamptz
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  grade severity not null,                   -- overall session grade
  summary_text text,                         -- spoken-back summary
  thread jsonb,                              -- [{role,'text'}]
  started_at timestamptz not null default now()
);

create table symptom_events (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins(id) on delete cascade,
  description text not null,
  severity severity not null
);

create table actions (                       -- one row per executed tool = one ActionCard
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins(id) on delete cascade,
  tool text not null,        -- log_symptom|check_meds|request_refill|book_appointment|
                             -- notify_caregiver|crisis_alert
  status text not null default 'succeeded',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  provider text not null,        -- 'Dr. Chen — Internal Medicine, Sunnyvale Clinic'
  slot timestamptz not null,
  status text not null default 'hold',   -- hold | booked | kept | unused
  via text not null default 'web',        -- web | phone
  booked_by_call_id uuid                  -- set when booked during a call
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  purpose call_purpose not null,
  provider_call_sid text unique,
  to_number text not null,
  status call_status not null default 'ringing',
  transcript jsonb,                         -- text turns only, no recordings
  started_at timestamptz not null default now()
);

create table caregiver_notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  checkin_id uuid references checkins(id),
  level text not null,                      -- info | urgent | crisis
  message text not null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

-- open slot inventory (no real booking API — preseeded)
insert into appointments (household_id, provider, slot) …  -- see seed below
```

## Keys & integrity
- All PKs `uuid default gen_random_uuid()`; `household_id` is the RLS scoping key.
- `symptom_events`/`actions` children of `checkins` (cascade = clean demo resets).
- `medications.refill_status` drives the refill story; `appointments` are preseeded
  slots; booking marks `booked` + `via='phone'` + `booked_by_call_id`.

## RLS (enable on ALL tables)
```sql
alter table households enable row level security;
-- (repeat enable for: profiles, medications, checkins, symptom_events,
--  actions, appointments, calls, caregiver_notifications)

create or replace function current_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from profiles where user_id = auth.uid()
$$;

-- per-table pattern (repeat for every household-scoped table):
create policy "household rw" on medications
  for all using (household_id = current_household())
  with check (household_id = current_household());
```
- `/api/agent`, `/api/call`, telephony webhooks use the **service-role key server-side**
  (bypasses RLS; the house the agent writes through). Client pages use anon key + RLS.
- No public tables; no anon writes.

## Seed (SQL editor, after tables) — demo household
```sql
insert into households (id, name) values
  ('11111111-1111-1111-1111-111111111111','Demo Household');
-- set phones to the verified demo cell once filled in .env.local:

update households set clinic_phone='+1XXXXXXXXX',
  emergency_contact_phone='+1XXXXXXXXX'
  where id='11111111-1111-1111-1111-111111111111';

insert into medications (household_id, name, dosage) values
  ('11111111-1111-1111-1111-111111111111','Metformin','500mg — 2x daily'),
  ('11111111-1111-1111-1111-111111111111','Lisinopril','10mg — 1x morning'),
  ('11111111-1111-1111-1111-111111111111','Atorvastatin','20mg — nightly');

insert into appointments (household_id, provider, slot, status) values
  ('11111111-1111-1111-1111-111111111111','Dr. Chen — Internal Medicine, Sunnyvale Clinic', now()+interval '2 days 10:00','hold'),
  ('11111111-1111-1111-1111-111111111111','Dr. Chen — Internal Medicine, Sunnyvale Clinic', now()+interval '3 days 14:30','hold'),
  ('11111111-1111-1111-1111-111111111111','Dr. Patel — Cardiology, Sunnyvale Clinic', now()+interval '2 days 15:00','hold');
```
- Demo magic-link accounts: `maria.cura.demo@…` + `son.cura.demo@…`; after first login,
  set their `profiles` rows (role + household) in SQL — no profile management UI.
