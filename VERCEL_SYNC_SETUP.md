# Vercel Health Sync Setup

## 1. Deploy API to Vercel

From this repo root:

```bash
vercel --prod
```

This deploys `api/health-sync.js` as:

`https://<your-domain>.vercel.app/api/health-sync`

## 2. Set endpoint in iOS app

Open:

`CareBridgeiOS/HealthSyncService.swift`

Replace:

`https://YOUR-VERCEL-DOMAIN.vercel.app/api/health-sync`

with your real Vercel URL.

## 3. Run on iPhone

- Build and run from Xcode.
- Tap `Conectar Apple Health`.
- The app reads Health data and sends it to Vercel.
- In the metrics card, `Sync Vercel` should show `OK`.

## 4. Next production steps

- Add auth token validation in `api/health-sync.js`.
- Persist payload to a DB (Neon/Supabase/Postgres).
- Build a dashboard route to view historical data.
