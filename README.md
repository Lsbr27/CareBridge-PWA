# CareBridge (CareMosaic)

App de salud para pacientes cronicos. Centraliza medicamentos, citas, sintomas diarios y resumenes pre-consulta en un solo lugar.

## Stack

- **Frontend:** Next.js 15 (App Router) + React 18 + Tailwind CSS v4
- **UI:** shadcn/ui (Radix UI) + Framer Motion
- **Backend:** Supabase (PostgreSQL + Auth con Google OAuth)
- **API:** Next.js API Routes (server-side, `app/api/`)
- **Package manager:** npm

## Estructura del repo

```
Frontend/          → App Next.js (frontend + API routes)
supabase/          → Migraciones SQL de la base de datos
Docs/              → Documentacion tecnica
  ├── backend/     → Especificacion de endpoints API
  ├── arquitectura/→ Arquitectura backend
  └── Base_Datos/  → Esquema y notas de BD
Negocio/           → Modelo de negocio, flujos de usuario, features
Branding/          → Identidad visual (moodboard, colores, tipografias)
Arquitectura/      → Decisiones de stack
```

## Ejecutar en local

```bash
cd Frontend
npm install
npm run dev          # http://localhost:3000
npm run build        # build de produccion
npm run start        # servir build de produccion
```

### Variables de entorno

Crear `Frontend/.env.local` basado en `Frontend/.env.example`:

```
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key    # solo para API routes server-side
```

### Google OAuth (Supabase)

1. Habilitar Google en `Supabase Dashboard > Auth > Providers`
2. Agregar `http://localhost:3000` como origen autorizado en Google Cloud
3. Agregar la callback URL de Supabase como redirect URI en Google Cloud
4. Agregar `http://localhost:3000/app` al redirect allow list de Supabase

Cuando un usuario se registra via Google, un trigger en Postgres crea automaticamente su fila en `public.profiles`.

---

## Arquitectura del Frontend

### Rutas

| Ruta | Pantalla | Acceso |
|------|----------|--------|
| `/` | Onboarding (puzzle interactivo) | Publica |
| `/auth` | Login con Google | Publica |
| `/app` | Dashboard (Home) | Protegida |
| `/app/medications` | Recordatorios de medicamentos | Protegida |
| `/app/add` | Agregar datos de salud | Protegida |
| `/app/insights` | Insights y metricas | Protegida |
| `/app/profile` | Perfil del usuario | Protegida |
| `/app/profile/setup` | Setup inicial del perfil | Protegida |

### Estructura de directorios

```
Frontend/
├── app/                          → Next.js App Router (rutas y layouts)
│   ├── layout.tsx               → Layout raiz (AuthProvider, estilos globales)
│   ├── page.tsx                 → / (OnboardingPuzzleClean)
│   ├── auth/page.tsx            → /auth (login con Google)
│   ├── app/                     → /app/* (rutas protegidas)
│   │   ├── layout.tsx           → AuthGuard + ProfileCompletionGuard + MainLayout
│   │   └── [subrutas]/page.tsx  → Cada pantalla protegida
│   └── api/profile/route.ts     → API route server-side (unico endpoint existente)
├── lib/                          → Utilidades compartidas
│   ├── supabase.ts              → Cliente Supabase (public + admin)
│   └── utils.ts                 → cn() helper
├── components/ui/                → Componentes UI custom (cube-loader)
└── src/                          → Libreria de componentes compartida
    └── app/
        ├── providers/            → AuthProvider (contexto de auth)
        ├── components/           → Guards, GlassCard, PillButton, shadcn/ui (~55 primitivos)
        ├── layouts/              → MainLayout (nav inferior mobile, max-w-[425px])
        ├── screens/main/         → 6 pantallas autenticadas
        ├── screens/onboarding/   → Variantes del puzzle de onboarding
        └── styles/               → CSS (tema oklch, Tailwind v4)
```

### Patron de navegacion

- Las pages en `app/` son thin wrappers que importan screen components de `src/app/screens/`
- Rutas publicas envueltas por `PublicOnlyRoute` (redirige a `/app` si ya hay sesion)
- Rutas protegidas envueltas por `AuthGuard` → `ProfileCompletionGuard` → `MainLayout`
- Todos los componentes interactivos usan `"use client"` y `next/navigation` para routing

### Flujo de autenticacion

1. Usuario llega a `/` → ve onboarding puzzle → swipe up → boton "Get Started"
2. Navega a `/auth` → click "Continue with Google"
3. Google OAuth via `supabase.auth.signInWithOAuth` → redirect a `/app`
4. Trigger en Postgres (`handle_new_user`) crea fila en `profiles` automaticamente
5. `ProfileCompletionGuard` detecta perfil incompleto → redirige a `/app/profile/setup`
6. Usuario completa setup → accede al dashboard

---

## Base de datos (Supabase)

