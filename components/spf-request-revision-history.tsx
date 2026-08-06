"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { supabase } from "@/utils/supabase";
import { History, ChevronDown, ChevronUp, Clock, User } from "lucide-react";

/* ─────────────────────────────────────────────────────────────── */
/* TYPES                                                           */
/* ─────────────────────────────────────────────────────────────── */
type RevisionHistoryRecord = {
  id?: number;
  spf_number: string;
  customer_name?: string;
  contact_person?: string;
  contact_number?: string;
  registered_address?: string;
  delivery_address?: string;
  billing_address?: string;
  collection_address?: string;
  tin_no?: string;
  payment_terms?: string;
  warranty?: string;
  delivery_date?: string;
  special_instructions?: string;
  sales_person?: string;
  prepared_by?: string;
  approved_by?: string;
  approved_signature?: string;
  date_created?: string;
  date_updated?: string;
  referenceid?: string;
  tsm?: string;
  manager?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
  item_description?: string;
  item_photo?: string;
  item_code?: string;
  noted_by?: string;
  item_qty?: string;
  date_request_tsa?: string;
  date_approved_tsm?: string;
  date_approved_sales_head?: string;
  is_cancelled?: boolean;
  is_cancelled_reason?: string;
  is_cancelled_reason_others_remarks?: string;
  for_pool_date?: string;
  is_pool_finished?: boolean;
  remarks?: string;
  spf_revision_approval_sales_status?: string;
  spf_revision_approval_sales_date?: string;
  revision_number?: number;
  revision_result?: string;
  revision_date?: string;
  spf_revision_remarks_sales?: string;
  spf_revision_remarks_engineering?: string;
  spf_request_status?: string;
  project_name?: string;
  project_location?: string;
  project_status?: string;
  delivery_lead_time_requirement?: string;
  available_project_plans?: string;
  bill_of_quantity?: string;
  consultant?: string;
  other_bidders?: string;
  owner?: string;
  buyer?: string;
  scope?: string;
  other_client_instruction?: string;
  win_rate_probability_percentage?: string;
};

type Props = {
  spfNumber: string;
  isMobile?: boolean;
};

/* ─────────────────────────────────────────────────────────────── */
/* NAME CACHE                                                      */
/* ─────────────────────────────────────────────────────────────── */
const nameCache = new Map<string, string>();

async function resolveNames(referenceIDs: string[]): Promise<void> {
  const unresolved = referenceIDs.filter((id) => id && !nameCache.has(id));
  if (!unresolved.length) return;
  await Promise.allSettled(
    unresolved.map(async (refId) => {
      try {
        const response = await fetch(
          `/api/users?referenceID=${encodeURIComponent(refId)}`,
        );
        if (response.ok) {
          const user = await response.json();
          nameCache.set(
            refId,
            user?.Firstname
              ? `${user.Firstname} ${user.Lastname ?? ""}`.trim()
              : refId,
          );
        } else {
          nameCache.set(refId, refId);
        }
      } catch {
        nameCache.set(refId, refId);
      }
    }),
  );
}

function getResolvedName(referenceID: string | undefined): string {
  if (!referenceID) return "";
  return nameCache.get(referenceID) ?? referenceID;
}

/* ─────────────────────────────────────────────────────────────── */
/* STATUS LABEL                                                    */
/* ─────────────────────────────────────────────────────────────── */
function getStatusLabel(status: string | undefined): string {
  if (status === "Pending For Procurement") return "For Procurement Costing";
  if (status === "Approved By Procurement") return "Ready For Quotation";
  if (status === "For Revision by PD") return "FOR REVISION BY PD";
  return status ?? "";
}

