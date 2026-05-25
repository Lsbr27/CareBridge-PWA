-- Tabla para documentos de exámenes médicos analizados por IA
create table if not exists exam_documents (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references profiles(id) on delete cascade,
  image_path   text not null,
  analysis_text text,
  uploaded_at  timestamptz not null default now()
);

alter table exam_documents enable row level security;

create policy "Users manage own exams"
  on exam_documents for all
  using  (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

-- Storage bucket para imágenes de exámenes (privado, RLS por carpeta de usuario)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'medical-exams',
    'medical-exams',
    false,
    5242880,  -- 5 MB máximo por archivo
    array['image/jpeg','image/png','image/webp','image/heic']
  )
  on conflict (id) do nothing;

create policy "Users upload own exams"
  on storage.objects for insert
  with check (
    bucket_id = 'medical-exams'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users read own exams"
  on storage.objects for select
  using (
    bucket_id = 'medical-exams'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users delete own exams"
  on storage.objects for delete
  using (
    bucket_id = 'medical-exams'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
