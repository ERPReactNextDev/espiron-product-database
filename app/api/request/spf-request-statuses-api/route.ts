import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

export async function GET(_req: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("spf_creation")
      .select("status")
      .not("status", "is", null)
      .order("status", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const uniqueStatuses = Array.from(
      new Set(data?.map((r: any) => r.status).filter(Boolean) || [])
    );

    return NextResponse.json({ statuses: uniqueStatuses });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
