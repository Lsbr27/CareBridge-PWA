# Backend Architecture

## Estado actual del proyecto

El frontend actual existe dentro de `Frontend/` y hoy usa:

- React
- Vite
- React Router
- Supabase desde cliente

La meta es migrarlo a Next.js App Router para soportar:

- `app/` para frontend
- `app/api/` para backend
- despliegue serverless en Vercel

## Objetivo de arquitectura

La arquitectura objetivo queda en 3 capas:

1. Frontend en Next.js
2. Backend con API Routes en Next.js
3. Base de datos en Supabase

El backend debe ser el intermediario entre el cliente y Supabase.

## Variables de entorno

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Tablas actuales de Supabase

- `profiles`
- `medications`
- `daily_logs`
- `appointments`

## Inventario funcional de páginas

### Públicas

- `/`
  muestra onboarding principal
  no consulta ni persiste datos

- `/auth`
  inicia login con Google
  dispara autenticación, sin CRUD directo de negocio

### Protegidas

- `/app`
  muestra saludo, score de salud, resumen y próxima cita
  necesita consultar perfil, medicamentos, citas y registros diarios

- `/app/medications`
  muestra recordatorios y plan de medicación
  necesita consultar, crear, editar y borrar medicamentos

- `/app/add`
  permite agregar síntomas, historial, lifestyle o medicamentos a una selección
  necesita crear registros diarios

- `/app/insights`
  muestra métricas, patrones y recomendaciones
  necesita consultar datos agregados y derivados

- `/app/profile`
  muestra perfil del usuario
  necesita consultar perfil
  en una siguiente iteración debería editar perfil

- `/app/profile/setup`
  captura `full_name`, `date_of_birth`, `gender`, `diagnosis`
  necesita consultar y actualizar perfil

## Mapa inicial de endpoints

### Profile

- `GET /api/profile`
- `PUT /api/profile`

Tabla:

- `profiles`

### Medications

- `GET /api/medications`
- `POST /api/medications`
- `GET /api/medications/[id]`
- `PUT /api/medications/[id]`
- `DELETE /api/medications/[id]`

Tabla:

- `medications`

### Daily Logs

- `GET /api/daily-logs`
- `POST /api/daily-logs`
- `GET /api/daily-logs/[id]`
- `PUT /api/daily-logs/[id]`
- `DELETE /api/daily-logs/[id]`

Tabla:

- `daily_logs`

### Appointments

- `GET /api/appointments`
- `POST /api/appointments`
- `GET /api/appointments/[id]`
- `PUT /api/appointments/[id]`
- `DELETE /api/appointments/[id]`

Tabla:

- `appointments`

### Insights

- `GET /api/insights`

Tablas:

- `profiles`
- `medications`
- `daily_logs`
- `appointments`

## Relación frontend -> backend

- `HomeScreen`
  - `GET /api/profile`
  - `GET /api/appointments`
  - `GET /api/medications`
  - `GET /api/daily-logs`

- `MedicationReminderScreen`
  - `GET /api/medications`
  - `POST /api/medications`
  - `PUT /api/medications/[id]`
  - `DELETE /api/medications/[id]`

- `AddDataScreen`
  - `POST /api/daily-logs`

- `InsightsScreen`
  - `GET /api/insights`

- `ProfileScreen`
  - `GET /api/profile`

- `ProfileSetupScreen`
  - `GET /api/profile`
  - `PUT /api/profile`

## Estructura sugerida de archivos

- `app/api/profile/route.ts`
- `app/api/medications/route.ts`
- `app/api/medications/[id]/route.ts`
- `app/api/daily-logs/route.ts`
- `app/api/daily-logs/[id]/route.ts`
- `app/api/appointments/route.ts`
- `app/api/appointments/[id]/route.ts`
- `app/api/insights/route.ts`
- `lib/supabase.ts`

## Patrón de conexión con Supabase

`lib/supabase.ts` debe centralizar:

- cliente público con:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- cliente admin para API Routes con:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Validaciones mínimas

### `/api/profile`

- `id` requerido para consultar o actualizar
- en setup:
  - `full_name` requerido
  - `date_of_birth` requerido
  - `gender` requerido

### `/api/medications`

- `name` requerido
- `profile_id` requerido
- `status` válido:
  - `pending`
  - `taken`
  - `skipped`

### `/api/daily-logs`

- `profile_id` requerido
- `mood` entre 1 y 5
- `energy` entre 1 y 5
- `pain` entre 0 y 10

### `/api/appointments`

- `profile_id` requerido
- `appointment_at` requerido
- `status` válido:
  - `scheduled`
  - `completed`
  - `cancelled`
  - `missed`

## Patrón de respuesta

Éxito:

```json
{ "data": {} }
```

Error:

```json
{ "error": "message" }
```

## Orden recomendado de implementación

1. `GET /api/profile`
2. `PUT /api/profile`
3. `GET /api/medications`
4. `POST /api/medications`
5. `GET /api/appointments`
6. `POST /api/appointments`
7. `GET /api/daily-logs`
8. `POST /api/daily-logs`
9. `GET /api/insights`
10. endpoints por `id`

## Primer endpoint a implementar

### `GET /api/profile`

Motivo:

- desbloquea `HomeScreen`
- desbloquea `ProfileScreen`
- desbloquea `ProfileSetupScreen`
- es el recurso más básico y útil para empezar

## Notas de migración

- El proyecto actual debe dejar Vite y adoptar Next.js App Router.
- `Frontend/vercel.json` con rewrite a `index.html` debe eliminarse al migrar a Next.js.
- Durante la primera iteración, los endpoints pueden recibir `id` vía query string mientras se termina de cerrar la integración entre sesión de Supabase y API Routes.
