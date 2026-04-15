# CareBridge (CareMosaic)

App de salud para pacientes cronicos. Centraliza medicamentos, citas, sintomas diarios y resumenes pre-consulta en un solo lugar.

## Stack

- **Frontend:** Next.js 15 (App Router) + React 18 + Tailwind CSS v4
- **UI:** shadcn/ui (Radix UI) + Framer Motion
- **Backend:** Supabase (PostgreSQL + Auth con Google OAuth)
- **Package manager:** npm

## Estructura del repo

```
Frontend/          → App Next.js (todo el codigo fuente)
supabase/          → Migraciones SQL de la base de datos
Docs/              → Documentacion tecnica (esquema BD, arquitectura)
Negocio/           → Modelo de negocio, flujos de usuario, features
Branding/          → Identidad visual (moodboard, colores, tipografias)
Arquitectura/      → Decisiones de stack y arquitectura
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
│   └── api/profile/route.ts     → API route server-side
├── lib/                          → Utilidades compartidas
│   ├── supabase.ts              → Cliente Supabase (public + admin)
│   └── utils.ts                 → cn() helper
├── components/ui/                → Componentes UI custom (cube-loader)
└── src/                          → Libreria de componentes compartida
    └── app/
        ├── providers/            → AuthProvider (contexto de auth)
        ├── components/           → Guards, GlassCard, PillButton, shadcn/ui
        ├── layouts/              → MainLayout (nav inferior mobile)
        ├── screens/main/         → 6 pantallas autenticadas
        ├── screens/onboarding/   → Variantes del puzzle de onboarding
        └── styles/               → CSS (tema oklch, Tailwind)
```

### Patron de navegacion

- Las pages en `app/` son thin wrappers que importan screen components de `src/app/screens/`
- Rutas publicas envueltas por `PublicOnlyRoute` (redirige a `/app` si ya hay sesion)
- Rutas protegidas envueltas por `AuthGuard` → `ProfileCompletionGuard` → `MainLayout`

## Base de datos (Supabase)

Migraciones en `supabase/migrations/`:

1. **init_core_tables** → Tablas `profiles`, `appointments`, `medications`, `daily_logs` con RLS
2. **fix_set_updated_at** → Fix de search path para trigger
3. **create_profile_on_auth_signup** → Trigger que crea perfil automaticamente al registrarse

Todas las tablas usan Row Level Security (los usuarios solo acceden a sus propios datos).

## Migracion Vite → Next.js (completada)

El frontend fue generado originalmente por Figma AI sobre Vite + React Router. Se completo la migracion a Next.js 15 App Router:

- Eliminados archivos de Vite (`index.html`, `vite.config.ts`, `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`)
- Migrados 4 onboarding screens de `react-router` (`useNavigate`) a `next/navigation` (`useRouter`)
- Removidas dependencias muertas: `vite`, `react-router`, `@mui/material`, `@emotion/*`, `react-dnd`
- Variables de entorno migradas de `VITE_*` a `NEXT_PUBLIC_*`
- Build y dev server verificados sin errores
