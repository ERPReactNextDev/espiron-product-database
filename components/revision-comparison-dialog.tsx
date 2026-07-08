"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/utils/supabase";
import { toast } from "sonner";
import { Check, X, MessageCircle } from "lucide-react";
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";

interface Props {
  open: boolean;
  onClose: () => void;
  spf_number: string | null;
  onRefresh?: () => void;
}

// Detects whether a value looks like an image URL (e.g. Cloudinary, or common image extensions)
const isImageUrl = (value: any) => {
  if (!value || typeof value !== "string") return false;
  const parts = value.split(",").map((v) => v.trim());
  return parts.some(
    (part) =>
      part.includes("res.cloudinary.com") ||
      /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(part)
  );
};

// Splits a comma-separated string field into a trimmed array
const splitField = (value: any): string[] => {
  if (!value || typeof value !== "string") return [];
  return value.split(",").map((v) => v.trim());
};

// Builds row-aligned item data from the comma-separated item_* fields
const buildItemRows = (data: any) => {
  if (!data) return [];
  const desc = splitField(data.item_description);
  const photos = splitField(data.item_photo);
  const codes = splitField(data.item_code);
  const qtys = splitField(data.item_qty);
  const remarksArr = splitField(data.remarks);

  const maxLen = Math.max(desc.length, photos.length, codes.length, qtys.length, remarksArr.length, 1);

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    rows.push({
      description: desc[i] || "—",
      photo: photos[i] || null,
      code: codes[i] || "—",
      qty: qtys[i] || "—",
      remarks: remarksArr[i] || remarksArr[0] || data.remarks || "—",
    });
  }
  return rows;
};

