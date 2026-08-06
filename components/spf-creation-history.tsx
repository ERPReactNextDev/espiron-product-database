"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { supabase } from "@/utils/supabase";
import { History, ChevronDown, ChevronUp, Clock, User } from "lucide-react";

/* ─────────────────────────────────────────────────────────────── */
/* TYPES                                                           */
/* ─────────────────────────────────────────────────────────────── */
type CreationHistoryRecord = {
  id?: number;
  referenceid?: string;
  tsm?: string;
  spf_number: string;
  status?: string;
  product_offer_image?: string;
  product_offer_qty?: string;
  product_offer_technical_specification?: string;
  product_offer_unit_cost?: string;
  product_offer_packaging_details?: string;
  product_offer_factory_address?: string;
  product_offer_port_of_discharge?: string;
  product_offer_subtotal?: string;
  date_created?: string;
  date_updated?: string;
  company_name?: string;
  supplier_brand?: string;
  contact_name?: string;
  contact_number?: string;
  final_selling_cost?: string;
  proj_lead_time?: string;
  manager?: string;
  item_code?: string;
  final_unit_cost?: string;
  final_subtotal?: string;
  item_added_date?: string;
  item_added_author?: string;
  product_offer_pcs_per_carton?: string;
  spf_creation_start_time?: string;
  spf_creation_end_time?: string;
  price_validity?: string;
  tds?: string;
  dimensional_drawing?: string;
  illuminance_drawing?: string;
  original_technical_specification?: string;
  product_reference_id?: string;
  revision_remarks?: string;
  revision_type?: string;
  spf_remarks_pd?: string;
  supplier_branch?: string;
  spf_remarks_procurement?: string;
  tds_pdf_urls?: string;
  commercial_type?: string;
  warranty?: string;
  product_name?: string;
  for_pool_date?: string;
  spf_revision_approval_sales_status?: string;
  spf_revision_approval_sales_date?: string;
  previous_status?: string;
  procurement_approved_by?: string;
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

/* ─────────────────────────────────────────────────────────────── */
/* MAIN COMPONENT                                                  */
/* ─────────────────────────────────────────────────────────────── */
export default function SPFCreationHistory({
  spfNumber,
  isMobile = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [creations, setCreations] = useState<CreationHistoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCreation, setExpanded] = useState<number | null>(null);
  const [, setNameVersion] = useState(0);

  const fetchCreations = async () => {
    try {
      setLoading(true);

      const { data: creationData, error } = await supabase
        .from("spf_creation")
        .select("*")
        .eq("spf_number", spfNumber)
        .order("date_created", { ascending: false });

      if (error) {
        console.error("Creation history fetch error:", error);
      } else {
        setCreations(creationData || []);
        const referenceIDs = (creationData || [])
          .flatMap((v) => [
            v.referenceid,
            v.tsm,
            v.manager,
            v.item_added_author,
            v.procurement_approved_by,
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
    if (open) fetchCreations();
  }, [open]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => (prev === id ? null : id));
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="View creation history"
      >
        <History size={14} />
        Creation History
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
              SPF Creation History — {spfNumber}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Each entry represents a product offer creation. Click to expand.
            </p>
          </DialogHeader>

          <div
            className={
              isMobile ? "flex-1 overflow-y-auto px-3 pt-3 pb-4" : "mt-4 px-1"
            }
          >
            {loading && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading creation history...
              </p>
            )}

            {!loading && creations.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <History size={32} className="mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No creation history yet.</p>
                <p className="text-xs text-muted-foreground/70">
                  Product offers are created when suppliers submit quotations.
                </p>
              </div>
            )}

            {!loading && creations.length > 0 && (
              <div className="space-y-3">
                {creations.map((creation, idx) => {
                  const isExpanded = expandedCreation === creation.id;

                  return (
                    <Card
                      key={creation.id || idx}
                      className="overflow-hidden border border-gray-200 rounded-xl shadow-sm"
                    >
                      {/* Creation header */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(creation.id || idx)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex items-center shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-mono">
                            {creation.supplier_brand || "Unknown Brand"}
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1 shrink-0">
                                <Clock size={10} />
                                {creation.date_created ? formatDateTime(creation.date_created) : "N/A"}
                              </span>
                              {creation.item_added_author && (
                                <span className="flex items-center gap-1 truncate">
                                  <User size={10} />
                                  {getResolvedName(creation.item_added_author)}
                                </span>
                              )}
                              {creation.product_name && (
                                <span className="flex items-center gap-1 truncate">
                                  <span className="font-medium">Product:</span>{" "}
                                  {creation.product_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {creation.status && (
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold border ${getStatusClass(creation.status)}`}
                            >
                              {getStatusLabel(creation.status)}
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
                        <div className="p-4 border-t border-gray-100">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                            {/* Product Information */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Product Information
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Product Name:</span>{" "}
                                  <span className="font-medium">{creation.product_name || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Item Code:</span>{" "}
                                  <span>{creation.item_code || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Supplier Brand:</span>{" "}
                                  <span>{creation.supplier_brand || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Supplier Branch:</span>{" "}
                                  <span>{creation.supplier_branch || "-"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Company Information */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Company Information
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Company Name:</span>{" "}
                                  <span className="font-medium">{creation.company_name || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Contact Name:</span>{" "}
                                  <span>{creation.contact_name || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Contact Number:</span>{" "}
                                  <span>{creation.contact_number || "-"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Pricing Information */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Pricing
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Unit Cost:</span>{" "}
                                  <span className="font-medium">{creation.product_offer_unit_cost || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Final Unit Cost:</span>{" "}
                                  <span className="font-medium">{creation.final_unit_cost || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Final Selling Cost:</span>{" "}
                                  <span className="font-medium">{creation.final_selling_cost || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Subtotal:</span>{" "}
                                  <span>{creation.product_offer_subtotal || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Final Subtotal:</span>{" "}
                                  <span>{creation.final_subtotal || "-"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Technical Specifications */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Technical Specifications
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Technical Spec:</span>{" "}
                                  <span className="block truncate">{creation.product_offer_technical_specification || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Original Spec:</span>{" "}
                                  <span className="block truncate">{creation.original_technical_specification || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">TDS:</span>{" "}
                                  <span className="block truncate">{creation.tds || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Price Validity:</span>{" "}
                                  <span>{creation.price_validity || "-"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Packaging & Logistics */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Packaging & Logistics
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Packaging Details:</span>{" "}
                                  <span className="block truncate">{creation.product_offer_packaging_details || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">PCS per Carton:</span>{" "}
                                  <span>{creation.product_offer_pcs_per_carton || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Factory Address:</span>{" "}
                                  <span className="block truncate">{creation.product_offer_factory_address || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Port of Discharge:</span>{" "}
                                  <span>{creation.product_offer_port_of_discharge || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Lead Time:</span>{" "}
                                  <span>{creation.proj_lead_time || "-"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Drawings & Documents */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Drawings & Documents
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Dimensional Drawing:</span>{" "}
                                  <span className="block truncate">{creation.dimensional_drawing || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Illuminance Drawing:</span>{" "}
                                  <span className="block truncate">{creation.illuminance_drawing || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">TDS PDF URLs:</span>{" "}
                                  <span className="block truncate">{creation.tds_pdf_urls || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Product Image:</span>{" "}
                                  <span className="block truncate">{creation.product_offer_image || "-"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Revision Information */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Revision Information
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Revision Type:</span>{" "}
                                  <span>{creation.revision_type || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Revision Remarks:</span>{" "}
                                  <span className="block truncate">{creation.revision_remarks || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">PD Remarks:</span>{" "}
                                  <span className="block truncate">{creation.spf_remarks_pd || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Procurement Remarks:</span>{" "}
                                  <span className="block truncate">{creation.spf_remarks_procurement || "-"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Approval Information */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Approval Information
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Previous Status:</span>{" "}
                                  <span>{creation.previous_status || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Approval Sales Status:</span>{" "}
                                  <span>{creation.spf_revision_approval_sales_status || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Approval Sales Date:</span>{" "}
                                  <span>{creation.spf_revision_approval_sales_date ? formatDateTime(creation.spf_revision_approval_sales_date) : "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Procurement Approved By:</span>{" "}
                                  <span>{getResolvedName(creation.procurement_approved_by)}</span>
                                </div>
                              </div>
                            </div>

                            {/* People Information */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                People
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">TSM:</span>{" "}
                                  <span>{getResolvedName(creation.tsm)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Manager:</span>{" "}
                                  <span>{getResolvedName(creation.manager)}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Item Added Author:</span>{" "}
                                  <span>{getResolvedName(creation.item_added_author)}</span>
                                </div>
                              </div>
                            </div>

                            {/* Timeline */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Timeline
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Date Created:</span>{" "}
                                  <span>{creation.date_created ? formatDateTime(creation.date_created) : "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Date Updated:</span>{" "}
                                  <span>{creation.date_updated ? formatDateTime(creation.date_updated) : "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Creation Start Time:</span>{" "}
                                  <span>{creation.spf_creation_start_time ? formatDateTime(creation.spf_creation_start_time) : "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Creation End Time:</span>{" "}
                                  <span>{creation.spf_creation_end_time ? formatDateTime(creation.spf_creation_end_time) : "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">For Pool Date:</span>{" "}
                                  <span>{creation.for_pool_date ? formatDateTime(creation.for_pool_date) : "-"}</span>
                                </div>
                              </div>
                            </div>

                            {/* Other Details */}
                            <div className="space-y-2">
                              <h3 className="font-semibold text-gray-700 text-[11px] uppercase tracking-wide">
                                Other Details
                              </h3>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-muted-foreground">Commercial Type:</span>{" "}
                                  <span>{creation.commercial_type || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Warranty:</span>{" "}
                                  <span>{creation.warranty || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Product Reference ID:</span>{" "}
                                  <span>{creation.product_reference_id || "-"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Item Added Date:</span>{" "}
                                  <span>{creation.item_added_date || "-"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
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
    </>
  );
}
