-- Historial persistente de conversaciones con CareGuide
create table if not exists chat_messages (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  text_content     text,
  has_image        boolean not null default false,
  tools_used       text[] not null default '{}',
  is_exam_analysis boolean not null default false,
  created_at       timestamptz not null default now()
);

alter table chat_messages enable row level security;

create policy "Users manage own chat messages"
  on chat_messages for all
  using  (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create index chat_messages_profile_created
  on chat_messages (profile_id, created_at desc);
