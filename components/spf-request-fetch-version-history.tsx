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
import { generateTDSPdf } from "@/lib/generateTDSPdf";

/* ─────────────────────────────────────────────────────────────── */
/* TYPES                                                           */
/* ─────────────────────────────────────────────────────────────── */
type VersionRecord = {
  id?: number;
  spf_number: string;
  version_number: number;
  version_label: string;
  created_at: string;
  edited_by?: string;
  item_added_author?: string;
  status?: string;
  spf_creation_start_time?: string;
  spf_creation_end_time?: string;
  price_validity?: string;

  supplier_brand?: string;
  product_name?: string;
  product_offer_image?: string;
  product_offer_qty?: string;
  product_offer_technical_specification?: string;
  product_offer_unit_cost?: string;
  product_offer_pcs_per_carton?: string;
  product_offer_packaging_details?: string;
  warranty?: string;
  product_offer_factory_address?: string;
  product_offer_port_of_discharge?: string;
  product_offer_subtotal?: string;
  company_name?: string;
  contact_name?: string;
  contact_number?: string;
  proj_lead_time?: string;
  final_selling_cost?: string;
  final_unit_cost?: string;
  final_subtotal?: string;
  item_code?: string;
  tds?: string;
  dimensional_drawing?: string;
  illuminance_drawing?: string;
  commercial_type?: string;
  deleted_offers?: string;
};

type Props = {
  spfNumber: string;
  isMobile?: boolean;
};

const ROW_SEP = "|ROW|";

type SpecGroup = { title: string; specs: string[] };

type LightMultipleRow = {
  itemName?: string;
  unitCost?: number;
  length?: number | string;
  width?: number | string;
  height?: number | string;
  qtyPerCarton?: number;
};

type MultiPackagingPayloadV1 = {
  v: 1;
  type: "LIGHT_MULTIPLE";
  rows: LightMultipleRow[];
};

function decodeBase64ToString(base64: string): string | null {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

function decodeMultiPackaging(packagingStr: string | undefined): MultiPackagingPayloadV1 | null {
  const raw = (packagingStr ?? "").trim();
  if (!raw.startsWith("MULTI:")) return null;
  const b64 = raw.slice("MULTI:".length);
  const decoded = decodeBase64ToString(b64);
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded);
    if (parsed?.v !== 1 || parsed?.type !== "LIGHT_MULTIPLE" || !Array.isArray(parsed?.rows)) {
      return null;
    }
    return parsed as MultiPackagingPayloadV1;
  } catch {
    return null;
  }
}

function parseHumanReadableMultiPackaging(packagingStr: string | undefined): MultiPackagingPayloadV1 | null {
  const raw = (packagingStr ?? "").trim();
  if (!raw || raw === "-") return null;
  
  // Check if it's the old base64 format
  if (raw.startsWith("MULTI:")) {
    return decodeMultiPackaging(raw);
  }
  
  // Parse new human-readable format (4 lines per item: name, qty, dimensions, unitCost)
  const lines = raw.split("\n").map(l => l.trim()).filter(l => l);
  if (lines.length === 0) return null;
  
  // Check if it's the old 3-line format (name, dimensions, unitCost) or new 4-line format
  const isOldFormat = lines.length % 3 === 0;
  const isNewFormat = lines.length % 4 === 0;
  
  if (!isOldFormat && !isNewFormat) return null;
  
  const rows: LightMultipleRow[] = [];
  const linesPerItem = isNewFormat ? 4 : 3;
  
  for (let i = 0; i < lines.length; i += linesPerItem) {
    const itemName = lines[i] || "";
    
    let qtyPerCarton = 0;
    let dimensions = "";
    let unitCostStr = "";
    
    if (isNewFormat) {
      // New format: name, qty, dimensions, unitCost
      const qtyLine = lines[i + 1] || "";
      dimensions = lines[i + 2] || "";
      unitCostStr = lines[i + 3] || "";
      
      // Parse qty (e.g., "Qty: 552")
      const qtyMatch = qtyLine.match(/^Qty:\s*(\d+)/);
      qtyPerCarton = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;
    } else {
      // Old format: name, dimensions, unitCost (qty not stored)
      dimensions = lines[i + 1] || "";
      unitCostStr = lines[i + 2] || "";
      qtyPerCarton = 0;
    }
    
    // Parse dimensions (e.g., "2222333 × 33 × 44334")
    const dimParts = dimensions.split("×").map(p => p.trim());
    const length = dimParts[0] || "-";
    const width = dimParts[1] || "-";
    const height = dimParts[2] || "-";
    
    // Parse unit cost (e.g., "230.67 USD")
    const costMatch = unitCostStr.match(/^([\d.]+)/);
    const unitCost = costMatch ? parseFloat(costMatch[1]) : 0;
    
    rows.push({
      itemName,
      length,
      width,
      height,
      unitCost,
      qtyPerCarton,
    });
  }
  
  if (rows.length === 0) return null;
  
  return {
    v: 1,
    type: "LIGHT_MULTIPLE",
    rows,
  };
}

