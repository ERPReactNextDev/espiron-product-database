import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Fetch unique status values from spf_creation table
    const { data, error } = await supabase
      .from("spf_creation")
      .select("status")
      .not("status", "is", null)
      .order("status", { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      return res.status(500).json({ message: error.message });
    }

    // Extract unique statuses
    const uniqueStatuses = Array.from(
      new Set(data?.map((r: any) => r.status).filter(Boolean) || [])
    );

    return res.status(200).json({
      statuses: uniqueStatuses,
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error",
    });
  }
}
