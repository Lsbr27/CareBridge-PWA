# API Endpoints - CareBridge Backend

Documentacion de todos los endpoints necesarios para conectar el frontend con Supabase.

Los endpoints se implementan como **Next.js API Routes** en `Frontend/app/api/`.
Todos usan el admin client de Supabase (`getSupabaseAdmin()`) y validan el token del usuario via header `Authorization: Bearer <token>`.

---

## Estado actual

| Dominio | Endpoints existentes | Endpoints faltantes |
|---------|---------------------|---------------------|
| Profiles | 1 (POST /api/profile) | 1 (PATCH) |
| Medications | 0 | 5 |
| Daily Logs | 0 | 4 |
| Appointments | 0 | 4 |
| Insights | 0 | 4 |

---

## 1. Profiles

### Tabla: `profiles`

Campos: `id`, `full_name`, `date_of_birth`, `gender`, `diagnosis`, `sleep_quality`, `exercise_frequency`, `diet_notes`, `has_medications`, `has_upcoming_appointment`, `pending_lab`, `created_at`, `updated_at`

### Endpoints

#### `POST /api/profile` (EXISTE)
- **Archivo:** `Frontend/app/api/profile/route.ts`
- **Descripcion:** Upsert del perfil del usuario (usado por ProfileSetupScreen)
- **Body:** `{ full_name, date_of_birth, gender, diagnosis }`
- **Nota:** Actualmente solo guarda 4 campos. Faltan: `sleep_quality`, `exercise_frequency`, `diet_notes`

#### `PATCH /api/profile` (FALTA)
- **Descripcion:** Actualizar campos individuales del perfil (para edicion post-setup)
- **Body:** Cualquier subconjunto de campos de profiles
- **Usado por:** ProfileScreen > boton "Edit Profile" (linea 125, sin handler)
- **RLS:** `auth.uid() = id`

---

## 2. Medications

### Tabla: `medications`

Campos: `id`, `profile_id`, `name`, `dosage`, `schedule_time`, `frequency`, `status` (pending/taken/skipped), `notes`, `start_date`, `end_date`, `created_at`, `updated_at`

### Estado en frontend

- **MedicationReminderFeature.tsx** tiene 4 medicamentos hardcoded (lineas 25-55)
- Boton "Create reminder plan" (linea 88) sin handler
- Boton "Review adherence details" (linea 217) sin handler
- Items de medicamentos no son interactivos (no se puede marcar como tomado/saltado)

### Endpoints

#### `GET /api/medications` (FALTA)
- **Descripcion:** Listar medicamentos del usuario autenticado
- **Query params:** `?date=YYYY-MM-DD` (opcional, filtra por dia)
- **Response:** Array de medications con status del dia
- **Usado por:** MedicationReminderFeature.tsx (reemplaza mock data lineas 25-55)

#### `POST /api/medications` (FALTA)
- **Descripcion:** Crear un nuevo medicamento/recordatorio
- **Body:** `{ name, dosage, schedule_time, frequency, notes?, start_date, end_date? }`
- **Usado por:** MedicationReminderFeature.tsx > "Create reminder plan" (linea 88)

#### `PUT /api/medications/:id` (FALTA)
- **Descripcion:** Actualizar un medicamento existente
- **Body:** Cualquier subconjunto de campos
- **Usado por:** Futuro formulario de edicion

#### `PATCH /api/medications/:id/status` (FALTA)
- **Descripcion:** Marcar medicamento como tomado/saltado/pendiente para un dia especifico
- **Body:** `{ status: "taken" | "skipped" | "pending", date: "YYYY-MM-DD" }`
- **Usado por:** MedicationReminderFeature.tsx > click en item de medicamento

#### `DELETE /api/medications/:id` (FALTA)
- **Descripcion:** Eliminar un medicamento
- **Usado por:** Futuro boton de eliminar

---

## 3. Daily Logs (Registro diario de salud)

### Tabla: `daily_logs`

Campos: `id`, `profile_id`, `appointment_id`, `logged_at`, `symptoms` (text[]), `mood` (1-5), `energy` (1-5), `pain` (0-10), `sleep_hours`, `notes`, `created_at`, `updated_at`

### Estado en frontend

