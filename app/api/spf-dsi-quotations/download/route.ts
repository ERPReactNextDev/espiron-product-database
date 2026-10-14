import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

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
      .select("*")
      .eq("type_activity", "Quotation Preparation")
      .filter("product_sku", "ilike", "%SPF-DSI-%");

    // Date range (inclusive of both days, Manila time)
    if (dateFrom) {
      query = query.gte("date_created", `${dateFrom}T00:00:00.000${MANILA_OFFSET}`);
    }
    if (dateTo) {
      query = query.lte("date_created", `${dateTo}T23:59:59.999${MANILA_OFFSET}`);
    }

    if (search) {
      const conditions = [
        `quotation_number.ilike.%${search}%`,
        `activity_reference_number.ilike.%${search}%`,
        `account_reference_number.ilike.%${search}%`,
        `product_sku.ilike.%${search}%`,
        `so_status.ilike.%${search}%`,
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
      .order("id", { ascending: false });

    const { data, error } = await query;

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

    // Convert to CSV
    const headers = [
      "Quotation Number",
      "Activity Reference Number",
      "Account Reference Number",
      "Sales Agent",
      "Product SKU",
      "Quotation Amount (SPF)",
      "Status",
      "SO Status",
      "Date Created",
      "Date Updated",
    ];

    const formatDate = (dateString: string | null) => {
      if (!dateString) return "";
      return new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(dateString));
    };

    const escapeCsv = (value: string) => {
      if (!value) return "";
      const str = String(value);
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredData.map((r: any) => [
      escapeCsv(r.quotation_number || ""),
      escapeCsv(r.activity_reference_number || ""),
      escapeCsv(r.account_reference_number || ""),
      escapeCsv(r.referenceid ? (userMap[r.referenceid] || "-") : "-"),
      escapeCsv(r.product_sku || ""),
      escapeCsv(r.quotation_amount || ""),
      escapeCsv(r.status || ""),
      escapeCsv(r.so_status || ""),
      escapeCsv(formatDate(r.date_created)),
      escapeCsv(formatDate(r.date_updated)),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="spf-quotations-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
