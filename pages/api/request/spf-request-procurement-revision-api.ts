import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { parse } from "cookie";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { spf_number, remarks } = req.body;

  if (!spf_number) {
    return res.status(400).json({ message: "spf_number is required" });
  }

  // Get current user from session
  const cookies = req.headers.cookie ? parse(req.headers.cookie) : {};
  const sessionUserId = cookies.session;

  if (!sessionUserId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Fetch user's Department based on logged-in user
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("Department")
    .eq("id", sessionUserId)
    .single();

  if (userError || !userData) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const userDepartment = userData.Department;

  try {
    // Fetch the latest spf_request data for this spf_number
    const { data: requestData, error: requestError } = await supabase
      .from("spf_request")
      .select("*")
      .eq("spf_number", spf_number)
      .single();

    if (requestError || !requestData) {
      return res.status(404).json({
        message: "SPF request not found"
      });
    }

    // Get the next revision number for this spf_number
    const { data: historyData, error: historyFetchError } = await supabase
      .from("spf_request_revision_history")
      .select("revision_number")
      .eq("spf_number", spf_number)
      .order("revision_number", { ascending: false })
      .limit(1);

    let nextRevisionNumber = 1;
    if (!historyFetchError && historyData && historyData.length > 0) {
      const maxRevision = parseInt(historyData[0].revision_number) || 0;
      nextRevisionNumber = maxRevision + 1;
    }

    // Prepare data for spf_request_revision_history
    // Exclude id to avoid unique constraint violation
    const { id, ...requestDataWithoutId } = requestData;

    // Insert into spf_request_revision_history
  const { error: historyError } = await supabase
    .from("spf_request_revision_history")
    .insert({
      ...requestDataWithoutId,
      date_created: new Date().toISOString(),
      date_updated: new Date().toISOString(),
      spf_revision_approval_sales_status: "Ongoing",
      spf_revision_approval_sales_date: new Date().toISOString(),
      revision_number: nextRevisionNumber,
      revision_result: `Requested By ${userDepartment}`,
      revision_date: new Date().toISOString(),
      spf_revision_remarks_engineering: remarks || null,
    });

    if (historyError) throw historyError;

    return res.status(200).json({
      success: true,
      message: "Revision requested for procurement"
    });

  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error"
    });
  }
}