function formatPackagingForDisplay(packagingStr: string | undefined, commercialTypeRaw: string | undefined): React.ReactNode {
  const ct = (commercialTypeRaw || "BASIC").toUpperCase();
  const pack = packagingStr && packagingStr !== "" ? packagingStr : "-";

  if (ct === "LIGHT") {
    const multi = parseHumanReadableMultiPackaging(pack);
    if (multi?.rows?.length) {
      return (
        <div className="space-y-1">
          {multi.rows.map((row, idx) => (
            <div key={idx} className="text-[11px] leading-tight">
              <div className="font-medium">{row.itemName || `Item ${idx + 1}`}</div>
              <div>Qty: {row.qtyPerCarton ?? "-"}</div>
              <div>
                {(row.length ?? "-").toString()} × {(row.width ?? "-").toString()} × {(row.height ?? "-").toString()}
              </div>
              <div className="text-gray-500">
                {(Number(row.unitCost ?? 0) || 0).toFixed(2)} USD
              </div>
            </div>
          ))}
        </div>
      );
    }
  }

  return pack;
}

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
  if (status === "For Revision") return "FOR REVISION";
  return status ?? "";
}

function getStatusClass(status: string | undefined): string {
  if (status === "Approved By Procurement") return "bg-green-100 text-green-700 border-green-200";
  if (status === "For Revision") return "bg-orange-100 text-orange-700 border-orange-200";
  return "bg-yellow-100 text-yellow-700 border-yellow-200";
}

/* ─────────────────────────────────────────────────────────────── */
/* PARSERS                                                         */
/* ─────────────────────────────────────────────────────────────── */
function parseTechSpec(raw: string): SpecGroup[] {
  if (!raw || raw === "-") return [];
  if (raw.includes("~~")) {
    return raw.split("@@").map((chunk) => {
      const [titlePart, rest = ""] = chunk.split("~~");
      const specs = rest
        .split(";;")
        .map((s) => s.trim())
        .filter(Boolean);
      return { title: titlePart.trim(), specs };
    });
  }
  const specs = raw
    .split(" | ")
    .map((s) => s.trim())
    .filter(Boolean);
  return specs.length ? [{ title: "", specs }] : [];
}

function splitByRow(value: string | undefined): string[][] {
  if (!value) return [];
  return value
    .split(ROW_SEP)
    .map((rowStr) => rowStr.split(",").map((v) => v.trim()));
}

function splitSpecsByRow(value: string | undefined): SpecGroup[][][] {
  if (!value) return [];
  return value
    .split(ROW_SEP)
    .map((rowStr) => rowStr.split(" || ").map(parseTechSpec));
}

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
/* DIFF HELPERS                                                     */
/* ─────────────────────────────────────────────────────────────── */

/**
 * Returns true if the value differs from the previous version's
 * equivalent value (or if there was no previous version = it's new).
 */
function isDifferent(current: string | undefined, previous: string | undefined): boolean {
  const c = (current ?? "").trim();
  const p = (previous ?? "").trim();
  return c !== p;
}

/** Wrapper: highlights cell yellow if changed vs previous version */
function DiffCell({
  current,
  previous,
  children,
  className = "",
}: {
  current: string | undefined;
  previous: string | undefined;
  children: React.ReactNode;
  className?: string;
}) {
  const changed = isDifferent(current, previous);
  return (
    <td
      className={`border px-2 py-1 text-center align-middle ${changed ? "bg-yellow-100" : ""} ${className}`}
      title={changed && previous !== undefined ? `Was: ${previous || "-"}` : undefined}
    >
      {changed && previous !== undefined && (
        <span className="block text-[9px] text-yellow-700 font-semibold mb-0.5 leading-none">
          ✎ changed
        </span>
      )}
      {children}
    </td>
  );
}

