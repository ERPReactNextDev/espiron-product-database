import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from   = searchParams.get("from")   ?? undefined;
  const to     = searchParams.get("to")     ?? undefined;
  const page   = searchParams.get("page")   ?? "1";
  const search = searchParams.get("search") ?? "";
  const status = searchParams.getAll("status");

  const pageNum    = Math.max(1, parseInt(page, 10));
  const searchTerm = search.trim();

  try {
    let query = supabase
      .from("spf_request")
      .select("*", { count: "exact" })
      .order("date_updated", { ascending: false })
      .order("id",           { ascending: false });

    if (from && to) {
      query = query.gte("date_created", from).lte("date_created", to);
    }

    if (status.length === 1) {
      query = query.ilike("status", `%${status[0]}%`);
    } else if (status.length > 1) {
      const orConditions = status.map((s) => `status.ilike.%${s}%`).join(",");
      query = query.or(orConditions);
    }

    if (searchTerm) {
      const s = `%${searchTerm}%`;
      query = query.or(`spf_number.ilike.${s},customer_name.ilike.${s},item_code.ilike.${s}`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    const safeData = (data || []).map((r: any) => ({
      ...r,
      id:                   r.id?.toString() ?? null,
      date_created:         r.date_created ? new Date(r.date_created).toISOString() : null,
      date_updated:         r.date_updated ? new Date(r.date_updated).toISOString() : null,
      special_instructions: r.special_instructions ?? null,
      clientName:           r.clientName ?? null,
      spf_number:           r.spf_number ?? null,
      item_code:            r.item_code ?? null,
    }));

    const total      = count || 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage   = Math.min(pageNum, totalPages);

    return NextResponse.json({
      requests: safeData,
      total,
      page:      safePage,
      totalPages,
      pageSize:  PAGE_SIZE,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