function getStatusClass(status: string | undefined): string {
  if (status === "Cancelled") return "bg-red-100 text-red-700 border-red-200";
  if (status === "Approved By Procurement") return "bg-green-100 text-green-700 border-green-200";
  if (status === "For Revision by PD") return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

/* ─────────────────────────────────────────────────────────────── */
/* DATE FORMATTER                                                  */
/* ─────────────────────────────────────────────────────────────── */
function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

/* Helper: split comma-separated string into array, trimmed */
function parseItemList(str: string | undefined): string[] {
  if (!str) return [];
  return str.split(",").map((s) => s.trim());
}

/* Helper: distribute photos array into N groups as evenly as possible */
function chunkPhotos(photos: string[], parts: number): string[][] {
  if (parts <= 0) return [];
  const result: string[][] = Array.from({ length: parts }, () => []);
  if (photos.length === parts) {
    photos.forEach((p, i) => result[i].push(p));
    return result;
  }
  const base = Math.floor(photos.length / parts);
  const extra = photos.length % parts;
  let idx = 0;
  for (let i = 0; i < parts; i++) {
    const count = base + (i < extra ? 1 : 0);
    result[i] = photos.slice(idx, idx + count);
    idx += count;
  }
  return result;
}

/* ─────────────────────────────────────────────────────────────── */
/* IMAGE PARSER                                                    */
/* ─────────────────────────────────────────────────────────────── */
function parseImageUrls(imageString: string | undefined): string[] {
  if (!imageString) return [];
  return imageString.split(",").map(url => url.trim()).filter(url => url.length > 0);
}

/* ─────────────────────────────────────────────────────────────── */
/* TABLE ROW (old vs new)                                          */
/* ─────────────────────────────────────────────────────────────── */
function TableRow({
  label,
  value,
  oldValue,
  hasPrev,
}: {
  label: string;
  value?: string | number | null;
  oldValue?: string | number | null;
  hasPrev?: boolean;
}) {
  const changed = hasPrev && (oldValue ?? "") !== (value ?? "");

  return (
    <tr className={`border-b border-gray-100 last:border-0 ${changed ? "bg-yellow-50" : ""}`}>
      <td className="py-1.5 pr-3 text-muted-foreground align-top whitespace-nowrap w-[160px]">
        {label}
      </td>
      <td className="py-1.5 text-gray-800 break-words align-top">
        <span className={changed ? "font-medium text-gray-900" : ""}>
          {value || "-"}
        </span>
        {changed && (
          <div className="text-[10px] text-gray-400 mt-0.5">
            was: <span className="line-through">{oldValue || "-"}</span>
          </div>
        )}
      </td>
    </tr>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* MAIN COMPONENT                                                  */
/* ─────────────────────────────────────────────────────────────── */
export default function SPFRequestRevisionHistory({
  spfNumber,
  isMobile = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [revisions, setRevisions] = useState<RevisionHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedRevision, setExpanded] = useState<number | null>(null);
  const [, setNameVersion] = useState(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchRevisions = async () => {
    try {
      setLoading(true);

      const { data: revisionData, error } = await supabase
        .from("spf_request_revision_history")
        .select("*")
        .eq("spf_number", spfNumber)
        .order("revision_number", { ascending: false });

      if (error) {
        console.error("Revision history fetch error:", error);
      } else {
        setRevisions(revisionData || []);
        const referenceIDs = (revisionData || [])
          .flatMap((v) => [
            v.referenceid,
            v.tsm,
            v.manager,
            v.prepared_by,
            v.approved_by,
            v.noted_by,
            v.sales_person,
          ].filter(Boolean))
          .filter((id, index, arr) => arr.indexOf(id) === index);
        if (referenceIDs.length > 0) {
          await resolveNames(referenceIDs);
          setNameVersion((n: number) => n + 1);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchRevisions();
  }, [open]);

  const toggleExpand = (revNum: number) => {
    setExpanded((prev) => (prev === revNum ? null : revNum));
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="View revision history"
      >
        <History size={14} />
        Revision History
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={
            isMobile
              ? "w-full max-w-full h-[100dvh] rounded-none p-0 flex flex-col overflow-hidden"
              : "w-[95vw] max-w-[1200px] xl:max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-none"
          }
        >
          <DialogHeader
            className={isMobile ? "px-4 pt-4 pb-3 border-b shrink-0" : ""}
          >
            <DialogTitle className="flex items-center gap-2">
              <History size={16} />
              SPF Request Revision History — {spfNumber}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Each entry represents a revision of the SPF request. Click to expand.{" "}
              <span className="inline-flex items-center gap-1 text-yellow-700 font-medium">
                <span className="inline-block w-3 h-3 bg-yellow-200 border border-yellow-400 rounded-sm" />
                Yellow = changed from previous version.
              </span>
            </p>
          </DialogHeader>

          <div
            className={
              isMobile ? "flex-1 overflow-y-auto px-3 pt-3 pb-4" : "mt-4 px-1"
            }
          >
            {loading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading revision history...
              </p>
            )}

            {!loading && revisions.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <History size={32} className="mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No revision history yet.</p>
                <p className="text-xs text-muted-foreground/70">
                  Revisions are created when the SPF request is modified.
                </p>
              </div>
            )}

            {!loading && revisions.length > 0 && (
              <div className="space-y-3">
                {revisions.map((rev, idx) => {
                  const isExpanded = expandedRevision === rev.revision_number;
                  const prevRecord = revisions[idx + 1] ?? null;
                  const isFirst = rev.revision_number === 1;

                  return (
                    <Card
                      key={rev.revision_number || idx}
                      className="overflow-hidden border border-gray-200 rounded-xl shadow-sm"
                    >
                      {/* Revision header */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(rev.revision_number || idx)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex items-center shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-mono">
                            Revision {rev.revision_number || idx + 1}
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1 shrink-0">
                                <Clock size={10} />
                                {rev.revision_date ? formatDateTime(rev.revision_date) : "N/A"}
                              </span>
                              {rev.referenceid && (
                                <span className="flex items-center gap-1 truncate">
                                  <User size={10} />
                                  {getResolvedName(rev.referenceid)}
                                </span>
                              )}
                              {rev.revision_result && (
                                <span className="flex items-center gap-1 truncate">
                                  <span className="font-medium">Result:</span>{" "}
                                  {rev.revision_result}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {rev.status && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold border ${getStatusClass(rev.status)}`}
                            >
                              {getStatusLabel(rev.status)}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp size={16} className="text-muted-foreground" />
                          ) : (
                            <ChevronDown size={16} className="text-muted-foreground" />
                          )}
                        </div>
                      </button>

{/* Expanded content */}
                      {isExpanded && (
                        <div className="p-4 border-t border-gray-100 space-y-5">

                          {/* Customer Information */}
                          <div>
                            <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1.5">
                              Customer Information
                            </h3>
                            <table className="w-full text-xs">
                              <tbody>
                                <TableRow label="Customer" value={rev.customer_name} oldValue={prevRecord?.customer_name} hasPrev={!!prevRecord} />
                                <TableRow label="Contact Person" value={rev.contact_person} oldValue={prevRecord?.contact_person} hasPrev={!!prevRecord} />
                                <TableRow label="Contact Number" value={rev.contact_number} oldValue={prevRecord?.contact_number} hasPrev={!!prevRecord} />
                                <TableRow label="TIN No" value={rev.tin_no} oldValue={prevRecord?.tin_no} hasPrev={!!prevRecord} />
                              </tbody>
                            </table>
                          </div>

                          {/* Addresses */}
                          <div>
                            <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1.5">
                              Addresses
                            </h3>
                            <table className="w-full text-xs">
                              <tbody>
                                <TableRow label="Registered" value={rev.registered_address} oldValue={prevRecord?.registered_address} hasPrev={!!prevRecord} />
                                <TableRow label="Delivery" value={rev.delivery_address} oldValue={prevRecord?.delivery_address} hasPrev={!!prevRecord} />
                                <TableRow label="Billing" value={rev.billing_address} oldValue={prevRecord?.billing_address} hasPrev={!!prevRecord} />
                                <TableRow label="Collection" value={rev.collection_address} oldValue={prevRecord?.collection_address} hasPrev={!!prevRecord} />
                              </tbody>
                            </table>
                          </div>

                          {/* Sales Information */}
                          <div>
                            <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1.5">
                              Sales Information
                            </h3>
                            <table className="w-full text-xs">
                              <tbody>
                                <TableRow label="Sales Person" value={rev.sales_person} oldValue={prevRecord?.sales_person} hasPrev={!!prevRecord} />
                                <TableRow label="Prepared By" value={getResolvedName(rev.prepared_by)} oldValue={getResolvedName(prevRecord?.prepared_by)} hasPrev={!!prevRecord} />
                                <TableRow label="Approved By" value={getResolvedName(rev.approved_by)} oldValue={getResolvedName(prevRecord?.approved_by)} hasPrev={!!prevRecord} />
                                <TableRow label="Noted By" value={getResolvedName(rev.noted_by)} oldValue={getResolvedName(prevRecord?.noted_by)} hasPrev={!!prevRecord} />
                              </tbody>
                            </table>
                          </div>

                          {/* Project Information */}
                          <div>
                            <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1.5">
                              Project Information
                            </h3>
                            <table className="w-full text-xs">
                              <tbody>
                                <TableRow label="Project Name" value={rev.project_name} oldValue={prevRecord?.project_name} hasPrev={!!prevRecord} />
                                <TableRow label="Location" value={rev.project_location} oldValue={prevRecord?.project_location} hasPrev={!!prevRecord} />
                                <TableRow label="Status" value={rev.project_status} oldValue={prevRecord?.project_status} hasPrev={!!prevRecord} />
                                <TableRow label="Win Rate" value={rev.win_rate_probability_percentage} oldValue={prevRecord?.win_rate_probability_percentage} hasPrev={!!prevRecord} />
                              </tbody>
                            </table>
                          </div>

                          {/* Timeline */}
                          <div>
                            <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1.5">
                              Timeline
                            </h3>
                            <table className="w-full text-xs">
                              <tbody>
                                <TableRow
                                  label="Start Date"
                                  value={rev.start_date ? formatDateTime(rev.start_date) : "-"}
                                  oldValue={prevRecord?.start_date ? formatDateTime(prevRecord.start_date) : "-"}
                                  hasPrev={!!prevRecord}
                                />
                                <TableRow
                                  label="End Date"
                                  value={rev.end_date ? formatDateTime(rev.end_date) : "-"}
                                  oldValue={prevRecord?.end_date ? formatDateTime(prevRecord.end_date) : "-"}
                                  hasPrev={!!prevRecord}
                                />
                                <TableRow label="Delivery Date" value={rev.delivery_date} oldValue={prevRecord?.delivery_date} hasPrev={!!prevRecord} />
                                <TableRow
                                  label="Request TSA"
                                  value={rev.date_request_tsa ? formatDateTime(rev.date_request_tsa) : "-"}
                                  oldValue={prevRecord?.date_request_tsa ? formatDateTime(prevRecord.date_request_tsa) : "-"}
                                  hasPrev={!!prevRecord}
                                />
                              </tbody>
                            </table>
                          </div>

                          {/* Revision Details */}
                          <div>
                            <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1.5">
                              Revision Details
                            </h3>
                            <table className="w-full text-xs">
                              <tbody>
                                <TableRow label="Revision Result" value={rev.revision_result} oldValue={prevRecord?.revision_result} hasPrev={!!prevRecord} />
                                <TableRow label="Sales Remarks" value={rev.spf_revision_remarks_sales} oldValue={prevRecord?.spf_revision_remarks_sales} hasPrev={!!prevRecord} />
                                <TableRow label="Engineering Remarks" value={rev.spf_revision_remarks_engineering} oldValue={prevRecord?.spf_revision_remarks_engineering} hasPrev={!!prevRecord} />
                                <TableRow label="Approval Status" value={rev.spf_revision_approval_sales_status} oldValue={prevRecord?.spf_revision_approval_sales_status} hasPrev={!!prevRecord} />
                              </tbody>
                            </table>
                          </div>

{/* Item Information + Photos */}
<div>
  <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1.5">
    Item Information
  </h3>

  {/* Item Code stays single-row (not per-item) */}
  <table className="w-full text-xs mb-2">
    <tbody>
      <TableRow label="Item Code" value={rev.item_code} oldValue={prevRecord?.item_code} hasPrev={!!prevRecord} />
    </tbody>
  </table>

  {/* Per-item table: Quantity | Description | Photo(s) */}
  {(() => {
    const qtys = parseItemList(rev.item_qty);
    const descs = parseItemList(rev.item_description);
    const photos = parseImageUrls(rev.item_photo);

    const prevQtys = parseItemList(prevRecord?.item_qty);
    const prevDescs = parseItemList(prevRecord?.item_description);

    const rowCount = Math.max(qtys.length, descs.length, 1);
    const photoGroups = chunkPhotos(photos, rowCount);

    return (
      <table className="w-full text-xs border border-gray-200 rounded-md overflow-hidden">
        <thead>
          <tr className="bg-gray-50 text-[10px] uppercase text-muted-foreground">
            <th className="text-left py-1.5 px-2 font-semibold w-10">#</th>
            <th className="text-left py-1.5 px-2 font-semibold w-24">Qty</th>
            <th className="text-left py-1.5 px-2 font-semibold">Description</th>
            <th className="text-left py-1.5 px-2 font-semibold">Photo</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rowCount }).map((_, i) => {
            const qty = qtys[i] ?? "-";
            const desc = descs[i] ?? "-";
            const prevQty = prevQtys[i];
            const prevDesc = prevDescs[i];
            const qtyChanged = !!prevRecord && (prevQty ?? "") !== qty;
            const descChanged = !!prevRecord && (prevDesc ?? "") !== desc;
            const rowPhotos = photoGroups[i] || [];

            return (
              <tr key={i} className="border-t border-gray-100">
                <td className="py-1.5 px-2 text-muted-foreground align-top">{i + 1}</td>
                <td className={`py-1.5 px-2 align-top ${qtyChanged ? "bg-yellow-50" : ""}`}>
                  <span className={qtyChanged ? "font-medium text-gray-900" : "text-gray-800"}>
                    {qty}
                  </span>
                  {qtyChanged && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      was: <span className="line-through">{prevQty || "-"}</span>
                    </div>
                  )}
                </td>
                <td className={`py-1.5 px-2 align-top break-words ${descChanged ? "bg-yellow-50" : ""}`}>
                  <span className={descChanged ? "font-medium text-gray-900" : "text-gray-800"}>
                    {desc}
                  </span>
                  {descChanged && (
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      was: <span className="line-through">{prevDesc || "-"}</span>
                    </div>
                  )}
                </td>
                <td className="py-1.5 px-2 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    {rowPhotos.length > 0 ? (
                      rowPhotos.map((imageUrl, imgIdx) => (
                        <div
                          key={imgIdx}
                          className="relative w-12 h-12 bg-gray-100 rounded-md overflow-hidden border border-gray-200 shrink-0 cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                          onClick={() => setPreviewImage(imageUrl)}
                        >
                          <img
                            src={imageUrl}
                            alt={`Item ${i + 1} photo ${imgIdx + 1}`}
                            className="w-full h-full object-cover hover:scale-110 transition-transform duration-200"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        </div>
                      ))
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  })()}
</div>

                          {/* Other Details */}
                          <div>
                            <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide mb-1.5">
                              Other Details
                            </h3>
                            <table className="w-full text-xs">
                              <tbody>
                                <TableRow label="Payment Terms" value={rev.payment_terms} oldValue={prevRecord?.payment_terms} hasPrev={!!prevRecord} />
                                <TableRow label="Warranty" value={rev.warranty} oldValue={prevRecord?.warranty} hasPrev={!!prevRecord} />
                                <TableRow label="Special Instructions" value={rev.special_instructions} oldValue={prevRecord?.special_instructions} hasPrev={!!prevRecord} />
                                <TableRow label="Remarks" value={rev.remarks} oldValue={prevRecord?.remarks} hasPrev={!!prevRecord} />
                              </tbody>
                            </table>
                          </div>

                          {/* Cancellation Status */}
                          {rev.is_cancelled && (
                            <div>
                              <h3 className="font-semibold text-red-700 text-[11px] uppercase tracking-wide mb-1.5">
                                Cancellation
                              </h3>
                              <table className="w-full text-xs">
                                <tbody>
                                  <TableRow label="Reason" value={rev.is_cancelled_reason} oldValue={prevRecord?.is_cancelled_reason} hasPrev={!!prevRecord} />
                                  <TableRow label="Other Remarks" value={rev.is_cancelled_reason_others_remarks} oldValue={prevRecord?.is_cancelled_reason_others_remarks} hasPrev={!!prevRecord} />
                                </tbody>
                              </table>
                            </div>
                          )}

                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] rounded-none p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm">Image Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-6 bg-gray-50 min-h-75">
            {previewImage ? (
              <img
                src={previewImage}
                className="max-w-full max-h-[70vh] object-contain"
                alt="Preview"
              />
            ) : (
              <span className="text-muted-foreground">No image</span>
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setPreviewImage(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