/** Mobile diff wrapper */
function DiffValue({
  label,
  current,
  previous,
}: {
  label: string;
  current: string | undefined;
  previous: string | undefined;
}) {
  const changed = isDifferent(current, previous);
  return (
    <div className={`${changed ? "bg-yellow-50 rounded px-1 py-0.5 border border-yellow-200" : ""}`}>
      <span className="text-gray-400 block text-[10px]">{label}</span>
      {changed && previous !== undefined && (
        <span className="text-[9px] text-yellow-700 font-semibold block leading-none mb-0.5">
          ✎ changed
        </span>
      )}
      <p className="text-[10px]">{current || "-"}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* SPEC BLOCK                                                      */
/* ─────────────────────────────────────────────────────────────── */
function SpecsBlock({ groups }: { groups: SpecGroup[] }) {
  const [open, setOpen] = useState(false);
  if (!groups.length)
    return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1 text-xs text-blue-600 font-medium"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {open ? "Hide" : "View specs"}
      </button>
      {open && (
        <div className="mt-1 space-y-1.5">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-700">
                  {group.title}
                </p>
              )}
              {group.specs.map((spec, si) => (
                <p key={`${gi}-${si}-${spec.slice(0, 20)}`} className="text-[10px] text-gray-500 leading-snug">
                  {spec}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderHistoryTechnicalSpecs(groups: SpecGroup[]) {
  if (!groups || groups.length === 0) {
    return <span className="text-[10px] text-muted-foreground">-</span>;
  }
  return (
    <div className="space-y-1 text-[10px] text-gray-700">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && (
            <div className="font-semibold text-gray-800">{group.title}</div>
          )}
          {group.specs.map((spec, si) => (
            <div key={`${gi}-${si}-${spec.slice(0, 20)}`} className="leading-tight">
              {spec}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* VERSION DETAIL VIEW                                             */
/* ─────────────────────────────────────────────────────────────── */
function VersionDetail({
  record,
  prevRecord,
  itemDescriptions,
  itemImages,
  isMobile,
  isFirst,
}: {
  record: VersionRecord;
  prevRecord: VersionRecord | null; // the older version for diffing (next in array since sorted desc)
  itemDescriptions: string[];
  itemImages: string[];
  isMobile?: boolean;
  isFirst: boolean; // v1 = no previous, no highlighting
}) {
  const rowImages = splitByRow(record.product_offer_image);
  const rowQtys = splitByRow(record.product_offer_qty);
  const rowUnitCosts = splitByRow(record.product_offer_unit_cost);
  const rowPcsPerCartons = splitByRow(record.product_offer_pcs_per_carton);
  const rowPackaging = splitByRow(record.product_offer_packaging_details);
  const rowWarranties = splitByRow(record.warranty);
  const rowFactories = splitByRow(record.product_offer_factory_address);
  const rowPorts = splitByRow(record.product_offer_port_of_discharge);
  const rowSubtotals = splitByRow(record.product_offer_subtotal);
  const rowSupplierBrands = splitByRow(record.supplier_brand);
  const rowSpecs = splitSpecsByRow(record.product_offer_technical_specification);
  const rowCompanyNames = splitByRow(record.company_name);
  const rowContactNames = splitByRow(record.contact_name);
  const rowContactNumbers = splitByRow(record.contact_number);
  const rowLeadTimes = splitByRow(record.proj_lead_time);
  const rowSellingCosts = splitByRow(record.final_selling_cost);
  const rowFinalUnitCosts = splitByRow(record.final_unit_cost);
  const rowFinalSubtotals = splitByRow(record.final_subtotal);
  const rowItemCodes = splitByRow(record.item_code);
  const rowPriceValidities = splitByRow(record.price_validity);
  const rowTdsBrands = splitByRow(record.tds);
  const rowProductNames = splitByRow(record.product_name);
  const rowDimensionalDrawings = splitByRow(record.dimensional_drawing);
  const rowIlluminanceDrawings = splitByRow(record.illuminance_drawing);
  const rowCommercialTypes = splitByRow(record.commercial_type);

  // Parse deleted offers
  const deletedOffersData = record.deleted_offers ? JSON.parse(record.deleted_offers) : [];
  const deletedOffersByRow: Record<number, any[]> = {};
  deletedOffersData.forEach((offer: any) => {
    const rowIndex = offer.__rowIndex ?? 0;
    if (!deletedOffersByRow[rowIndex]) {
      deletedOffersByRow[rowIndex] = [];
    }
    deletedOffersByRow[rowIndex].push(offer);
  });

  // Previous version parsed values (for diff)
  const prevRowImages = splitByRow(prevRecord?.product_offer_image);
  const prevRowQtys = splitByRow(prevRecord?.product_offer_qty);
  const prevRowUnitCosts = splitByRow(prevRecord?.product_offer_unit_cost);
  const prevRowPcsPerCartons = splitByRow(prevRecord?.product_offer_pcs_per_carton);
  const prevRowPackaging = splitByRow(prevRecord?.product_offer_packaging_details);
  const prevRowWarranties = splitByRow(prevRecord?.warranty);
  const prevRowFactories = splitByRow(prevRecord?.product_offer_factory_address);
  const prevRowPorts = splitByRow(prevRecord?.product_offer_port_of_discharge);
  const prevRowSubtotals = splitByRow(prevRecord?.product_offer_subtotal);
  const prevRowBrands = splitByRow(prevRecord?.supplier_brand);
  const prevRowSpecs = splitSpecsByRow(prevRecord?.product_offer_technical_specification);
  const prevRowCompanyNames = splitByRow(prevRecord?.company_name);
  const prevRowContactNames = splitByRow(prevRecord?.contact_name);
  const prevRowContactNumbers = splitByRow(prevRecord?.contact_number);
  const prevRowLeadTimes = splitByRow(prevRecord?.proj_lead_time);
  const prevRowSellingCosts = splitByRow(prevRecord?.final_selling_cost);
  const prevRowFinalUnitCosts = splitByRow(prevRecord?.final_unit_cost);
  const prevRowFinalSubtotals = splitByRow(prevRecord?.final_subtotal);
  const prevRowItemCodes = splitByRow(prevRecord?.item_code);
  const prevRowPriceValidities = splitByRow(prevRecord?.price_validity);
  const prevRowTdsBrands = splitByRow(prevRecord?.tds);
  const prevRowProductNames = splitByRow(prevRecord?.product_name);
  const prevRowCommercialTypes = splitByRow(prevRecord?.commercial_type);


  // Helper to get prev value safely (undefined = no prev = no highlight)
  const getPrev = (arr: string[][], rowIdx: number, i: number): string | undefined => {
    if (isFirst || !prevRecord) return undefined;
    return arr[rowIdx]?.[i];
  };

  const getSpecsPrev = (arr: SpecGroup[][][], rowIdx: number, i: number): string | undefined => {
    if (isFirst || !prevRecord) return undefined;
    const groups = arr[rowIdx]?.[i] ?? [];
    return JSON.stringify(groups);
  };

  return (
    <div className="space-y-3 mt-2">
      {itemDescriptions.map((desc, rowIndex) => {
        const prodImages = rowImages[rowIndex] ?? [];
        const prodQtys = rowQtys[rowIndex] ?? [];
        const prodUnitCosts = rowUnitCosts[rowIndex] ?? [];
        const prodPcsPerCartons = rowPcsPerCartons[rowIndex] ?? [];
        const prodPackaging = rowPackaging[rowIndex] ?? [];
        const prodWarranties = rowWarranties[rowIndex] ?? [];
        const prodFactories = rowFactories[rowIndex] ?? [];
        const prodPorts = rowPorts[rowIndex] ?? [];
        const prodSubtotals = rowSubtotals[rowIndex] ?? [];
        const prodBrands = rowSupplierBrands[rowIndex] ?? [];
        const prodSpecs = rowSpecs[rowIndex] ?? [];
        const prodCompanyNames = rowCompanyNames[rowIndex] ?? [];
        const prodContactNames = rowContactNames[rowIndex] ?? [];
        const prodContactNumbers = rowContactNumbers[rowIndex] ?? [];
        const prodLeadTimes = rowLeadTimes[rowIndex] ?? [];
        const prodSellingCosts = rowSellingCosts[rowIndex] ?? [];
        const prodFinalUnitCosts = rowFinalUnitCosts[rowIndex] ?? [];
        const prodFinalSubtotals = rowFinalSubtotals[rowIndex] ?? [];
        const prodItemCodes = rowItemCodes[rowIndex] ?? [];
        const prodPriceValidities = rowPriceValidities[rowIndex] ?? [];
        const prodTdsBrands = rowTdsBrands[rowIndex] ?? [];
        const prodProductNames = rowProductNames[rowIndex] ?? [];
        const prodDimensionalDrawings = rowDimensionalDrawings[rowIndex] ?? [];
        const prodIlluminanceDrawings = rowIlluminanceDrawings[rowIndex] ?? [];
        const prodCommercialTypes = rowCommercialTypes[rowIndex] ?? [];

        const hasProducts =
          prodImages.length > 0 &&
          !(prodImages.length === 1 && prodImages[0] === "");

        // Check if this entire row is new (didn't exist in previous version)
        const rowIsNew = !isFirst && prevRecord && (prevRowImages[rowIndex] === undefined || prevRowImages[rowIndex]?.every(v => !v || v === ""));

        return (
          <div
            key={rowIndex}
            className={`border rounded-lg overflow-hidden bg-white ${rowIsNew ? "border-yellow-400" : "border-gray-200"}`}
          >
            <div className={`border-b px-3 py-2 flex items-center gap-3 ${rowIsNew ? "bg-yellow-50" : "bg-gray-50"}`}>
              {rowIsNew && (
                <span className="text-[9px] font-bold text-yellow-700 bg-yellow-200 px-1.5 py-0.5 rounded shrink-0">
                  NEW ROW
                </span>
              )}
              <span className="text-xs font-bold text-gray-500 shrink-0">
                {record.spf_number}-{String(rowIndex + 1).padStart(3, "0")}
              </span>
              {itemImages[rowIndex] ? (
                <img
                  src={itemImages[rowIndex]}
                  className="w-8 h-8 object-contain rounded shrink-0"
                  alt=""
                />
              ) : null}
              <p className="text-xs font-medium text-gray-800 line-clamp-2 flex-1">
                {desc.replace(/\|/g, " · ")}
              </p>
            </div>

            {!hasProducts && !deletedOffersByRow[rowIndex] ? (
              <p className="text-xs text-muted-foreground px-3 py-2">
                No products
              </p>
            ) : isMobile ? (
              <div className="space-y-2 px-3 py-2">
                {prodImages.map((img, i) => {
                  const groups = prodSpecs[i] ?? [];
                  const optItemCode = prodItemCodes[i] && prodItemCodes[i] !== "-" ? prodItemCodes[i] : null;
                  // Check if this option is new (didn't exist in prev version)
                  const optIsNew = !isFirst && prevRecord && prevRowImages[rowIndex]?.[i] === undefined;

                  return (
                    <div key={i} className={`border rounded-lg p-3 bg-white ${optIsNew ? "border-yellow-400 bg-yellow-50" : ""}`}>
                      {optIsNew && (
                        <span className="text-[9px] font-bold text-yellow-700 bg-yellow-200 px-1.5 py-0.5 rounded block mb-2 w-fit">
                          NEW OPTION
                        </span>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        {img && img !== "-" ? (
                          <img
                            src={img}
                            className="w-12 h-12 object-contain rounded border"
                            alt=""
                          />
                        ) : (
                          <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-[9px] text-gray-400">
                            No img
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold truncate">
                            Option {i + 1}
                            {prodBrands[i] ? ` · ${prodBrands[i]}` : ""}
                          </p>
                          {optItemCode && (
                            <p className="text-[10px] text-gray-500 leading-tight">
                              {optItemCode}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] mb-2">
                        <DiffValue label="Product Name" current={prodProductNames[i]} previous={getPrev(prevRowProductNames, rowIndex, i)} />
                        <DiffValue label="Qty" current={prodQtys[i]} previous={getPrev(prevRowQtys, rowIndex, i)} />
                        <DiffValue label="Unit Cost" current={prodUnitCosts[i]} previous={getPrev(prevRowUnitCosts, rowIndex, i)} />
                        <DiffValue label="Qty/Per Carton" current={prodPcsPerCartons[i]} previous={getPrev(prevRowPcsPerCartons, rowIndex, i)} />
                        <div className={`${(() => { const c = prodPackaging[i]; const p = getPrev(prevRowPackaging, rowIndex, i); const changed = (c ?? "").trim() !== (p ?? "").trim(); return changed ? "bg-yellow-50 rounded px-1 py-0.5 border border-yellow-200" : ""; })()}`}>
                          <span className="text-gray-400 block text-[10px]">Packaging</span>
                          {(() => {
                            const c = prodPackaging[i];
                            const p = getPrev(prevRowPackaging, rowIndex, i);
                            const changed = (c ?? "").trim() !== (p ?? "").trim();
                            if (changed && p !== undefined) {
                              return (
                                <div>
                                  <span className="text-[9px] text-yellow-700 font-semibold block leading-none mb-0.5">✎ changed</span>
                                  {formatPackagingForDisplay(c, prodCommercialTypes[i])}
                                </div>
                              );
                            }
                            return formatPackagingForDisplay(c, prodCommercialTypes[i]);
                          })()}
                        </div>
                        <DiffValue label="Warranty" current={prodWarranties[i]} previous={getPrev(prevRowWarranties, rowIndex, i)} />
                        <DiffValue
                          label="Price Validity"
                          current={(() => {
                            const pv = prodPriceValidities[i];
                            if (!pv || pv === "-") return "-";
                            try { return new Date(pv).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return pv; }
                          })()}
                          previous={(() => {
                            const pv = getPrev(prevRowPriceValidities, rowIndex, i);
                            if (!pv || pv === "-") return "-";
                            try { return new Date(pv).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return pv; }
                          })()}
                        />
                        <div className={`${(() => { const b = prodTdsBrands[i]; const p = getPrev(prevRowTdsBrands, rowIndex, i); const changed = (b ?? "").trim() !== (p ?? "").trim(); return changed ? "bg-yellow-50 rounded px-1 py-0.5 border border-yellow-200" : ""; })()}`}>
                          <span className="text-gray-400 block text-[10px]">TDS Brand</span>
                          {(() => {
                            const b = prodTdsBrands[i];
                            const p = getPrev(prevRowTdsBrands, rowIndex, i);
                            const changed = (b ?? "").trim() !== (p ?? "").trim();
                            if (!b || b === "-" || b === "") return <p className="text-[10px]">-</p>;
                            const img = prodImages[i];
                            const specs = prodSpecs[i] ?? [];
                            const techSpecs = specs.map((g) => ({
                              title: g.title,
                              specs: g.specs.map((s) => {
                                const idx = s.indexOf(":");
                                if (idx === -1) return { specId: s, value: "" };
                                return { specId: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
                              }),
                            }));
                            const itemCode = prodItemCodes[i] || "";
                            return (
                              <div className="flex flex-col gap-0.5">
                                {changed && p !== undefined && (
                                  <span className="text-[9px] text-yellow-700 font-semibold block leading-none mb-0.5">✎ changed</span>
                                )}
                                <p className="text-[10px] font-medium">{b}</p>
                                <button
                                  type="button"
                                  className="text-[10px] text-green-600 underline font-medium text-left"
                                  onClick={() => {
                                    import("jspdf").then(({ default: jsPDF }) =>
                                      import("jspdf-autotable").then(({ default: autoTable }) => {
                                        generateTDSPdf({
                                          jsPDF,
                                          autoTable,
                                          brand: b,
                                          productName: itemCode,
                                          itemCode,
                                          mainImage: img && img !== "-" ? { url: img } : undefined,
                                          technicalSpecifications: techSpecs,
                                          dimensionalDrawing: (() => {
                                            const u = prodDimensionalDrawings[i];
                                            return u && u !== "-" ? { url: u } : null;
                                          })(),
                                          illuminanceDrawing: (() => {
                                            const u = prodIlluminanceDrawings[i];
                                            return u && u !== "-" ? { url: u } : null;
                                          })(),
                                          hideEmptySpecs: true,
                                        });
                                      })
                                    );
                                  }}
                                >
                                  ⬇ Download TDS
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                        <DiffValue label="Factory" current={prodFactories[i]} previous={getPrev(prevRowFactories, rowIndex, i)} />
                        <DiffValue label="Port" current={prodPorts[i]} previous={getPrev(prevRowPorts, rowIndex, i)} />
                        <DiffValue label="Subtotal" current={prodSubtotals[i] ? `₱${Number(prodSubtotals[i] || 0).toLocaleString()}` : undefined} previous={getPrev(prevRowSubtotals, rowIndex, i) ? `₱${Number(getPrev(prevRowSubtotals, rowIndex, i) || 0).toLocaleString()}` : getPrev(prevRowSubtotals, rowIndex, i)} />
                        <DiffValue label="Lead Time" current={prodLeadTimes[i]} previous={getPrev(prevRowLeadTimes, rowIndex, i)} />
                        <DiffValue label="Selling Cost" current={prodSellingCosts[i]} previous={getPrev(prevRowSellingCosts, rowIndex, i)} />
                        <DiffValue label="Final Unit Cost" current={prodFinalUnitCosts[i]} previous={getPrev(prevRowFinalUnitCosts, rowIndex, i)} />
                        <div className="col-span-2">
                          <DiffValue label="Final Subtotal" current={prodFinalSubtotals[i]} previous={getPrev(prevRowFinalSubtotals, rowIndex, i)} />
                        </div>
                      </div>
                      <div className="text-[10px] mb-2">
                        <p className="font-semibold">Technical Specs</p>
                        {groups.length === 0 ? (
                          <p className="text-gray-500">-</p>
                        ) : (
                          groups.map((group, gi) => (
                            <p key={`${gi}-${group.title || 'no-title'}`} className="text-gray-500">
                              {group.title ? `${group.title}: ` : ""}
                              {group.specs.join(", ")}
                            </p>
                          ))
                        )}
                      </div>
                      <div className="text-[10px] space-y-0.5">
                        <DiffValue label="Company" current={prodCompanyNames[i]} previous={getPrev(prevRowCompanyNames, rowIndex, i)} />
                        <DiffValue label="Contact Name" current={prodContactNames[i]} previous={getPrev(prevRowContactNames, rowIndex, i)} />
                        <DiffValue label="Contact No." current={prodContactNumbers[i]} previous={getPrev(prevRowContactNumbers, rowIndex, i)} />
                      </div>
                    </div>
                  );
                })}
                {/* Display deleted offers in red */}
                {deletedOffersByRow[rowIndex]?.map((deletedOffer: any, i: number) => (
                  <div key={`deleted-${i}`} className="border rounded-lg p-3 bg-red-50 border-red-300">
                    <span className="text-[9px] font-bold text-red-700 bg-red-200 px-1.5 py-0.5 rounded block mb-2 w-fit">
                      DELETED
                    </span>
                    <div className="flex items-center gap-2 mb-2">
                      {deletedOffer.mainImage?.url && deletedOffer.mainImage.url !== "-" ? (
                        <img
                          src={deletedOffer.mainImage.url}
                          className="w-12 h-12 object-contain rounded border"
                          alt=""
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded border flex items-center justify-center text-[9px] text-gray-400">
                          No img
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold truncate text-red-800">
                          {deletedOffer.productName || `Deleted Option ${i + 1}`}
                          {deletedOffer.supplier?.supplierBrand ? ` · ${deletedOffer.supplier.supplierBrand}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto px-4 py-3">
                <table className="w-full border text-sm" style={{ minWidth: "1400px" }}>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Supplier Brand</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Product Name</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Image</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Qty</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Price Validity</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">TDS Brand</th>
                      <th className="border px-2 py-1 text-center min-w-[180px]">Technical Specs</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Unit Cost</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Qty/Per Carton</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Packaging</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Warranty</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Factory</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Port</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Subtotal</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Company</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Contact Name</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Contact No.</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Lead Time</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Selling Cost</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Final Unit Cost</th>
                      <th className="border px-2 py-1 text-center whitespace-nowrap">Final Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodImages.map((img, i) => {
                      const groups = prodSpecs[i] ?? [];
                      const prevGroups = prevRowSpecs[rowIndex]?.[i] ?? [];
                      const specsChanged = !isFirst && prevRecord && JSON.stringify(groups) !== JSON.stringify(prevGroups);
                      const optIsNew = !isFirst && prevRecord && prevRowImages[rowIndex]?.[i] === undefined;

                      return (
                        <tr key={i} className={`align-top ${optIsNew ? "bg-yellow-50" : ""}`}>
                          <DiffCell current={prodBrands[i]} previous={getPrev(prevRowBrands, rowIndex, i)}>
                            {prodBrands[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodProductNames[i]} previous={getPrev(prevRowProductNames, rowIndex, i)}>
                            {prodProductNames[i] || "-"}
                          </DiffCell>
                          <td className={`border px-2 py-1 text-center ${optIsNew ? "bg-yellow-50" : ""}`}>
                            {optIsNew && (
                              <span className="block text-[9px] font-bold text-yellow-700 bg-yellow-200 px-1 rounded mb-0.5 w-fit mx-auto">
                                NEW
                              </span>
                            )}
                            {img && img !== "-" ? (
                              <img
                                src={img}
                                className="w-12 h-12 object-contain mx-auto"
                                alt=""
                              />
                            ) : (
                              <span className="text-muted-foreground text-[10px]">-</span>
                            )}
                          </td>
                          <DiffCell current={prodQtys[i]} previous={getPrev(prevRowQtys, rowIndex, i)}>
                            {prodQtys[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodPriceValidities[i]} previous={getPrev(prevRowPriceValidities, rowIndex, i)}>
                            {(() => {
                              const pv = prodPriceValidities[i];
                              if (!pv || pv === "-") return "-";
                              try { return new Date(pv).toLocaleString("en-PH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return pv; }
                            })()}
                          </DiffCell>
                          <DiffCell current={prodTdsBrands[i]} previous={getPrev(prevRowTdsBrands, rowIndex, i)}>
                            {(() => {
                              const b = prodTdsBrands[i];
                              if (!b || b === "-" || b === "") return "-";
                              const img = prodImages[i];
                              const specs = prodSpecs[i] ?? [];
                              const techSpecs = specs.map((g) => ({
                                title: g.title,
                                specs: g.specs.map((s) => {
                                  const idx = s.indexOf(":");
                                  if (idx === -1) return { specId: s, value: "" };
                                  return { specId: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
                                }),
                              }));
                              const itemCode = prodItemCodes[i] || "";
                              return (
                                <div className="flex flex-col items-center gap-1">
                                  <span className="font-medium text-[11px]">{b}</span>
                                  <button
                                    type="button"
                                    className="text-[10px] text-green-600 underline font-medium whitespace-nowrap"
                                    onClick={() => {
                                      import("jspdf").then(({ default: jsPDF }) =>
                                        import("jspdf-autotable").then(({ default: autoTable }) => {
                                          generateTDSPdf({
                                            jsPDF,
                                            autoTable,
                                            brand: b,
                                            productName: itemCode,
                                            itemCode,
                                            mainImage: img && img !== "-" ? { url: img } : undefined,
                                            technicalSpecifications: techSpecs,
                                            dimensionalDrawing: (() => {
                                              const u = prodDimensionalDrawings[i];
                                              return u && u !== "-" ? { url: u } : null;
                                            })(),
                                            illuminanceDrawing: (() => {
                                              const u = prodIlluminanceDrawings[i];
                                              return u && u !== "-" ? { url: u } : null;
                                            })(),
                                            hideEmptySpecs: true,
                                          });
                                        })
                                      );
                                    }}
                                  >
                                    ⬇ Download TDS
                                  </button>
                                </div>
                              );
                            })()}
                          </DiffCell>
                          <td
                            className={`border px-2 py-1 align-top text-[11px] ${specsChanged ? "bg-yellow-100" : ""}`}
                            title={specsChanged ? "Specs changed" : undefined}
                          >
                            {specsChanged && (
                              <span className="block text-[9px] text-yellow-700 font-semibold mb-0.5 leading-none">✎ changed</span>
                            )}
                            {renderHistoryTechnicalSpecs(groups)}
                          </td>
                          <DiffCell current={prodUnitCosts[i]} previous={getPrev(prevRowUnitCosts, rowIndex, i)}>
                            {prodUnitCosts[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodPcsPerCartons[i]} previous={getPrev(prevRowPcsPerCartons, rowIndex, i)}>
                            {prodPcsPerCartons[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodPackaging[i]} previous={getPrev(prevRowPackaging, rowIndex, i)}>
                            {formatPackagingForDisplay(prodPackaging[i], prodCommercialTypes[i])}
                          </DiffCell>
                          <DiffCell current={prodWarranties[i]} previous={getPrev(prevRowWarranties, rowIndex, i)}>
                            {prodWarranties[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodFactories[i]} previous={getPrev(prevRowFactories, rowIndex, i)}>
                            {prodFactories[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodPorts[i]} previous={getPrev(prevRowPorts, rowIndex, i)}>
                            {prodPorts[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodSubtotals[i]} previous={getPrev(prevRowSubtotals, rowIndex, i)}>
                            ₱{Number(prodSubtotals[i] || 0).toLocaleString()}
                          </DiffCell>
                          <DiffCell current={prodCompanyNames[i]} previous={getPrev(prevRowCompanyNames, rowIndex, i)}>
                            {prodCompanyNames[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodContactNames[i]} previous={getPrev(prevRowContactNames, rowIndex, i)}>
                            {prodContactNames[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodContactNumbers[i]} previous={getPrev(prevRowContactNumbers, rowIndex, i)}>
                            {prodContactNumbers[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodLeadTimes[i]} previous={getPrev(prevRowLeadTimes, rowIndex, i)}>
                            {prodLeadTimes[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodSellingCosts[i]} previous={getPrev(prevRowSellingCosts, rowIndex, i)}>
                            {prodSellingCosts[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodFinalUnitCosts[i]} previous={getPrev(prevRowFinalUnitCosts, rowIndex, i)}>
                            {prodFinalUnitCosts[i] || "-"}
                          </DiffCell>
                          <DiffCell current={prodFinalSubtotals[i]} previous={getPrev(prevRowFinalSubtotals, rowIndex, i)}>
                            {prodFinalSubtotals[i] || "-"}
                          </DiffCell>
                        </tr>
                      );
                    })}
                    {/* Display deleted offers in red for desktop */}
                    {deletedOffersByRow[rowIndex]?.map((deletedOffer: any, i: number) => (
                      <tr key={`deleted-${i}`} className="align-top bg-red-50">
                        <td className="border px-2 py-1 text-center align-middle text-red-800" colSpan={3}>
                          <span className="text-[9px] font-bold text-red-700 bg-red-200 px-1.5 py-0.5 rounded">
                            DELETED
                          </span>
                          <span className="ml-2 text-xs">{deletedOffer.productName || `Deleted Option ${i + 1}`}</span>
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          {deletedOffer.qty || "-"}
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          {deletedOffer.supplier?.supplierBrand || "-"}
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                        <td className="border px-2 py-1 text-center align-middle text-red-800">
                          -
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* MAIN COMPONENT                                                  */
/* ─────────────────────────────────────────────────────────────── */
export default function SPFRequestFetchVersionHistory({
  spfNumber,
  isMobile = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedVersion, setExpanded] = useState<number | null>(null);
  const [, setNameVersion] = useState(0);

  const [itemDescriptions, setItemDescriptions] = useState<string[]>([]);
  const [itemImages, setItemImages] = useState<string[]>([]);

  const fetchVersions = async () => {
    try {
      setLoading(true);

      const { data: historyData, error } = await supabase
        .from("spf_creation_history")
        .select("*")
        .eq("spf_number", spfNumber)
        .order("version_number", { ascending: false });

      if (error) {
        console.error("Version history fetch error:", error);
      } else {
        setVersions(historyData || []);
        const referenceIDs = (historyData || [])
          .flatMap((v) => [v.edited_by, v.item_added_author].filter(Boolean))
          .filter((id, index, arr) => arr.indexOf(id) === index);
        if (referenceIDs.length > 0) {
          await resolveNames(referenceIDs);
          setNameVersion((n) => n + 1);
        }
      }

      const { data: requestData } = await supabase
        .from("spf_request")
        .select("item_description,item_photo")
        .eq("spf_number", spfNumber)
        .maybeSingle();

      if (requestData) {
        setItemDescriptions(
          (requestData.item_description || "")
            .split(",")
            .map((s: string) => s.trim()),
        );
        setItemImages(
          (requestData.item_photo || "")
            .split(",")
            .map((s: string) => s.trim()),
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) fetchVersions();
  }, [open]);

  const toggleExpand = (vNum: number) => {
    setExpanded((prev) => (prev === vNum ? null : vNum));
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
        title="View version history"
      >
        <History size={14} />
        History
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
              Version History — {spfNumber}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Each entry represents a saved revision. Click to expand.{" "}
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
                Loading history...
              </p>
            )}

            {!loading && versions.length === 0 && (
              <div className="text-center py-12 space-y-2">
                <History size={32} className="mx-auto text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No version history yet.</p>
                <p className="text-xs text-muted-foreground/70">
                  Versions are created each time the SPF is revised and resubmitted.
                </p>
              </div>
            )}

            {!loading && versions.length > 0 && (
              <div className="space-y-3">
                {versions.map((v, idx) => {
                  const isExpanded = expandedVersion === v.version_number;
                  // versions sorted desc → previous version = the next item in array (lower version number)
                  const prevRecord = versions[idx + 1] ?? null;
                  // v1 has no previous to diff against
                  const isFirst = v.version_number === 1;

                  return (
                    <Card
                      key={v.version_number}
                      className="overflow-hidden border border-gray-200 rounded-xl shadow-sm"
                    >
                      {/* Version header */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(v.version_number)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="inline-flex items-center shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200 font-mono">
                            {v.version_label || `${spfNumber}_v${v.version_number}`}
                          </span>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1 shrink-0">
                                <Clock size={10} />
                                {formatDateTime(v.created_at)}
                              </span>
                              {v.spf_creation_start_time && (
                                <span className="flex items-center gap-1 truncate">
                                  <span className="font-medium">Start:</span>{" "}
                                  {formatDateTime(v.spf_creation_start_time)}
                                </span>
                              )}
                              {v.spf_creation_end_time && (
                                <span className="flex items-center gap-1 truncate">
                                  <span className="font-medium">End:</span>{" "}
                                  {formatDateTime(v.spf_creation_end_time)}
                                </span>
                              )}
                              {v.spf_creation_start_time && v.spf_creation_end_time && (
                                <span className="flex items-center gap-1 truncate">
                                  <span className="font-medium">Dur:</span>
                                  {(() => {
                                    const start = new Date(v.spf_creation_start_time).getTime();
                                    const end = new Date(v.spf_creation_end_time).getTime();
                                    const diff = Math.max(0, Math.floor((end - start) / 1000));
                                    const hrs = Math.floor(diff / 3600);
                                    const mins = Math.floor((diff % 3600) / 60);
                                    const secs = diff % 60;
                                    const z = (n: number) => String(n).padStart(2, "0");
                                    return `${hrs > 0 ? `${z(hrs)}:` : ""}${z(mins)}:${z(secs)}`;
                                  })()}
                                </span>
                              )}
                              {v.edited_by && (
                                <span className="flex items-center gap-1 truncate">
                                  <User size={10} />
                                  {getResolvedName(v.edited_by)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {/* ✅ STATUS BADGE — shown on every version card */}
                          {v.status && (
                            <span
                              className={`inline-flex text-[9px] px-2 py-0.5 rounded-full uppercase font-semibold border whitespace-nowrap ${getStatusClass(v.status)}`}
                            >
                              {getStatusLabel(v.status)}
                            </span>
                          )}
                          {v.item_added_author && (
                            <span className="hidden sm:flex items-center gap-1 text-[9px] px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              <User size={8} />
                              {getResolvedName(v.item_added_author)}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp size={14} className="text-gray-500" />
                          ) : (
                            <ChevronDown size={14} className="text-gray-500" />
                          )}
                        </div>
                      </button>

                      {/* Expanded content */}
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t bg-white">
                          {/* Legend for non-v1 versions */}
                          {!isFirst && prevRecord && (
                            <div className="flex items-center gap-2 mt-2 mb-3 px-1">
                              <span className="inline-block w-4 h-4 bg-yellow-100 border border-yellow-300 rounded-sm" />
                              <span className="text-[11px] text-yellow-700 font-medium">
                                Yellow cells = changed from{" "}
                                <span className="font-mono font-bold">
                                  {prevRecord.version_label || `v${prevRecord.version_number}`}
                                </span>
                              </span>
                            </div>
                          )}
                          {itemDescriptions.length > 0 ? (
                            <VersionDetail
                              record={v}
                              prevRecord={prevRecord}
                              itemDescriptions={itemDescriptions}
                              itemImages={itemImages}
                              isMobile={isMobile}
                              isFirst={isFirst}
                            />
                          ) : (
                            <p className="text-xs text-muted-foreground py-4 text-center">
                              Item descriptions unavailable.
                            </p>
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
    </>
  );
}
