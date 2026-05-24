-- Add weight and height to health_profile for ML feature computation (BMI)
ALTER TABLE public.health_profile
  ADD COLUMN IF NOT EXISTS weight_kg  numeric(5,1),
  ADD COLUMN IF NOT EXISTS height_cm  numeric(5,1);