- **AddDataScreen.tsx** permite seleccionar items de salud pero el boton "Save to My Mosaic" (linea 190) NO tiene handler -- los datos nunca se persisten
- Las sugerencias de sintomas estan hardcoded (lineas 16-21)
- **HomeScreen.tsx** muestra healthData hardcoded (lineas 17-50) que deberia venir de daily_logs
- No existe UI para mood, energy, pain, sleep_hours (campos del schema)

### Endpoints

#### `POST /api/daily-logs` (FALTA)
- **Descripcion:** Crear una entrada de log diario
- **Body:** `{ symptoms: string[], mood?: number, energy?: number, pain?: number, sleep_hours?: number, notes?: string, appointment_id?: uuid }`
- **Usado por:** AddDataScreen.tsx > "Save to My Mosaic" (linea 190)

#### `GET /api/daily-logs` (FALTA)
- **Descripcion:** Listar logs del usuario
- **Query params:** `?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&limit=N`
- **Response:** Array de daily_logs ordenados por logged_at DESC
- **Usado por:** HomeScreen.tsx (reemplaza healthData hardcoded, lineas 17-50)

#### `PUT /api/daily-logs/:id` (FALTA)
- **Descripcion:** Actualizar un log existente
- **Body:** Cualquier subconjunto de campos
- **Usado por:** Futuro formulario de edicion de log

#### `DELETE /api/daily-logs/:id` (FALTA)
- **Descripcion:** Eliminar un log
- **Usado por:** Futuro boton de eliminar

---

## 4. Appointments (Citas medicas)

### Tabla: `appointments`

Campos: `id`, `profile_id`, `title`, `appointment_at`, `provider_name`, `location`, `notes`, `status` (scheduled/completed/cancelled/missed), `created_at`, `updated_at`

### Estado en frontend

- **HomeScreen.tsx** muestra "Next Checkup - March 25, 2026 - Dr. Emily Chen" hardcoded (lineas 174-185)
- Card "Book Appointment" (linea 111) sin handler
- **InsightsScreen.tsx** boton "Schedule Doctor Consultation" (linea 219) sin handler
- No existe pantalla dedicada para listar/gestionar citas

### Endpoints

#### `GET /api/appointments` (FALTA)
- **Descripcion:** Listar citas del usuario
- **Query params:** `?status=scheduled&upcoming=true&limit=N`
- **Response:** Array de appointments ordenados por appointment_at
- **Usado por:** HomeScreen.tsx (reemplaza cita hardcoded, lineas 174-185)

#### `POST /api/appointments` (FALTA)
- **Descripcion:** Crear una nueva cita
- **Body:** `{ title, appointment_at, provider_name?, location?, notes? }`
- **Usado por:** HomeScreen.tsx > "Book Appointment" (linea 111), InsightsScreen.tsx > "Schedule Doctor Consultation" (linea 219)

#### `PATCH /api/appointments/:id` (FALTA)
- **Descripcion:** Actualizar cita o cambiar status
- **Body:** Cualquier subconjunto de campos incluyendo `status`
- **Usado por:** Futuro formulario de edicion, marcar como completada/cancelada

#### `DELETE /api/appointments/:id` (FALTA)
- **Descripcion:** Eliminar una cita
- **Usado por:** Futuro boton de eliminar

---

## 5. Insights (Analitica de salud)

### Sin tabla propia -- se calcula a partir de `daily_logs`, `medications`, `appointments`

### Estado en frontend

- **InsightsScreen.tsx** tiene TODO hardcoded:
  - Health score: 72/100 (linea 107)
  - 3 insights/alertas (lineas 17-45)
  - 4 metricas con trends (lineas 48-52)
  - 1 patron de conexion (lineas 54-58)
- Ninguno de estos datos se calcula desde la BD

### Endpoints

#### `GET /api/insights/health-score` (FALTA)
- **Descripcion:** Calcular health score del usuario basado en adherencia a medicamentos, consistencia de logs, y tendencias
- **Query params:** `?days=30` (periodo de calculo)
- **Response:** `{ score: number, trend: string, breakdown: {...} }`
- **Logica:** Ponderar adherencia medicamentos (40%), consistencia de logging (30%), tendencia de sintomas (30%)
- **Usado por:** InsightsScreen.tsx (reemplaza score hardcoded, linea 107)