export function RevisionComparisonDialog({ open, onClose, spf_number, onRefresh }: Props) {
  const [oldData, setOldData] = useState<any>(null);
  const [newData, setNewData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [remarks, setRemarks] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previousSalesRemarks, setPreviousSalesRemarks] = useState<string | null>(null);
  const [previousEngineeringRemarks, setPreviousEngineeringRemarks] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !spf_number) {
      setOldData(null);
      setNewData(null);
      setRemarks(null);
      setPreviousSalesRemarks(null);
      setPreviousEngineeringRemarks(null);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: oldRequestData, error: oldError } = await supabase
          .from("spf_request")
          .select("*")
          .eq("spf_number", spf_number)
          .single();

        if (oldError) throw oldError;
        setOldData(oldRequestData);
        setRemarks(oldRequestData?.remarks || null);

        const { data: newRevisionData, error: newError } = await supabase
          .from("spf_request_revision")
          .select("*")
          .eq("spf_number", spf_number)
          .eq("spf_revision_approval_sales_status", "Ongoing")
          .single();

        if (newError) throw newError;
        setNewData(newRevisionData);

        // Fetch previous spf_revision_remarks_sales and spf_revision_remarks_engineering from revision history
        const { data: historyData, error: historyError } = await supabase
          .from("spf_request_revision_history")
          .select("spf_revision_remarks_sales, spf_revision_remarks_engineering")
          .eq("spf_number", spf_number)
          .order("revision_number", { ascending: false })
          .limit(1)
          .single();

        if (!historyError && historyData) {
          setPreviousSalesRemarks(historyData.spf_revision_remarks_sales || null);
          setPreviousEngineeringRemarks(historyData.spf_revision_remarks_engineering || null);
        }
      } catch (err) {
        console.error("Failed to fetch revision data:", err);
        toast.error("Failed to load revision data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, spf_number]);

  const broadcastSystemMessage = async (message: string) => {
    if (!spf_number) return;
    try {
      const docRef = doc(dbCollab, "spf_creations", spf_number);
      await updateDoc(docRef, {
        messages: arrayUnion({
          id: `sys-${Date.now()}`,
          text: message,
          senderId: "system",
          senderName: "System",
          role: "system",
          time: new Date().toISOString(),
          isSystem: true,
          systemType: "revision_action",
          seenBy: []
        })
      });
    } catch (e) {
      console.error("Failed to broadcast system message:", e);
    }
  };

  const handleApprove = async () => {
    if (!spf_number) return;
    setApproving(true);
    try {
      const res = await fetch("/api/request/spf-request-revision-approve-api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spf_number, spf_revision_remarks_sales: previousSalesRemarks, spf_revision_remarks_engineering: previousEngineeringRemarks }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Revision approved and applied");
        await broadcastSystemMessage("Revision Approved by PD");
        onClose();
        onRefresh?.();
      } else {
        toast.error(result.message || "Failed to approve revision");
      }
    } catch (err) {
      toast.error("Failed to approve revision");
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!spf_number) return;
    setRejecting(true);
    try {
      const res = await fetch("/api/request/spf-request-revision-reject-api", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spf_number, spf_revision_remarks_sales: previousSalesRemarks, spf_revision_remarks_engineering: previousEngineeringRemarks }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("Revision rejected");
        await broadcastSystemMessage("Revision Rejected by PD");
        onClose();
        onRefresh?.();
      } else {
        toast.error(result.message || "Failed to reject revision");
      }
    } catch (err) {
      toast.error("Failed to reject revision");
    } finally {
      setRejecting(false);
    }
  };

  // Renders a single value cell — shows multiple images (with lightbox click) when the value
  // is a comma-separated list of image URLs, otherwise falls back to plain text.
  const renderValue = (value: any) => {
    if (isImageUrl(value)) {
      const images = value.split(",").map((v: string) => v.trim()).filter(Boolean);
      return (
        <div className="flex flex-wrap gap-1">
          {images.map((url: string, idx: number) => (
            <button
              key={idx}
              type="button"
              onClick={() => setPreviewImage(url)}
              className="cursor-zoom-in"
            >
              <img
                src={url}
                alt={`Item ${idx + 1}`}
                className="h-12 w-12 object-cover rounded border border-gray-200 hover:opacity-80 transition"
              />
            </button>
          ))}
        </div>
      );
    }
    return value || "—";
  };

  const renderField = (label: string, oldValue: any, newValue: any) => {
    const isChanged = oldValue !== newValue;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4 py-2 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-600">{label}</div>
        <div className="text-xs text-gray-800">
          <span className="sm:hidden text-[10px] uppercase text-gray-400 mr-1">Old:</span>
          {renderValue(oldValue)}
        </div>
        <div className={`text-xs flex items-center gap-1 ${isChanged ? "text-green-700 font-semibold" : "text-gray-800"}`}>
          <span className="sm:hidden text-[10px] uppercase text-gray-400 mr-1">New:</span>
          {renderValue(newValue)}
        </div>
      </div>
    );
  };

  // Renders the Item Description / Photo / Code / Qty / Remarks block as an actual table,
  // with rows aligned by comma-index across the fields.
