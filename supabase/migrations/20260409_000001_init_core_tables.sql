create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  date_of_birth date,
  gender text,
  diagnosis text,
  sleep_quality smallint check (sleep_quality between 1 and 5),
  exercise_frequency text,
  diet_notes text,
  has_medications boolean not null default false,
  has_upcoming_appointment boolean not null default false,
  pending_lab boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default 'Control appointment',
  appointment_at timestamptz not null,
  provider_name text,
  location text,
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'missed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.medications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  dosage text,
  schedule_time time,
  frequency text,
  status text not null default 'pending' check (status in ('pending', 'taken', 'skipped')),
  notes text,
  start_date date,
  end_date date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  logged_at timestamptz not null default timezone('utc', now()),
  symptoms text[] not null default '{}',
  mood smallint check (mood between 1 and 5),
  energy smallint check (energy between 1 and 5),
  pain smallint check (pain between 0 and 10),
  sleep_hours numeric(4,1),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists appointments_profile_id_appointment_at_idx
  on public.appointments (profile_id, appointment_at desc);

create index if not exists medications_profile_id_schedule_time_idx
  on public.medications (profile_id, schedule_time);

create index if not exists daily_logs_profile_id_logged_at_idx
  on public.daily_logs (profile_id, logged_at desc);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create trigger set_appointments_updated_at
before update on public.appointments
for each row
execute function public.set_updated_at();

create trigger set_medications_updated_at
before update on public.medications
for each row
execute function public.set_updated_at();

create trigger set_daily_logs_updated_at
before update on public.daily_logs
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.medications enable row level security;
alter table public.daily_logs enable row level security;

create policy "profiles_select_own"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_insert_own"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "profiles_delete_own"
on public.profiles
for delete
using (auth.uid() = id);

create policy "appointments_select_own"
on public.appointments
for select
using (auth.uid() = profile_id);

create policy "appointments_insert_own"
on public.appointments
for insert
with check (auth.uid() = profile_id);

create policy "appointments_update_own"
on public.appointments
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

create policy "appointments_delete_own"
on public.appointments
for delete
using (auth.uid() = profile_id);

create policy "medications_select_own"
on public.medications
for select
using (auth.uid() = profile_id);

create policy "medications_insert_own"
on public.medications
for insert
with check (auth.uid() = profile_id);

create policy "medications_update_own"
on public.medications
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

create policy "medications_delete_own"
on public.medications
for delete
using (auth.uid() = profile_id);

create policy "daily_logs_select_own"
on public.daily_logs
for select
using (auth.uid() = profile_id);

create policy "daily_logs_insert_own"
on public.daily_logs
for insert
with check (auth.uid() = profile_id);

create policy "daily_logs_update_own"
on public.daily_logs
for update
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

create policy "daily_logs_delete_own"
on public.daily_logs
for delete
using (auth.uid() = profile_id);
