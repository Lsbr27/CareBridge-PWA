CREATE TABLE IF NOT EXISTS public.health_profile (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade unique,
  sleep_hours numeric(4,1),
  sleep_quality text,
  wake_up_feeling text,
  physical_activity_frequency text,
  physical_activity_type text,
  typical_diet text,
  meal_times text,
  contraceptives text,
  menstrual_cycle text,
  sexual_activity text,
  mood_general text,
  stress_level text,
  profession text,
  work_schedule text,
  daily_routine text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

ALTER TABLE public.health_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own health profile"
ON public.health_profile
FOR ALL USING (
  profile_id = (SELECT id FROM public.profiles WHERE id = auth.uid())
);
