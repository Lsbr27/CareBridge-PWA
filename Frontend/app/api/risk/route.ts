import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { getSupabaseAdmin } from "../../../lib/supabase";

// Allow a custom Python path via env (defaults to the miniconda env that has the ML packages)
const PYTHON = process.env.PYTHON_PATH ?? "/Users/lb/miniconda3/bin/python";
const SCRIPT = path.join(process.cwd(), "..", "src", "predict_user.py");

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const userId: string | undefined = body.userId;

  if (!userId) {
    return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const [profileRes, healthProfileRes, logsRes] = await Promise.all([
    admin
      .from("profiles")
      .select("date_of_birth, gender, diagnosis")
      .eq("id", userId)
      .single(),
    admin
      .from("health_profile")
      .select(
        "physical_activity_frequency, mood_general, sleep_hours, weight_kg, height_cm"
      )
      .eq("profile_id", userId)
      .maybeSingle(),
    admin
      .from("daily_logs")
      .select("mood, pain")
      .eq("profile_id", userId)
      .order("date", { ascending: false })
      .limit(30),
  ]);

  const payload = {
    profile: profileRes.data ?? {},
    health_profile: healthProfileRes.data ?? {},
    daily_logs: logsRes.data ?? [],
  };

  return new Promise<NextResponse>((resolve) => {
    const py = spawn(PYTHON, [SCRIPT]);
    let stdout = "";
    let stderr = "";

    py.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    py.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    py.on("close", (code: number) => {
      if (code !== 0) {
        console.error("[risk] predict_user.py exited", code, stderr.slice(0, 500));
        return resolve(
          NextResponse.json({ error: "ML inference failed" }, { status: 500 })
        );
      }
      try {
        const result = JSON.parse(stdout);
        resolve(NextResponse.json(result));
      } catch {
        console.error("[risk] invalid ML output:", stdout.slice(0, 200));
        resolve(NextResponse.json({ error: "Invalid ML output" }, { status: 500 }));
      }
    });

    py.on("error", (err: Error) => {
      console.error("[risk] spawn error:", err.message);
      resolve(
        NextResponse.json({ error: "Could not start ML process" }, { status: 500 })
      );
    });

    py.stdin.write(JSON.stringify(payload));
    py.stdin.end();
  });
}
