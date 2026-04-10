# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CareMosaic** (branded as CareBridge in the repo) is a patient-facing health management app. It connects patients with their doctors by centralizing health data: medication tracking, daily symptom logs, appointment management, and pre-consultation summaries.

The MVP consists of four features in priority order: onboarding, medication reminders, daily health logging, and insights/alerts.

## Commands

All commands run from the `Frontend/` directory:

```bash
cd Frontend
npm install          # install dependencies
npm run dev          # start Next.js dev server (localhost:3000)
npm run build        # production build
npm run start        # serve production build
```

There is no test runner or linter configured yet.

## Architecture

### Stack
- **Next.js 15** App Router (React 18)
- **Tailwind CSS v4** via `@tailwindcss/postcss` plugin
- **shadcn/ui** components (Radix UI primitives) in `src/app/components/ui/`
- **Framer Motion / Motion** for animations
- **Supabase** for auth (Google OAuth) and PostgreSQL database
- **Recharts** for data visualization

### Directory Structure

```
Frontend/
├── app/                          ← Next.js App Router (routes & layouts)
│   ├── layout.tsx               ← Root layout (AuthProvider, global styles)
│   ├── page.tsx                 ← / (OnboardingPuzzleClean)
│   ├── auth/page.tsx            ← /auth (OnboardingCTA)
│   ├── app/                     ← /app/* (protected routes)
│   │   ├── layout.tsx           ← AuthGuard + ProfileCompletionGuard + MainLayout
│   │   ├── page.tsx             ← /app (HomeScreen)
│   │   ├── medications/         ← /app/medications
│   │   ├── add/                 ← /app/add
│   │   ├── insights/            ← /app/insights
│   │   └── profile/             ← /app/profile, /app/profile/setup
│   └── api/profile/route.ts     ← Server-side profile API
├── lib/                          ← Shared utilities
│   ├── supabase.ts              ← Supabase client (NEXT_PUBLIC_*) + admin client
│   └── utils.ts                 ← cn() helper (clsx + tailwind-merge)
├── components/ui/                ← Custom UI components (cube-loader, demo)
└── src/                          ← Shared component library
    ├── app/
    │   ├── providers/AuthProvider.tsx  ← Auth context (session, profile, Google OAuth)
    │   ├── components/                ← Guards, GlassCard, PillButton, MedicationReminderFeature
    │   │   └── ui/                    ← ~55 shadcn/ui primitives
    │   ├── layouts/MainLayout.tsx     ← Bottom tab nav (mobile shell, max-w-[425px])
    │   └── screens/
    │       ├── main/                  ← 6 authenticated screens
    │       └── onboarding/            ← Onboarding puzzle variants
    └── styles/                        ← CSS (theme.css with oklch tokens, tailwind.css)
```

### Routing Pattern
- Pages in `app/` are thin wrappers that import screen components from `src/app/screens/`
- Public routes: `/`, `/auth` (wrapped by `PublicOnlyRoute`)
- Protected routes: `/app/*` (wrapped by `AuthGuard` → `ProfileCompletionGuard` → `MainLayout`)

### Path Alias
`@/*` maps to `Frontend/` root (defined in `tsconfig.json`). Example: `@/lib/supabase`, `@/components/ui/cube-loader`.

### Auth Flow
1. Google OAuth via `supabase.auth.signInWithOAuth`
2. Postgres trigger (`handle_new_user`) auto-creates a `profiles` row on signup
3. `AuthProvider` context exposes `session`, `user`, `profile`, `signInWithGoogle()`, `signOut()`, `updateProfile()`
4. Access via `useAuth()` hook

### Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY=       # Server-only: service role key (for API routes)
```

### Styling
- Theme tokens in `src/styles/theme.css` as CSS custom properties (oklch color space)
- Glassmorphism aesthetic: `bg-white/50 backdrop-blur-xl`, purple/pink gradients
- `.glass-card` and `.scrollbar-hide` custom utility classes

### Database (Supabase)
- Migrations in `supabase/migrations/`
- Tables: `profiles`, `appointments`, `medications`, `daily_logs`
- All tables use RLS (users access only their own rows)
- All tables FK to `auth.users(id)` with cascade delete

### Non-Frontend Directories
- `Negocio/` -- product strategy docs (business model, user flows, features)
- `Docs/` -- database schema notes, architecture docs
- `Branding/` -- visual identity assets

## Key Conventions
- All interactive components use `"use client"` directive
- Components use named exports (not default)
- shadcn/ui primitives import `cn` from `./utils` (relative within `ui/` directory)
- npm is the package manager (package-lock.json)