### Tablas

| Tabla | Descripcion | Campos principales |
|-------|-------------|-------------------|
| `profiles` | Datos del paciente | full_name, date_of_birth, gender, diagnosis, sleep_quality, exercise_frequency |
| `medications` | Medicamentos y recordatorios | name, dosage, schedule_time, frequency, status (pending/taken/skipped) |
| `daily_logs` | Registro diario de salud | symptoms[], mood (1-5), energy (1-5), pain (0-10), sleep_hours, notes |
| `appointments` | Citas medicas | title, appointment_at, provider_name, location, status (scheduled/completed/cancelled) |

### Migraciones

En `supabase/migrations/`:

1. **init_core_tables** → Crea las 4 tablas con RLS, indices, y trigger `set_updated_at`
2. **fix_set_updated_at** → Fix de search path para el trigger
3. **create_profile_on_auth_signup** → Trigger que auto-crea perfil al registrarse

Todas las tablas usan Row Level Security: cada usuario solo puede acceder a sus propios datos via `auth.uid() = profile_id`.

---

## API Backend

### Estado actual

Solo existe 1 endpoint: `POST /api/profile` (upsert de perfil).

Se necesitan **17 endpoints adicionales** para conectar el frontend con la BD. Ver documentacion completa en [`Docs/backend/endpoints.md`](Docs/backend/endpoints.md).

### Resumen de endpoints necesarios

| Dominio | GET | POST | PUT/PATCH | DELETE | Total |
|---------|-----|------|-----------|--------|-------|
| Profiles | - | Existe | 1 falta | - | 1 |
| Medications | 1 | 1 | 2 | 1 | 5 |
| Daily Logs | 1 | 1 | 1 | 1 | 4 |
| Appointments | 1 | 1 | 1 | 1 | 4 |
| Insights | 4 | - | - | - | 4 |
| **Total** | **7** | **3** | **5** | **3** | **18** |

### Estructura de API Routes propuesta

```
Frontend/app/api/
├── profile/route.ts              ← EXISTE
├── medications/
│   ├── route.ts                  ← GET + POST
│   └── [id]/
│       ├── route.ts              ← PUT + DELETE
│       └── status/route.ts       ← PATCH (tomado/saltado)
├── daily-logs/
│   ├── route.ts                  ← GET + POST
│   └── [id]/route.ts             ← PUT + DELETE
├── appointments/
│   ├── route.ts                  ← GET + POST
│   └── [id]/route.ts             ← PATCH + DELETE
└── insights/
    ├── health-score/route.ts     ← GET
    ├── metrics/route.ts          ← GET
    ├── patterns/route.ts         ← GET
    └── alerts/route.ts           ← GET
```

### Prioridad de implementacion

| Prioridad | Que | Por que |
|-----------|-----|---------|
| **P0** | Daily Logs (POST + GET) | Boton "Save to My Mosaic" no funciona -- datos del usuario se pierden |
| **P0** | Medications (GET + POST) | Pantalla de medicamentos 100% mock data |
| **P1** | Medications status (PATCH) | No se puede marcar medicamento como tomado |
| **P1** | Appointments (GET + POST) | Citas 100% hardcoded |
| **P1** | Profile (PATCH) | Perfil no se puede editar post-setup |
| **P2** | CRUD completo (PUT/DELETE) | Editar y eliminar registros |
| **P3** | Insights (4 endpoints) | Requiere datos reales para calcular |

---

## Pantallas -- Estado de integracion

| Pantalla | UI | Datos reales | Acciones funcionales | Estado |
|----------|:--:|:------------:|:--------------------:|--------|
| Onboarding | OK | N/A | OK | Completa |
| Auth (login) | OK | Supabase Auth | OK | Completa |
| Profile Setup | OK | Supabase | OK (guarda perfil) | Completa |
| Home | OK | Hardcoded | 0 de 3 botones | Solo UI |
| Medications | OK | Hardcoded | 0 de 3 botones | Solo UI |
| Add Data | OK | Hardcoded | 0 de 1 boton (Save) | Solo UI |
| Insights | OK | Hardcoded | 0 de 1 boton | Solo UI |
| Profile | OK | Parcial | 0 de 4 botones (Edit, Settings) | Solo UI |

---

## Historial de migracion

El frontend fue generado por Figma AI sobre Vite + React Router. Se completo la migracion a Next.js 15:

- Eliminados archivos de Vite (`index.html`, `vite.config.ts`, `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`)
- Migrados 4 onboarding screens de `react-router` (`useNavigate`) a `next/navigation` (`useRouter`)
- Removidas 12 dependencias muertas: `vite`, `react-router`, `@mui/material`, `@emotion/*`, `react-dnd`, `react-popper`
- Variables de entorno migradas de `VITE_*` a `NEXT_PUBLIC_*`
- Build y dev server verificados sin errores