const renderItemsTable = (rows: ReturnType<typeof buildItemRows>, label: string) => (
    <div className="overflow-x-auto -mx-1 px-1">
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${label === "New (Proposed)" ? "text-green-700" : "text-gray-500"}`}>
        {label}
      </p>
      <table className="w-full min-w-[260px] text-xs border border-gray-200 rounded overflow-hidden">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left font-semibold text-gray-600 px-2 py-1 border-b border-gray-200">Description</th>
            <th className="text-left font-semibold text-gray-600 px-2 py-1 border-b border-gray-200">Photo</th>
            <th className="text-left font-semibold text-gray-600 px-2 py-1 border-b border-gray-200">Qty</th>
            <th className="text-left font-semibold text-gray-600 px-2 py-1 border-b border-gray-200">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-b border-gray-100 last:border-b-0">
              <td className="px-2 py-1.5 text-gray-800 align-top">{row.description}</td>
              <td className="px-2 py-1.5 align-top">
                {row.photo ? (
                  <button
                    type="button"
                    onClick={() => setPreviewImage(row.photo!)}
                    className="cursor-zoom-in"
                  >
                    <img
                      src={row.photo}
                      alt={`Item ${idx + 1}`}
                      className="h-10 w-10 sm:h-12 sm:w-12 object-cover rounded border border-gray-200 hover:opacity-80 transition"
                    />
                  </button>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-2 py-1.5 text-gray-800 align-top">{row.qty}</td>
              <td className="px-2 py-1.5 text-gray-800 align-top">{row.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const oldItemRows = buildItemRows(oldData);
  const newItemRows = buildItemRows(newData);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[100vw] sm:max-w-[95vw] xl:max-w-7xl h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] p-0 overflow-hidden rounded-none">
          <DialogHeader className="bg-blue-600 px-3 py-3 sm:px-5 sm:py-4 relative">
            <DialogTitle className="text-white text-xs sm:text-sm font-black uppercase tracking-widest">
              Revision Comparison
            </DialogTitle>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mt-1 sm:mt-0.5">
              <p className="text-blue-100 text-[11px]">SPF: {spf_number}</p>
              {remarks && (
                <div className="relative">
                  <div className="hidden sm:block absolute -left-2 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-r-[8px] border-r-amber-100 border-b-[6px] border-b-transparent"></div>
                  <div className="bg-amber-100 border border-amber-200 rounded-lg px-3 py-2 max-w-[85vw] sm:max-w-md shadow-sm">
                    <div className="flex items-start gap-2">
                      <MessageCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider mb-1">Revision Remarks</p>
                        <p className="text-xs text-amber-900 leading-relaxed">{remarks}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-sm text-gray-500">Loading...</div>
            </div>
          ) : (
            <>
              <ScrollArea className="max-h-[60vh]">
                <div className="px-3 py-3 sm:px-5 sm:py-4">
                  <div className="hidden sm:grid sm:grid-cols-3 gap-4 py-2 bg-gray-50 border-b border-gray-200 font-bold text-xs text-gray-700">
                    <div>Field</div>
                    <div className="text-gray-600">Old (Current)</div>
                    <div className="text-green-700">New (Proposed)</div>
                  </div>

                  {oldData && newData && (
                    <>
                      {renderField("Customer Name", oldData.customer_name, newData.customer_name)}
                      {renderField("Contact Person", oldData.contact_person, newData.contact_person)}
                      {renderField("Contact Number", oldData.contact_number, newData.contact_number)}
                      {renderField("Registered Address", oldData.registered_address, newData.registered_address)}
                      {renderField("Delivery Address", oldData.delivery_address, newData.delivery_address)}
                      {renderField("Billing Address", oldData.billing_address, newData.billing_address)}
                      {renderField("Collection Address", oldData.collection_address, newData.collection_address)}
                      {renderField("TIN Number", oldData.tin_no, newData.tin_no)}
                      {renderField("Payment Terms", oldData.payment_terms, newData.payment_terms)}
                      {renderField("Warranty", oldData.warranty, newData.warranty)}
                      {renderField("Delivery Date", oldData.delivery_date, newData.delivery_date)}
                      {renderField("Special Instructions", oldData.special_instructions, newData.special_instructions)}
                      {renderField("Sales Person", oldData.sales_person, newData.sales_person)}
                      {renderField("Prepared By", oldData.prepared_by, newData.prepared_by)}

                      {/* Items block rendered as tables (row-aligned by comma index) */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 py-3 border-b border-gray-100">
                        <div className="text-xs font-semibold text-gray-600">Items</div>
                        <div>{renderItemsTable(oldItemRows, "Old (Current)")}</div>
                        <div>{renderItemsTable(newItemRows, "New (Proposed)")}</div>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="flex-col-reverse sm:flex-row gap-2 px-3 py-3 sm:px-5 sm:py-4 border-t border-gray-200">
                <Button variant="outline" className="w-full sm:w-auto" onClick={onClose} disabled={approving || rejecting}>
                  Cancel
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
                  onClick={handleReject}
                  disabled={approving || rejecting}
                >
                  {rejecting ? "Rejecting..." : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      Reject
                    </>
                  )}
                </Button>
                <Button
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleApprove}
                  disabled={approving || rejecting}
                >
                  {approving ? "Approving..." : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Approve
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image lightbox dialog */}
      <Dialog open={!!previewImage} onOpenChange={(v) => !v && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl p-2">
          <DialogHeader>
            <DialogTitle className="text-sm">Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img
              src={previewImage}
              alt="Preview"
              className="w-full max-h-[75vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}