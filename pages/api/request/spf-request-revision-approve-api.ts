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
    // Fetch the revision data
    const { data: revisionData, error: revisionError } = await supabase
      .from("spf_request_revision")
      .select("*")
      .eq("spf_number", spf_number)
      .eq("spf_revision_approval_sales_status", "Ongoing")
      .single();

    if (revisionError || !revisionData) {
      return res.status(404).json({
        message: "No ongoing revision found"
      });
    }

    // Prepare data to update spf_request (exclude revision-specific fields and status)
    const { id, spf_revision_approval_sales_status, spf_revision_approval_sales_date, date_created, date_updated, status, ...requestData } = revisionData;

    // Update spf_request with the revision data (excluding status to keep original)
    const { error: requestError } = await supabase
      .from("spf_request")
      .update({
        ...requestData,
        date_updated: new Date().toISOString()
      })
      .eq("spf_number", spf_number);

    if (requestError) throw requestError;

    // Update spf_creation status to "For Revision" (revert from Processing by PD)
    // Restore previous_status if it exists, otherwise set to "For Revision"
    const { error: creationError } = await supabase
      .from("spf_creation")
      .update({
        status: "For Revision by PD",
        previous_status: null, // Clear previous_status after approval
        spf_revision_approval_sales_status: null,
        spf_revision_approval_sales_date: null,
        date_updated: new Date().toISOString()
      })
      .eq("spf_number", spf_number);

    if (creationError) throw creationError;

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

    // Insert into spf_request_revision_history for tracking before deletion
    // revisionData already has id excluded from line 34
    const { error: historyError } = await supabase
      .from("spf_request_revision_history")
      .insert({
        ...requestData,
        spf_revision_remarks_sales: spf_revision_remarks_sales || null,
        spf_revision_remarks_engineering: spf_revision_remarks_engineering || null,
        revision_number: nextRevisionNumber,
        revision_result: `Request Approved By ${userDepartment}`,
        revision_date: new Date().toISOString(),
      });

    if (historyError) throw historyError;

    // Delete the revision record after approval
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
          text: `REVISION APPROVED BY ${userDepartment.toUpperCase()}`,
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
      message: "Revision approved and applied"
    });

  } catch (err: any) {
    console.error("Server error:", err);
    return res.status(500).json({
      message: err.message || "Server error"
    });
  }
}
