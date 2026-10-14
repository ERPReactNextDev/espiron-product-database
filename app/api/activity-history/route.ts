import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const activityRef = searchParams.get("activityRef");

  if (!activityRef) {
    return NextResponse.json({ message: "activityRef parameter is required" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from("history")
      .select("*")
      .eq("activity_reference_number", activityRef)
      .order("date_updated", { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const safeData = (data || []).map((r: any) => ({
      ...r,
      id: r.id?.toString() ?? null,
      date_created: r.date_created ? new Date(r.date_created).toISOString() : null,
      date_updated: r.date_updated ? new Date(r.date_updated).toISOString() : null,
    }));

    return NextResponse.json({
      history: safeData,
      total: safeData.length,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
