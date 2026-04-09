# Esquema BD

## Objetivo

Base minima del MVP para:

- perfil del paciente
- seguimiento de medicamentos
- registro diario
- citas de control

## Tablas

### `public.profiles`

Una fila por usuario autenticado en Supabase.

- `id uuid primary key`
  referencia a `auth.users(id)`
- `full_name text`
- `date_of_birth date`
- `gender text`
- `diagnosis text`
- `sleep_quality smallint`
  escala opcional de 1 a 5
- `exercise_frequency text`
- `diet_notes text`
- `has_medications boolean`
- `has_upcoming_appointment boolean`
- `pending_lab boolean`
- `created_at timestamptz`
- `updated_at timestamptz`

### `public.medications`

Medicamentos activos o historicos asociados a un perfil.

- `id uuid primary key`
- `profile_id uuid`
  referencia a `public.profiles(id)`
- `name text`
- `dosage text`
- `schedule_time time`
- `frequency text`
- `status text`
  valores permitidos: `pending`, `taken`, `skipped`
- `notes text`
- `start_date date`
- `end_date date`
- `created_at timestamptz`
- `updated_at timestamptz`

### `public.appointments`

Citas de control o seguimiento clinico.

- `id uuid primary key`
- `profile_id uuid`
  referencia a `public.profiles(id)`
- `title text`
- `appointment_at timestamptz`
- `provider_name text`
- `location text`
- `notes text`
- `status text`
  valores permitidos: `scheduled`, `completed`, `cancelled`, `missed`
- `created_at timestamptz`
- `updated_at timestamptz`

### `public.daily_logs`

Registro diario de sintomas y bienestar.

- `id uuid primary key`
- `profile_id uuid`
  referencia a `public.profiles(id)`
- `appointment_id uuid nullable`
  referencia opcional a `public.appointments(id)`
- `logged_at timestamptz`
- `symptoms text[]`
- `mood smallint`
  escala opcional de 1 a 5
- `energy smallint`
  escala opcional de 1 a 5
- `pain smallint`
  escala opcional de 0 a 10
- `sleep_hours numeric(4,1)`
- `notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

## Relaciones

- `profiles.id -> auth.users.id`
- `medications.profile_id -> profiles.id`
- `appointments.profile_id -> profiles.id`
- `daily_logs.profile_id -> profiles.id`
- `daily_logs.appointment_id -> appointments.id`

## Seguridad

Todas las tablas tienen Row Level Security activa.

- En `profiles`, cada usuario solo puede leer y modificar su propio perfil.
- En `medications`, `appointments` y `daily_logs`, cada usuario solo puede operar filas cuyo `profile_id` coincida con `auth.uid()`.
