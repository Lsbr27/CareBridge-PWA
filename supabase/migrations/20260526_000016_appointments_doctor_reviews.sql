-- Add doctor-related columns to appointments
alter table public.appointments
  add column if not exists doctor_slug text,
  add column if not exists specialty text,
  add column if not exists doctor_notes text,
  add column if not exists patient_rating smallint check (patient_rating between 1 and 5),
  add column if not exists patient_review text;

-- Public doctor reviews table (readable by all authenticated users)
create table if not exists public.doctor_reviews (
  id uuid primary key default gen_random_uuid(),
  doctor_slug text not null,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  appointment_id uuid unique references public.appointments(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  reviewer_name text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists doctor_reviews_doctor_slug_idx
  on public.doctor_reviews(doctor_slug);

alter table public.doctor_reviews enable row level security;

create policy "doctor_reviews_select_authenticated"
  on public.doctor_reviews for select
  using (auth.role() = 'authenticated');

create policy "doctor_reviews_insert_own"
  on public.doctor_reviews for insert
  with check (auth.uid() = profile_id);

create policy "doctor_reviews_update_own"
  on public.doctor_reviews for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);
