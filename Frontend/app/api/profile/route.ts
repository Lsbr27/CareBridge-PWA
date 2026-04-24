import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../lib/supabase";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMissingLocationColumnError(error: unknown) {
  const message =
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";

  return message.includes("location") && (message.includes("column") || message.includes("schema"));
}

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing required query parameter: id" }, { status: 400 });
  }

  if (!uuidPattern.test(id)) {
    return NextResponse.json({ error: "Invalid profile id format" }, { status: 400 });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    let { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, date_of_birth, gender, diagnosis, location, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();

    if (error && isMissingLocationColumnError(error)) {
      const fallback = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, date_of_birth, gender, diagnosis, created_at, updated_at")
        .eq("id", id)
        .maybeSingle();

      error = fallback.error;
      data = fallback.data ? { ...fallback.data, location: null } : null;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    console.error("GET /api/profile failed", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
