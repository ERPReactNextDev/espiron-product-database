import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const PAGE_SIZE = 100;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { from, to, page, search, status } = req.query;

  const fromDate   = typeof from   === "string" ? from   : undefined;
  const toDate     = typeof to     === "string" ? to     : undefined;
  const pageNum    = typeof page   === "string" ? Math.max(1, parseInt(page, 10)) : 1;
  const searchTerm = typeof search === "string" ? search.trim() : "";

  try {
    let query = supabase
      .from("spf_request")
      .select("*", { count: "exact" })
      .order("date_updated", { ascending: false })
      .order("id",           { ascending: false });

    // DATE FILTER
    if (fromDate && toDate) {
      query = query.gte("date_created", fromDate).lte("date_created", toDate);
    }

    // STATUS FILTER - handle single status or array of statuses
    if (status) {
      const statusArray = Array.isArray(status) ? status : [status];
      const validStatuses = statusArray.filter((s): s is string => typeof s === "string" && s.length > 0);
      if (validStatuses.length === 1) {
        query = query.ilike("status", `%${validStatuses[0]}%`);
      } else if (validStatuses.length > 1) {
        const orConditions = validStatuses.map((s) => `status.ilike.%${s}%`).join(",");
        query = query.or(orConditions);
      }
    }

    // SEARCH FILTER
    if (searchTerm) {
      const s = `%${searchTerm}%`;
      query = query.or(
        `spf_number.ilike.${s},customer_name.ilike.${s},item_code.ilike.${s}`
      );
    }

    // Fetch all records without pagination limit
    const { data, error, count } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ message: error.message });
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

    return res.status(200).json({
      requests: safeData,
      total,
      page:      safePage,
      totalPages,
      pageSize:  PAGE_SIZE,
    });

  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
}