import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

const BATCH = 1000; // Supabase returns max 1000 rows per request, so we page through

async function fetchAll(
  build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>
) {
  const rows: any[] = [];
  for (let from = 0; ; from += BATCH) {
    const { data, error } = await build(from, from + BATCH - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < BATCH) break;
  }
  return rows;
}

export async function GET(req: NextRequest) {
  const soStatus = req.nextUrl.searchParams.get("so_status");

  try {
    // No so_status param -> return the list of available options for the dropdown
    if (!soStatus) {
      const rows = await fetchAll((from, to) =>
        supabase
          .from("history")
          .select("so_status")
          .not("so_status", "is", null)
          .neq("so_status", "")
          .neq("so_status", "-")
          .range(from, to)
      );
      const options = Array.from(
        new Set(rows.map((r) => String(r.so_status).trim()).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b));
      return NextResponse.json({ options });
    }

    // With so_status -> return every activity ref that has a history record with that status
    const rows = await fetchAll((from, to) =>
      supabase
        .from("history")
        .select("activity_reference_number")
        .eq("so_status", soStatus)
        .range(from, to)
    );
    const activityRefs = Array.from(
      new Set(
        rows
          .map((r) => r.activity_reference_number)
          .filter((v): v is string => Boolean(v))
      )
    );
    return NextResponse.json({ activityRefs });
  } catch (err: any) {
    console.error("so-status error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}