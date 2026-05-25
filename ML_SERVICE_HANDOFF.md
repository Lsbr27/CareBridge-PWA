# ML Service — Handoff y Plan de Trabajo

**Fecha última actualización:** 2026-05-25  
**Estado:** Microservicio desplegado en Fly.io ✅ — falta agregar vars en Vercel

---

## Dónde estamos parados

El microservicio FastAPI con los 7 modelos XGBoost está corriendo en producción en Fly.io.

```
curl https://carebridge-ml.fly.dev/health
→ {"status":"ok","models_loaded":7}
```

**Siguiente paso inmediato:** agregar las variables de entorno en Vercel (ver §2).

---

## §1 — Lo que se hizo en la última sesión (2026-05-25)

| Qué | Estado |
|---|---|
| Rama `valentina` activa | ✅ |
| CLI de Fly.io instalada en WSL2 (`~/.fly/bin/flyctl`) | ✅ |
| App `carebridge-ml` creada en Fly.io (cuenta guarnizojuana@gmail.com) | ✅ |
| Secrets configurados: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ML_SERVICE_API_KEY` | ✅ |
| Bug corregido: `MODELS_DIR` en `ml-service/main.py` (`parent` → `parent/models`) | ✅ |
| Grace period en `fly.toml` aumentado a 60s | ✅ |
| Deploy exitoso — 7 modelos cargados | ✅ |
| `Frontend/.env.local` apunta a producción | ✅ |
| Variables de entorno en Vercel | ⏳ pendiente |

---

## §2 — Lo único que falta antes del agente: Vercel

En el dashboard de Vercel → proyecto CareBridge → **Settings → Environment Variables**, agregar:

| Variable | Valor |
|---|---|
| `ML_SERVICE_URL` | `https://carebridge-ml.fly.dev` |
| `ML_SERVICE_API_KEY` | `carebridge-ml-prod-2026` |

Luego hacer **Redeploy** (sin push, solo el botón Redeploy en el dashboard).

Verificación: abrir la app en producción → pantalla Insights → debe mostrar el score de riesgo real en vez de error 500.

---

## §3 — Archivos creados/modificados

| Archivo | Qué hace |
|---|---|
| `ml-service/main.py` | FastAPI — carga los 7 modelos al arrancar, expone `POST /predict` y `GET /health` |
| `ml-service/feature_mapper.py` | Convierte datos de Supabase → 21 features numéricas para los modelos |
| `ml-service/requirements.txt` | Versiones exactas (xgboost 3.2.0, fastapi 0.115.12, etc.) |
| `ml-service/Dockerfile` | Python 3.13-slim, copia código + modelos (478 MB imagen) |
| `.dockerignore` | En raíz del repo — excluye Frontend/, data/, etc. |
| `fly.toml` | Config de Fly.io — app `carebridge-ml`, región `iad`, grace period 60s |
| `Frontend/app/api/risk/route.ts` | Ya no spawna Python — hace fetch HTTP al microservicio en Fly.io |
| `Frontend/.env.local` | `ML_SERVICE_URL=https://carebridge-ml.fly.dev`, `ML_SERVICE_API_KEY=carebridge-ml-prod-2026` |

---

## §4 — Datos de la app en Fly.io

| Campo | Valor |
|---|---|
| App name | `carebridge-ml` |
| URL | `https://carebridge-ml.fly.dev` |
| Región | `iad` (Washington DC) |
| API key del servicio | `carebridge-ml-prod-2026` |
| Cuenta Fly.io | guarnizojuana@gmail.com |
| Modelos cargados | 7 (diabetes, high_bp, heart_disease, depression, asthma, high_cholesterol, stroke) |
| `health_score_v2.joblib` | No se carga — bug conocido (columnas en español vs inglés), ver ML_MODELS_CONTEXT.md §4 |

---

## §5 — Lo que sigue: el Agente CareGuide

Una vez agregadas las vars en Vercel, el siguiente bloque es construir el agente real con la API de Anthropic.

### Arquitectura del agente

```
ChatScreen (usuario escribe)
    ↓
POST /api/agent  (Next.js route)
    ↓
Claude claude-sonnet-4-6 con tool_use
    ↓ llama herramientas según necesite
┌─────────────────────────────────────────┐
│  get_patient_risk    → Fly.io FastAPI   │
│  get_medications     → Supabase         │
│  get_exam_history    → Supabase         │
│  get_daily_logs      → Supabase         │
└─────────────────────────────────────────┘
    ↓
Respuesta al usuario en lenguaje natural
```

### Archivos a crear

| Archivo | Qué |
|---|---|
| `Frontend/app/api/agent/route.ts` | POST handler — recibe mensajes, llama Claude con tools |
| `Frontend/app/app/chat/page.tsx` | Page wrapper (ya existe, ver git status) |
| `Frontend/src/app/screens/main/ChatScreen.tsx` | UI de chat (ya existe, ver git status) |
| `Frontend/src/app/layouts/MainLayout.tsx` | Agregar tab Chat (modificar) |

> Nota: `ChatScreen.tsx` y `app/app/chat/page.tsx` ya existen como archivos sin trackear en git (`??` en git status). Revisar su contenido antes de crear desde cero.

### Env vars que se necesitan para el agente

En `Frontend/.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-api03-...   ← pedir la key
```

En Vercel (cuando se despliegue el agente):
```
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### Tiempo estimado

| Paso | Tiempo |
|---|---|
| `POST /api/agent` con loop de tool use | 3-4h |
| Conectar `ChatScreen` al agente real | 1-2h |
| **Total** | **4-6h** |

---

## §6 — Prompt de recuperación para la próxima sesión

Abrir este repo en Claude Code y escribir:

> "Lee ML_SERVICE_HANDOFF.md y continuemos. Acabo de agregar ML_SERVICE_URL y ML_SERVICE_API_KEY en Vercel y quiero construir el agente CareGuide con la API de Anthropic. Mi key es sk-ant-api03-... Guíame."

---

## §7 — Para desarrollo local (si se necesita testear sin Fly)

```bash
# En una terminal aparte desde la raíz del repo:
export SUPABASE_URL=https://ggqxtmwozsdmwxohvupu.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<key del .env.local>
export ML_SERVICE_API_KEY=dev-local-key
uvicorn ml-service.main:app --reload --port 8000

# En otra terminal:
cd Frontend && npm run dev
# Cambiar temporalmente ML_SERVICE_URL a http://localhost:8000 en .env.local
```

---

## §8 — Stack completo (arquitectura final)

```
Vercel (Next.js)          Fly.io (~$2/mes)        Supabase
├── /app/chat      ──→   FastAPI                  ├── profiles
├── /app/insights  ──→   POST /predict            ├── medications
├── /api/agent     ──→   (XGBoost × 7 modelos)   ├── daily_logs
├── /api/chat/analyze                             ├── exam_documents
│   └── Gemini 2.5 Flash                          └── health_profile
└── /api/risk      ──→   Fly.io FastAPI
```

**Costo mensual estimado:**
- Vercel: $0 (hobby plan)
- Fly.io: ~$2
- Supabase: $0 (free tier)
- Gemini API: $0 (250 req/día gratis)
- Anthropic API: ~$0.003 por conversación
- **Total: ~$2/mes**
