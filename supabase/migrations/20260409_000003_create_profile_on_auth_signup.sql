create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    has_medications,
    has_upcoming_appointment,
    pending_lab
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    false,
    false,
    false
  )
  on conflict (id) do update
  set full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.profiles (
  id,
  full_name,
  has_medications,
  has_upcoming_appointment,
  pending_lab
)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'full_name', users.raw_user_meta_data ->> 'name'),
  false,
  false,
  false
from auth.users as users
where not exists (
  select 1
  from public.profiles
  where profiles.id = users.id
);
