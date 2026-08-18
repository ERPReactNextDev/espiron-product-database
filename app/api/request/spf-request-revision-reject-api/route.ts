import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { spf_number, spf_revision_remarks_sales, spf_revision_remarks_engineering } = body;

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
    const { data: creationData, error: fetchError } = await supabase
      .from("spf_creation")
      .select("status, previous_status")
      .eq("spf_number", spf_number)
      .single();

    if (fetchError) throw fetchError;

    const { data: revisionData, error: revisionFetchError } = await supabase
      .from("spf_request_revision")
      .select("*")
      .eq("spf_number", spf_number)
      .eq("spf_revision_approval_sales_status", "Ongoing")
      .single();

    if (revisionFetchError) throw revisionFetchError;

    if (!creationData?.previous_status) {
      const { error: deleteError } = await supabase
        .from("spf_creation")
        .delete()
        .eq("spf_number", spf_number);
      if (deleteError) throw deleteError;
    } else {
      const { error: creationError } = await supabase
        .from("spf_creation")
        .update({
          status: creationData.previous_status,
          previous_status: null,
          spf_revision_approval_sales_status: "Rejected",
          spf_revision_approval_sales_date: new Date().toISOString(),
          date_updated: new Date().toISOString(),
        })
        .eq("spf_number", spf_number);
      if (creationError) throw creationError;
    }

    if (revisionData) {
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

      const { id, ...revisionDataWithoutId } = revisionData;
      const { error: historyError } = await supabase
        .from("spf_request_revision_history")
        .insert({
          ...revisionDataWithoutId,
          spf_revision_remarks_sales: spf_revision_remarks_sales || null,
          spf_revision_remarks_engineering: spf_revision_remarks_engineering || null,
          revision_number: nextRevisionNumber,
          revision_result: `Request Rejected By ${userDepartment}`,
          revision_date: new Date().toISOString(),
          latest_approver: userReferenceID,
        });
      if (historyError) throw historyError;
    }

    const { error: deleteRevisionError } = await supabase
      .from("spf_request_revision")
      .delete()
      .eq("spf_number", spf_number)
      .eq("spf_revision_approval_sales_status", "Ongoing");

    if (deleteRevisionError) throw deleteRevisionError;

    try {
      const docRef = doc(dbCollab, "spf_creations", spf_number);
      await updateDoc(docRef, {
        messages: arrayUnion({
          id: `sys-${Date.now()}`,
          text: `REVISION REJECTED BY ${userDepartment.toUpperCase()}`,
          senderId: "system",
          senderName: "System",
          role: "system",
          time: new Date().toISOString(),
          isSystem: true,
          seenBy: [sessionUserId],
        }),
      });
    } catch (firebaseError) {
      console.error("Failed to broadcast to collaboration hub:", firebaseError);
    }

    return NextResponse.json({ success: true, message: "Revision rejected" });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
