import { NextRequest, NextResponse } from "next/server";
import { updateUser } from "@/lib/supabase-admin";

type LoggingStatus = "SPF_ONLINE" | "SPF_IDLE";

const isLoggingStatus = (value: unknown): value is LoggingStatus =>
  value === "SPF_ONLINE" || value === "SPF_IDLE";

export async function POST(req: NextRequest) {
  const session = req.cookies.get("session")?.value;
  if (!session || !/^\d+$/.test(session)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || !("status" in body) || !isLoggingStatus(body.status)) {
    return NextResponse.json({ message: "Invalid logging status" }, { status: 400 });
  }

  try {
    const updatedUser = await updateUser(session, { spf_logging_status: body.status });
    if (!updatedUser) {
      return NextResponse.json({ message: "Failed to update logging status" }, { status: 500 });
    }

    return NextResponse.json({ spf_logging_status: body.status });
  } catch (error) {
    console.error("Failed to update SPF logging status:", error);
    return NextResponse.json({ message: "Failed to update logging status" }, { status: 500 });
  }
}
