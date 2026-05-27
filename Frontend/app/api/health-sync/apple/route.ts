import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_SAMPLES = 1000;
const MAX_FUTURE_DRIFT_MS = 10 * 60 * 1000;

const METRIC_UNITS = {
  steps: "count",
  sleep_hours: "h",
  heart_rate_resting: "bpm",
  weight_kg: "kg",
  blood_pressure_systolic: "mmHg",
  blood_pressure_diastolic: "mmHg",
} as const;

type Metric = keyof typeof METRIC_UNITS;

type IncomingSample = {
  metric: string;
  value: number;
  unit: string;
  measuredAt: string;
  externalId?: string;
};

type ConnectionStatus = "not_connected" | "pending" | "connected";

function isValidMetric(metric: string): metric is Metric {
  return metric in METRIC_UNITS;
}

function normalizeExternalId(input: unknown): string {
  if (typeof input !== "string") {
    return "";
  }
  return input.trim();
}

function isValidIsoDate(input: string) {
  const d = new Date(input);
  return !Number.isNaN(d.getTime());
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

async function authenticateRequest(request: NextRequest, userId: string) {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false as const, status: 401, error: "Missing bearer token" };
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return { ok: false as const, status: 401, error: "Invalid bearer token" };
  }

  try {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) {
      return { ok: false as const, status: 401, error: "Invalid session token" };
    }
    if (data.user.id !== userId) {
      return { ok: false as const, status: 403, error: "Token user does not match userId" };
    }
    return { ok: true as const };
  } catch {
    return { ok: false as const, status: 500, error: "Auth validation failed" };
  }
}

export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("userId");
  const metricParam = request.nextUrl.searchParams.get("metric");
  const limit = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("limit"), 100), 500);
  const days = Math.min(parsePositiveInt(request.nextUrl.searchParams.get("days"), 30), 365);

  if (!userId || !uuidPattern.test(userId)) {
    return NextResponse.json({ error: "Invalid or missing userId" }, { status: 400 });
  }

  if (metricParam && !isValidMetric(metricParam)) {
    return NextResponse.json({ error: "Invalid metric filter" }, { status: 400 });
  }

  const auth = await authenticateRequest(request, userId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const admin = getSupabaseAdmin();
    const { data: connectionData, error: connectionError } = await admin
      .from("apple_health_connections")
      .select("status, requested_at, connected_at, last_sync_at")
      .eq("profile_id", userId)
      .maybeSingle();

    if (connectionError) {
      return NextResponse.json({ error: connectionError.message }, { status: 500 });
    }

    let query = admin
      .from("health_samples")
      .select("id, profile_id, metric, value, unit, measured_at, source, external_id, created_at, updated_at")
      .eq("profile_id", userId)
      .eq("source", "apple_health")
      .gte("measured_at", since)
      .order("measured_at", { ascending: false })
      .limit(limit);

    if (metricParam) {
      query = query.eq("metric", metricParam);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const samples = data ?? [];
    const latestSampleAt = samples[0]?.measured_at ?? null;
    const effectiveStatus: ConnectionStatus = latestSampleAt
      ? "connected"
      : ((connectionData?.status as ConnectionStatus | undefined) ?? "not_connected");

    return NextResponse.json({
      ok: true,
      filters: {
        userId,
        metric: metricParam ?? null,
        limit,
        days,
      },
      connection: {
        status: effectiveStatus,
        requestedAt: connectionData?.requested_at ?? null,
        connectedAt: connectionData?.connected_at ?? null,
        lastSyncAt: connectionData?.last_sync_at ?? latestSampleAt,
      },
      samples,
    });
  } catch (error) {
    console.error("GET /api/health-sync/apple failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const userId: string | undefined = body.userId;
  const status: ConnectionStatus | undefined = body.status;

  if (!userId || !uuidPattern.test(userId)) {
    return NextResponse.json({ error: "Invalid or missing userId" }, { status: 400 });
  }

  if (!status || !["not_connected", "pending", "connected"].includes(status)) {
    return NextResponse.json({ error: "Invalid or missing status" }, { status: 400 });
  }

  const auth = await authenticateRequest(request, userId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const nowIso = new Date().toISOString();
  const row = {
    profile_id: userId,
    status,
    requested_at: status === "pending" ? nowIso : null,
    connected_at: status === "connected" ? nowIso : null,
  };

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("apple_health_connections").upsert(row, {
      onConflict: "profile_id",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, connection: row });
  } catch (error) {
    console.error("PATCH /api/health-sync/apple failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const userId: string | undefined = body.userId;
  const samples: IncomingSample[] | undefined = body.samples;

  if (!userId || !uuidPattern.test(userId)) {
    return NextResponse.json({ error: "Invalid or missing userId" }, { status: 400 });
  }

  if (!Array.isArray(samples) || samples.length === 0) {
    return NextResponse.json({ error: "samples must be a non-empty array" }, { status: 400 });
  }

  const auth = await authenticateRequest(request, userId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (samples.length > MAX_SAMPLES) {
    return NextResponse.json(
      { error: `Too many samples. Maximum ${MAX_SAMPLES} per request.` },
      { status: 400 }
    );
  }

  const now = Date.now();
  const errors: string[] = [];

  const rows = samples.map((sample, index) => {
    if (!isValidMetric(sample.metric)) {
      errors.push(`samples[${index}].metric is invalid`);
      return null;
    }

    if (sample.unit !== METRIC_UNITS[sample.metric]) {
      errors.push(
        `samples[${index}].unit must be '${METRIC_UNITS[sample.metric]}' for metric '${sample.metric}'`
      );
      return null;
    }

    if (!isFiniteNonNegative(sample.value)) {
      errors.push(`samples[${index}].value must be a non-negative number`);
      return null;
    }

    if (typeof sample.measuredAt !== "string" || !isValidIsoDate(sample.measuredAt)) {
      errors.push(`samples[${index}].measuredAt must be a valid ISO date string`);
      return null;
    }

    const measuredAtMs = new Date(sample.measuredAt).getTime();
    if (measuredAtMs - now > MAX_FUTURE_DRIFT_MS) {
      errors.push(`samples[${index}].measuredAt cannot be in the future`);
      return null;
    }

    return {
      profile_id: userId,
      metric: sample.metric,
      value: sample.value,
      unit: sample.unit,
      measured_at: new Date(measuredAtMs).toISOString(),
      source: "apple_health",
      external_id: normalizeExternalId(sample.externalId),
    };
  });

  if (errors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: errors }, { status: 400 });
  }

  const validRows = rows.filter((row): row is NonNullable<typeof row> => row !== null);

  try {
    const admin = getSupabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { error } = await admin
      .from("health_samples")
      .upsert(validRows, { onConflict: "profile_id,source,metric,measured_at,external_id" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const latestMeasuredAt = validRows.reduce((acc, row) => {
      if (!acc) return row.measured_at;
      return row.measured_at > acc ? row.measured_at : acc;
    }, "" as string);

    await admin.from("apple_health_connections").upsert(
      {
        profile_id: userId,
        status: "connected",
        connected_at: new Date().toISOString(),
        last_sync_at: latestMeasuredAt || new Date().toISOString(),
      },
      { onConflict: "profile_id" }
    );

    return NextResponse.json({
      ok: true,
      inserted: validRows.length,
      duplicatesSkipped: 0,
    });
  } catch (error) {
    console.error("POST /api/health-sync/apple failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
