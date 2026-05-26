export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const payload = req.body ?? {};

    // In production, validate auth token and persist in a DB.
    // For now, this endpoint just echoes a validated shape.
    const response = {
      ok: true,
      received_at: new Date().toISOString(),
      received: {
        stepsToday: Number(payload.stepsToday ?? 0),
        sleepHoursLastNight: payload.sleepHoursLastNight ?? null,
        restingHeartRate: payload.restingHeartRate ?? null,
        bodyWeightKg: payload.bodyWeightKg ?? null,
        bloodPressure: payload.bloodPressure ?? null,
        updatedAt: payload.updatedAt ?? null,
      },
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(400).json({ ok: false, error: error?.message ?? 'Invalid payload' });
  }
}
