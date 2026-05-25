import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const userId: string | undefined = body.userId;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const mlServiceUrl = process.env.ML_SERVICE_URL;
  if (!mlServiceUrl) {
    return NextResponse.json({ error: "ML service not configured" }, { status: 503 });
  }

  const mlApiKey = process.env.ML_SERVICE_API_KEY;

  let res: Response;
  try {
    res = await fetch(`${mlServiceUrl}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(mlApiKey ? { "X-Api-Key": mlApiKey } : {}),
      },
      body: JSON.stringify({ userId }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    console.error("[risk] ML service unreachable:", err);
    return NextResponse.json({ error: "ML service unreachable" }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[risk] ML service error:", res.status, detail.slice(0, 200));
    return NextResponse.json({ error: "ML inference failed" }, { status: 502 });
  }

  const result = await res.json();
  return NextResponse.json(result);
}
