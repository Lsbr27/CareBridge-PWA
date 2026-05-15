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

---

## ML Health Risk Agent

A Python ML pipeline that trains disease risk classifiers to power the app's insights/alerts feature.

### ML Commands

All commands run from the repo root:

```bash
# 1. Build all datasets (Supabase + NHANES CDC)
python src/data/build_dataset.py           # uses cache if CSVs exist
python src/data/build_dataset.py --force   # re-run everything

# 2. Individual steps (called by build_dataset.py)
python src/data/load_from_supabase.py      # loads brfss_clean + unified_features
python src/data/download_nhanes.py         # downloads 8 .xpt files, merges by SEQN

# 3. Train models
python src/models/train_multidisease.py    # Model 1: 4 binary classifiers on BRFSS
python src/models/train_diabetes_lab.py    # Model 2: diabetes with NHANES lab data (pending)
```

### ML Directory Structure

```
src/
├── data/
│   ├── build_dataset.py          ← orchestrator: Supabase + NHANES, --force flag, exit 0/1
│   ├── load_from_supabase.py     ← paginates brfss_clean (10k rows/page), loads unified_features
│   └── download_nhanes.py        ← downloads 8 NHANES .xpt files, merges by SEQN→participant_id
└── models/
    ├── train_multidisease.py     ← Model 1: XGBClassifier × 4 conditions, SHAP top-5
    └── train_diabetes_lab.py     ← Model 2: NHANES lab + PIMA screening (pending)

data/
├── processed/
│   ├── brfss_clean.csv           ← 387,566 rows from ml_data.brfss_clean
│   └── unified_features.csv      ← 1,142 rows (768 PIMA + 374 Sleep), ml_data.unified_features
└── nhanes/
    ├── raw/                      ← cached .xpt files (DEMO_L, GHB_L, GLU_L, INS_L, TCHOL_L, HDL_L, TRIGLY_L, DIQ_L)
    ├── nhanes_lab_merged.csv     ← full NHANES join by participant_id
    └── nhanes_lab_fasting.csv    ← subset: LBDGLUSI AND LBDINSI both non-null

models/
├── multidisease_{condition}.joblib     ← one per condition: diabetes, heart_disease, depression, asthma
├── multidisease_shap_top5.json
├── diabetes_lab.joblib                 ← NHANES lab model (pending)
├── diabetes_screening.joblib           ← fallback without lab (pending)
└── diabetes_shap_top5.json
```

### Supabase ML Schema (`ml_data`)

The project has a dedicated `ml_data` schema (separate from `public` app data):

| Table | Rows | Description |
|---|---|---|
| `ml_data.brfss_clean` | 387,566 | BRFSS 2023, columns in Spanish, `_enc` suffix = encoded |
| `ml_data.brfss_features` | 387,566 | Same rows, English col names, `has_*_bin` binary flags |
| `ml_data.pima_diabetes` | 768 | PIMA Indians Diabetes Dataset |
| `ml_data.sleep_health` | 374 | Sleep Health and Lifestyle Dataset |
| `ml_data.unified_features` | 1,142 | PIMA + Sleep joined with median imputation, `source` col |

### Key Data Decisions

**BRFSS table choice:** Use `ml_data.brfss_clean` (not `brfss_features`) for training. Column names are in Spanish snake_case.

**7 binary disease targets — only 4 available in brfss_clean:**

| Target | Column in brfss_clean | Available |
|---|---|---|
| `has_diabetes_bin` (13.8%) | `tiene_diabetes_enc == 2` | ✅ |
| `has_depression_bin` (20.3%) | `tiene_depresion_enc` | ✅ |
| `has_asthma_bin` (14.9%) | `tiene_asma_enc` | ✅ |
| `has_heart_disease_bin` (5.4%) | `tiene_cardiopatia_coronaria_enc` | ✅ |
| `has_high_bp_bin` (40.7%) | — | ❌ only in brfss_features |
| `has_high_cholesterol_bin` (36.7%) | — | ❌ only in brfss_features |
| `has_stroke_bin` (4.2%) | — | ❌ only in brfss_features |

`tiene_diabetes_enc` is **ternary** (0=no, 1=pre, 2=sí) — binarize with `== 2` for confirmed diabetes.

Columns `poor_mental_health_days` and `poor_physical_health_days` are in `brfss_features`, not `brfss_clean`.

**NHANES (CDC 2021-2023, cycle L):** Compensates for 3 missing BRFSS targets via lab markers. `BMXBMI` is NOT downloaded (BMX_L.xpt not in the download list). Lab target: `DIQ010` (1=yes diabetes, binarize 1→1 rest→0). `gender` arrives as string `'male'`/`'female'` and needs encoding.

**unified_features quality note:** PIMA rows have median-imputed constants for `diastolic_bp`, `heart_rate`, `sleep_hours`, `physical_activity`, `daily_steps`, `stress_level`. These columns carry no discriminative signal for the 768 PIMA rows. Effective training size for diabetes screening model is ~768 rows.

**Cache behavior:** `build_dataset.py` skips Supabase loading and NHANES merging if output CSVs already exist. Raw NHANES `.xpt` files are also cached individually. Use `--force` to reload everything.

**Always-excluded columns for ML:** `id`, all text columns without `_enc` suffix, `riesgo_salud`, `riesgo_salud_label` (composite leakage), `source` (metadata).

### ML Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=        # same as frontend — used by load_from_supabase.py
SUPABASE_SERVICE_ROLE_KEY=       # bypasses RLS to read ml_data schema
```

Python dependencies (not yet in requirements.txt): `supabase`, `python-dotenv`, `pandas`, `xgboost`, `scikit-learn`, `shap`, `joblib`, `tqdm`, `requests`, `pyreadstat`.
