-- Cura Supabase schema — paste into Supabase SQL editor (or supabase db push).
-- Derived from DATABASE.md. See seed at the bottom (phones = the demo verified cell).

create type profile_role as enum ('patient','caregiver');
create type severity       as enum ('low','medium','high','crisis');
create type call_purpose   as enum ('clinic_booking','crisis_outreach');
create type call_status    as enum ('ringing','in-progress','completed','failed');

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  clinic_phone text,
  emergency_contact_phone text,
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
  name text not null,
  dosage text,
  refill_status text not null default 'ok',
  last_refill_at timestamptz
);

create table checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  grade severity not null,
  summary_text text,
  thread jsonb,
  started_at timestamptz not null default now()
);

create table symptom_events (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins(id) on delete cascade,
  description text not null,
  severity severity not null
);

create table actions (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references checkins(id) on delete cascade,
  tool text not null,
  status text not null default 'succeeded',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create table appointments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  provider text not null,
  slot timestamptz not null,
  status text not null default 'hold',
  via text not null default 'web',
  booked_by_call_id uuid
);

create table calls (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  purpose call_purpose not null,
  provider_call_sid text unique,
  to_number text not null,
  status call_status not null default 'ringing',
  transcript jsonb,
  started_at timestamptz not null default now()
);

create table caregiver_notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id),
  checkin_id uuid references checkins(id),
  level text not null,
  message text not null,
  acknowledged boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS on everything
alter table households enable row level security;
alter table profiles enable row level security;
alter table medications enable row level security;
alter table checkins enable row level security;
alter table symptom_events enable row level security;
alter table actions enable row level security;
alter table appointments enable row level security;
alter table calls enable row level security;
alter table caregiver_notifications enable row level security;

create or replace function current_household() returns uuid
language sql stable security definer set search_path = public as $$
  select household_id from profiles where user_id = auth.uid()
$$;

-- household-scoped policy pattern (repeat per table)
create policy "household rw households" on households
  for select using (id = current_household());
create policy "household rw profiles" on profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "household rw medications" on medications
  for all using (household_id = current_household()) with check (household_id = current_household());
create policy "household rw checkins" on checkins
  for all using (household_id = current_household()) with check (household_id = current_household());
create policy "household rw symptom_events" on symptom_events
  for all using (checkin_id in (
    select id from checkins where household_id = current_household()))
  with check (true);
create policy "household rw actions" on actions
  for all using (checkin_id in (
    select id from checkins where household_id = current_household()))
  with check (true);
create policy "household rw appointments" on appointments
  for all using (household_id = current_household()) with check (household_id = current_household());
create policy "household rw calls" on calls
  for all using (household_id = current_household()) with check (household_id = current_household());
create policy "household rw notifications" on caregiver_notifications
  for all using (household_id = current_household()) with check (household_id = current_household());

-- ============================== SEED =================================
-- Demo household; phones get real values after .env.local is filled.
insert into households (id, name) values
  ('11111111-1111-1111-1111-111111111111', 'Demo Household');

-- replace +1XXXXXXXXX with the verified demo cell:
-- update households set clinic_phone      = '+1XXXXXXXXX',
--                     emergency_contact_phone = '+1XXXXXXXXX'
--   where id = '11111111-1111-1111-1111-111111111111';

insert into medications (household_id, name, dosage) values
  ('11111111-1111-1111-1111-111111111111', 'Metformin',     '500mg — 2x daily'),
  ('11111111-1111-1111-1111-111111111111', 'Lisinopril',    '10mg — 1x morning'),
  ('11111111-1111-1111-1111-111111111111', 'Atorvastatin',  '20mg — nightly');

insert into appointments (household_id, provider, slot, status) values
  ('11111111-1111-1111-1111-111111111111', 'Dr. Chen — Internal Medicine, Sunnyvale Clinic', now() + interval '2 days 10:00', 'hold'),
  ('11111111-1111-1111-1111-111111111111', 'Dr. Chen — Internal Medicine, Sunnyvale Clinic', now() + interval '3 days 14:30', 'hold'),
  ('11111111-1111-1111-1111-111111111111', 'Dr. Patel — Cardiology, Sunnyvale Clinic',      now() + interval '2 days 15:00', 'hold');
