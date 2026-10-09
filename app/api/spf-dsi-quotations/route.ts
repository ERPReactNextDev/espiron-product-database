import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

const DEFAULT_LIMIT = 20;

// Column the date range filter applies to
const DATE_FILTER_COLUMN = "date_created";

// Dates are entered in Philippine time (UTC+8, no DST)
const MANILA_OFFSET = "+08:00";
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Special case exclusions - ReferenceIDs to exclude from quotation tracking
const EXCLUDED_REF_IDS = new Set(["AE-NCR-555756", "JC-NCR-245823"]);

// Strip characters that would break PostgREST's or()/ilike syntax
const sanitizeSearch = (value: string) =>
  value.replace(/[,()%*\\"]/g, " ").replace(/\s+/g, " ").trim();

// Accept only YYYY-MM-DD that is a real calendar date
const parseDateParam = (value: string | null): string | null => {
  if (!value || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00${MANILA_OFFSET}`);
  return isNaN(d.getTime()) ? null : value;
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10));
  const offset = Math.max(0, parseInt(searchParams.get("offset") ?? "0", 10));
  const search = sanitizeSearch(searchParams.get("q") ?? "");

  let dateFrom = parseDateParam(searchParams.get("from"));
  let dateTo = parseDateParam(searchParams.get("to"));
  // If the range is reversed, swap it instead of returning nothing
  if (dateFrom && dateTo && dateFrom > dateTo) {
    [dateFrom, dateTo] = [dateTo, dateFrom];
  }

  try {
    let query = supabase
      .from("history")
      .select("*", { count: "exact" })
      .eq("type_activity", "Quotation Preparation")
      .filter("product_sku", "ilike", "%SPF-DSI-%");

    // Date range (inclusive of both days, Manila time)
    if (dateFrom) {
      query = query.gte(DATE_FILTER_COLUMN, `${dateFrom}T00:00:00.000${MANILA_OFFSET}`);
    }
    if (dateTo) {
      query = query.lte(DATE_FILTER_COLUMN, `${dateTo}T23:59:59.999${MANILA_OFFSET}`);
    }

    if (search) {
      const conditions = [
        `quotation_number.ilike.%${search}%`,
        `product_sku.ilike.%${search}%`,
      ];

      // Sales agent name lives in the users table, so resolve matching
      // ReferenceIDs first, then filter history by them.
      const nameFilters = search
        .split(" ")
        .filter(Boolean)
        .flatMap((token) => [`Firstname.ilike.%${token}%`, `Lastname.ilike.%${token}%`])
        .join(",");

      const { data: matchedUsers } = await supabase
        .from("users")
        .select("ReferenceID, Department")
        .or(nameFilters);

      const matchedRefIds = (matchedUsers || [])
        .filter((u: any) => {
          const department = (u.Department || "").trim().toUpperCase();
          const refId = u.ReferenceID;
          // Exclude IT department and special case users
          return department !== "IT" && !EXCLUDED_REF_IDS.has(refId);
        })
        .map((u: any) => u.ReferenceID)
        .filter(Boolean);

      if (matchedRefIds.length > 0) {
        conditions.push(
          `referenceid.in.(${matchedRefIds.map((id: string) => `"${id}"`).join(",")})`
        );
      }

      query = query.or(conditions.join(","));
    }

    query = query
      .order("date_updated", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    // Get unique referenceids from the fetched records
    const referenceIds = Array.from(
      new Set((data || []).map((r: any) => r.referenceid).filter(Boolean))
    );

    // Fetch user names for these referenceids, excluding IT department
    let userMap: Record<string, string> = {};
    let itRefIds = new Set<string>();

    if (referenceIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from("users")
        .select("ReferenceID, Firstname, Lastname, Department")
        .in("ReferenceID", referenceIds);

      if (!usersError && users) {
        users.forEach((user: any) => {
          const refId = user.ReferenceID;
          const department = (user.Department || "").trim().toUpperCase();

          // Exclude IT department users
          if (department === "IT") {
            itRefIds.add(refId);
            return;
          }

          // Exclude special case users
          if (EXCLUDED_REF_IDS.has(refId)) {
            itRefIds.add(refId);
            return;
          }

          const firstName = user.Firstname || "";
          const lastName = user.Lastname || "";
          userMap[refId] = `${firstName} ${lastName}`.trim() || "-";
        });
      }
    }

    // Filter out records from IT department users
    const filteredData = (data || []).filter((r: any) => {
      if (!r.referenceid) return true; // Keep records without referenceid
      return !itRefIds.has(r.referenceid);
    });

    const safeData = filteredData.map((r: any) => ({
      ...r,
      id: r.id?.toString() ?? null,
      date_created: r.date_created ? new Date(r.date_created).toISOString() : null,
      date_updated: r.date_updated ? new Date(r.date_updated).toISOString() : null,
      sales_agent: r.referenceid ? (userMap[r.referenceid] || "-") : "-",
      product_quantity: r.product_quantity || "",
      product_amount: r.product_amount || "",
    }));

    // Adjust total count by excluding IT department records
    // This is an approximation since we only have the current page's data
    // For accurate total, we'd need to query with the IT exclusion filter at the database level
    const itCountOnPage = (data || []).length - filteredData.length;
    const total = Math.max(0, (count || 0) - itCountOnPage);

    return NextResponse.json({
      quotations: safeData,
      total,
      limit,
      offset,
      from: dateFrom,
      to: dateTo,
      hasMore: offset + safeData.length < total,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}