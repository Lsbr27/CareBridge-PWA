create table if not exists public.apple_health_connections (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'not_connected' check (status in ('not_connected', 'pending', 'connected')),
  requested_at timestamptz,
  connected_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_apple_health_connections_updated_at on public.apple_health_connections;
create trigger trg_apple_health_connections_updated_at
before update on public.apple_health_connections
for each row
execute function public.set_updated_at();

alter table public.apple_health_connections enable row level security;

drop policy if exists "apple_health_connections_select_own" on public.apple_health_connections;
create policy "apple_health_connections_select_own"
on public.apple_health_connections
for select
to authenticated
using (auth.uid() = profile_id);

drop policy if exists "apple_health_connections_insert_own" on public.apple_health_connections;
create policy "apple_health_connections_insert_own"
on public.apple_health_connections
for insert
to authenticated
with check (auth.uid() = profile_id);

drop policy if exists "apple_health_connections_update_own" on public.apple_health_connections;
create policy "apple_health_connections_update_own"
on public.apple_health_connections
for update
to authenticated
using (auth.uid() = profile_id)
with check (auth.uid() = profile_id);