#### `GET /api/insights/metrics` (FALTA)
- **Descripcion:** Calcular metricas clave agregadas
- **Query params:** `?days=30`
- **Response:** Array de `{ label, value, status, trend }`
- **Logica:** Agregar datos de daily_logs por tipo de metrica, calcular tendencia vs periodo anterior
- **Usado por:** InsightsScreen.tsx (reemplaza metrics hardcoded, lineas 48-52)

#### `GET /api/insights/patterns` (FALTA)
- **Descripcion:** Detectar patrones/correlaciones entre sintomas
- **Query params:** `?days=30`
- **Response:** Array de `{ title, items: string[], confidence: number }`
- **Logica:** Buscar sintomas que co-ocurren frecuentemente en daily_logs
- **Usado por:** InsightsScreen.tsx (reemplaza connections hardcoded, lineas 54-58)

#### `GET /api/insights/alerts` (FALTA)
- **Descripcion:** Generar alertas y recomendaciones personalizadas
- **Query params:** `?days=30`
- **Response:** Array de `{ type: "alert"|"recommendation"|"positive", title, description }`
- **Logica:** Reglas basadas en umbrales (ej: pain > 7 por 3+ dias = alerta)
- **Usado por:** InsightsScreen.tsx (reemplaza insights hardcoded, lineas 17-45)

---

## Resumen de botones sin handler en el frontend

| Pantalla | Boton | Archivo:Linea | Endpoint necesario |
|----------|-------|---------------|-------------------|
| AddDataScreen | "Save to My Mosaic" | AddDataScreen.tsx:190 | POST /api/daily-logs |
| HomeScreen | "Book Appointment" card | HomeScreen.tsx:111 | POST /api/appointments |
| HomeScreen | "Log Symptoms" card | HomeScreen.tsx:107 | POST /api/daily-logs |
| MedicationReminder | "Create reminder plan" | MedicationReminderFeature.tsx:88 | POST /api/medications |
| MedicationReminder | "Review adherence details" | MedicationReminderFeature.tsx:217 | GET /api/insights/metrics |
| InsightsScreen | "Schedule Doctor Consultation" | InsightsScreen.tsx:219 | POST /api/appointments |
| ProfileScreen | "Edit Profile" | ProfileScreen.tsx:125 | PATCH /api/profile |

---

## Estructura de archivos propuesta

```
Frontend/app/api/
├── profile/
│   └── route.ts              ← EXISTE (POST upsert)
├── medications/
│   ├── route.ts              ← GET (listar) + POST (crear)
│   └── [id]/
│       ├── route.ts          ← PUT (actualizar) + DELETE (eliminar)
│       └── status/
│           └── route.ts      ← PATCH (marcar tomado/saltado)
├── daily-logs/
│   ├── route.ts              ← GET (listar) + POST (crear)
│   └── [id]/
│       └── route.ts          ← PUT (actualizar) + DELETE (eliminar)
├── appointments/
│   ├── route.ts              ← GET (listar) + POST (crear)
│   └── [id]/
│       └── route.ts          ← PATCH (actualizar/status) + DELETE (eliminar)
└── insights/
    ├── health-score/
    │   └── route.ts          ← GET (calcular score)
    ├── metrics/
    │   └── route.ts          ← GET (metricas agregadas)
    ├── patterns/
    │   └── route.ts          ← GET (patrones de sintomas)
    └── alerts/
        └── route.ts          ← GET (alertas y recomendaciones)
```

---

## Prioridad de implementacion

| Prioridad | Endpoints | Razon |
|-----------|-----------|-------|
| **P0** | POST /api/daily-logs, GET /api/daily-logs | Core feature -- el boton "Save" no funciona |
| **P0** | GET /api/medications, POST /api/medications | Pantalla de medications completamente mock |
| **P1** | PATCH /api/medications/:id/status | Marcar medicamento como tomado |
| **P1** | GET /api/appointments, POST /api/appointments | Citas completamente mock |
| **P1** | PATCH /api/profile | Perfil no se puede editar post-setup |
| **P2** | PUT/DELETE para medications, daily-logs, appointments | CRUD completo |
| **P3** | GET /api/insights/* (4 endpoints) | Requiere datos reales primero |
