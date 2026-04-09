# Migraciones

## Estado actual

Primera migracion aplicada en Supabase el `2026-04-09`:

- `init_core_tables`

## Archivo versionado

- `supabase/migrations/20260409_000001_init_core_tables.sql`
- `supabase/migrations/20260409_000002_fix_set_updated_at_search_path.sql`
- `supabase/migrations/20260409_000003_create_profile_on_auth_signup.sql`

## Que crea

- extension `pgcrypto`
- funcion `public.set_updated_at()`
- tablas `profiles`, `medications`, `appointments`, `daily_logs`
- indices basicos por perfil y fecha
- triggers para `updated_at`
- politicas RLS por usuario autenticado
- ajuste de `search_path` en la funcion trigger para evitar warnings del linter
- trigger para crear `profiles` automaticamente al registrarse un usuario en `auth.users`
