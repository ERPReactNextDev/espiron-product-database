import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { spf_number, remarks } = body;

  if (!spf_number) {
    return NextResponse.json({ message: "spf_number is required" }, { status: 400 });
  }

  const sessionUserId = req.cookies.get("session")?.value;
  if (!sessionUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("Department, ReferenceID")
    .eq("id", sessionUserId)
    .single();

  if (userError || !userData) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const userDepartment  = userData.Department;
  const userReferenceID = userData.ReferenceID;

  try {
    const { data: requestData, error: requestError } = await supabase
      .from("spf_request")
      .select("*")
      .eq("spf_number", spf_number)
      .single();

    if (requestError || !requestData) {
      return NextResponse.json({ message: "SPF request not found" }, { status: 404 });
    }

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

    const { id, ...requestDataWithoutId } = requestData;

    const { error: historyError } = await supabase
      .from("spf_request_revision_history")
      .insert({
        ...requestDataWithoutId,
        date_created: new Date().toISOString(),
        date_updated: new Date().toISOString(),
        spf_revision_approval_sales_status: "Ongoing",
        spf_revision_approval_sales_date: new Date().toISOString(),
        revision_number: nextRevisionNumber,
        revision_result:
          userDepartment === "Engineering"
            ? "Requested by TL"
            : `Requested By ${userDepartment}`,
        revision_date: new Date().toISOString(),
        spf_revision_remarks_engineering: remarks || null,
        latest_approver: userReferenceID,
      });

    if (historyError) throw historyError;

    return NextResponse.json({ success: true, message: "Revision requested for procurement" });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
