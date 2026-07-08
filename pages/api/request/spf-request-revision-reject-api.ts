import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";
import { parse } from "cookie";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { spf_number, spf_revision_remarks_sales, spf_revision_remarks_engineering } = req.body;

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
    // Fetch current spf_creation data to get previous_status
    const { data: creationData, error: fetchError } = await supabase
      .from("spf_creation")
      .select("status, previous_status")
      .eq("spf_number", spf_number)
      .single();

    if (fetchError) throw fetchError;

    // Fetch the revision data for history tracking
    const { data: revisionData, error: revisionFetchError } = await supabase
      .from("spf_request_revision")
      .select("*")
      .eq("spf_number", spf_number)
      .eq("spf_revision_approval_sales_status", "Ongoing")
      .single();

    if (revisionFetchError) throw revisionFetchError;

    // If previous_status is NULL, delete the spf_creation record
    if (!creationData?.previous_status) {
      const { error: deleteError } = await supabase
        .from("spf_creation")
        .delete()
        .eq("spf_number", spf_number);

      if (deleteError) throw deleteError;
    } else {
      // Restore previous_status if it exists
      const updateData: any = {
        status: creationData.previous_status,
        previous_status: null, // Clear previous_status after restoring
        spf_revision_approval_sales_status: "Rejected",
        spf_revision_approval_sales_date: new Date().toISOString(),
        date_updated: new Date().toISOString()
      };

      const { error: creationError } = await supabase
        .from("spf_creation")
        .update(updateData)
        .eq("spf_number", spf_number);

      if (creationError) throw creationError;
    }

    // Insert into spf_request_revision_history for tracking before deletion
    if (revisionData) {
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

      // Exclude id to avoid unique constraint violation
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
        });

      if (historyError) throw historyError;
    }

    // Delete the revision record after rejection
    const { error: deleteRevisionError } = await supabase
      .from("spf_request_revision")
      .delete()
      .eq("spf_number", spf_number)
      .eq("spf_revision_approval_sales_status", "Ongoing");

    if (deleteRevisionError) throw deleteRevisionError;

    // Broadcast to collaboration hub
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
          seenBy: [sessionUserId]
        })
      });
    } catch (firebaseError) {
      console.error("Failed to broadcast to collaboration hub:", firebaseError);
      // Don't fail the request if Firebase fails
    }

    return res.status(200).json({
      success: true,
      message: "Revision rejected"
    });

  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error"
    });
  }
}
