create table if not exists public.health_samples (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  metric text not null check (
    metric in (
      'steps',
      'sleep_hours',
      'heart_rate_resting',
      'weight_kg',
      'blood_pressure_systolic',
      'blood_pressure_diastolic'
    )
  ),
  value numeric not null check (value >= 0),
  unit text not null,
  measured_at timestamptz not null,
  source text not null default 'apple_health' check (source in ('apple_health', 'manual')),
  external_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uq_health_samples_dedup
  on public.health_samples (
    profile_id,
    source,
    metric,
    measured_at,
    coalesce(external_id, '')
  );

create index if not exists idx_health_samples_profile_metric_time
  on public.health_samples(profile_id, metric, measured_at desc);

drop trigger if exists trg_health_samples_updated_at on public.health_samples;
create trigger trg_health_samples_updated_at
before update on public.health_samples
for each row
execute function public.set_updated_at();

alter table public.health_samples enable row level security;

drop policy if exists "health_samples_select_own" on public.health_samples;
create policy "health_samples_select_own"
on public.health_samples
for select
to authenticated
using (auth.uid() = profile_id);

drop policy if exists "health_samples_insert_own" on public.health_samples;
create policy "health_samples_insert_own"
on public.health_samples
for insert
to authenticated
with check (auth.uid() = profile_id);

drop policy if exists "health_samples_update_own" on public.health_samples;
create policy "health_samples_update_own"
on public.health_samples
for update
to authenticated
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

