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
npm run dev          # start dev server (defaults to localhost)
npm run build        # production build
```

To run on a specific host/port:
```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

There is no test runner configured yet.

## Architecture

### Frontend Stack
- **React 18** with **React Router 7** (file-based browser routing)
- **Vite 6** as bundler; `@` alias maps to `Frontend/src/`
- **Tailwind CSS v4** via `@tailwindcss/vite` plugin (configured in `vite.config.ts`, no separate `tailwind.config`)
- **shadcn/ui** components (Radix UI primitives) in `src/app/components/ui/`
- **MUI** (`@mui/material`) also available but less prevalent
- **Framer Motion / Motion** for animations
- **Recharts** for data visualization

### Routing Structure
```
/                          → OnboardingPuzzleClean (default entry)
/onboarding/puzzle-swipe   → OnboardingPuzzleSwipe
/onboarding/puzzle-interactive → OnboardingPuzzleInteractive
/onboarding/puzzle-premium → OnboardingPuzzlePremium
/onboarding/cta            → OnboardingCTA
/app                       → MainLayout (bottom nav shell)
  /app           (index)   → HomeScreen
  /app/medications         → MedicationReminderScreen
  /app/add                 → AddDataScreen
  /app/insights            → InsightsScreen
  /app/profile             → ProfileScreen
```

The onboarding variants (`/onboarding/puzzle-*`) are different design explorations of the same onboarding flow; `OnboardingPuzzleClean` is the current default at `/`.

### Layout Pattern
`MainLayout` (`src/app/layouts/MainLayout.tsx`) is the authenticated shell. It renders `<Outlet />` with a fixed bottom navigation bar (Home, Meds, Insights, Profile). The app is constrained to `max-w-[425px]` to simulate a mobile viewport on desktop.

### Styling Conventions
- Design tokens live in `src/styles/theme.css` as CSS custom properties (`--primary`, `--muted`, etc.), mapped to Tailwind via `@theme inline`
- The app uses a glassmorphism aesthetic: `bg-white/50 backdrop-blur-xl`, purple/pink gradients, rounded cards
- `.glass-card` and `.scrollbar-hide` are custom utility classes defined in `theme.css`
- Body background is a fixed subtle vertical gradient (white → light gray)

### Key Directories
- `src/app/screens/onboarding/` — onboarding flow variants
- `src/app/screens/main/` — authenticated app screens
- `src/app/components/ui/` — shadcn/ui primitives (accordion, button, card, dialog, etc.)
- `src/app/components/` — shared app-level components (`GlassCard`, `PillButton`, `MedicationReminderFeature`)

### Non-Frontend Directories
- `Negocio/` — product strategy docs (Spanish): business model, user flows, initial features
- `Arquitectura/` — technical stack decisions (currently minimal)
- `Branding/` — visual identity assets
- `Docs/Base_Datos/` — database schema notes
