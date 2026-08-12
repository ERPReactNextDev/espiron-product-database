// lib/spf-excel-export.ts
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export type SPFExcelOfferRow = {
  offerItemNumber: string;
  imageUrl?: string;
  technicalSpecifications?: string;
  qtyCtn?: string;
  moq?: string;
  warranty?: string;
  quotationsValidity?: string;
  productionLeadTime?: string;
  deliveryLeadTime?: string;
  commercialType?: string;
  packaging?: string;
  totalCost?: string | number;
};

export type SPFExcelItemRow = {
  agentItemNumber: string;
  agentImageUrl?: string;
  agentItemQty?: string;
  agentDescription?: string;
  offers: SPFExcelOfferRow[];
};

/* ─────────────────────────────────────────────────────────────── */
/* PACKAGING / QTY / COMMERCIAL-TYPE TEXT BUILDERS                 */
/* ─────────────────────────────────────────────────────────────── */

/** Used by Create/Edit mode — works directly off the live `productOffers` state (camelCase objects). */
function buildPackagingAndQtyText(prod: any): {
  qtyCtn: string;
  commercialType: string;
  packaging: string;
} {
  const productName = prod?.__tdsProductName ?? prod?.productName ?? "";
  const details = prod?.commercialDetails || {};
  let commercialTypeRaw = (details.commercialType || "BASIC").toUpperCase();

  const nameLower = (productName || "").toLowerCase();
  if (nameLower.includes("lights (multiple)") || nameLower.includes("light (multiple)")) {
    commercialTypeRaw = "LIGHT";
  } else if (nameLower.includes("lights (single)") || nameLower.includes("light (single)")) {
    commercialTypeRaw = "LIGHT";
  }

  if (commercialTypeRaw === "POLE") {
    return { qtyCtn: "-", commercialType: "Pole", packaging: "-" };
  }

  if (commercialTypeRaw === "LIGHT") {
    let isMultiple = !!details.useArrayInput;
    if (nameLower.includes("lights (multiple)") || nameLower.includes("light (multiple)")) isMultiple = true;
    else if (nameLower.includes("lights (single)") || nameLower.includes("light (single)")) isMultiple = false;

    if (isMultiple && Array.isArray(details.multiRows) && details.multiRows.length > 0) {
      const rows = details.multiRows;
      const packagingLines = rows.map((r: any, idx: number) => {
        const name = r.itemName || `Item ${idx + 1}`;
        const dims = `${r.length ?? "-"} cm × ${r.width ?? "-"} cm × ${r.height ?? "-"} cm`;
        const cost = (Number(r.unitCost ?? 0) || 0).toFixed(2);
        return `${name}: ${dims} (${cost} USD)`;
      });
      const qtyLines = rows.map((r: any, idx: number) => {
        const name = r.itemName || `Item ${idx + 1}`;
        return `${name}: Qty ${r.qtyPerCarton ?? "-"}`;
      });
      return {
        qtyCtn: qtyLines.join("\n"),
        commercialType: "Light (Multiple)",
        packaging: packagingLines.join("\n"),
      };
    }

    const pack = details.packaging || {};
    const dims = `${pack.length ?? "-"} × ${pack.width ?? "-"} × ${pack.height ?? "-"}`;
    return {
      qtyCtn: details.pcsPerCarton ? String(details.pcsPerCarton) : "-",
      commercialType: "Light (Single)",
      packaging: dims,
    };
  }

  // BASIC
  const pack = details.packaging || {};
  const dims =
    pack.length || pack.width || pack.height
      ? `${pack.length ?? "-"} × ${pack.width ?? "-"} × ${pack.height ?? "-"}`
      : "-";
  return {
    qtyCtn: details.pcsPerCarton ? String(details.pcsPerCarton) : "-",
    commercialType: "Basic",
    packaging: dims,
  };
}

/** Used by View mode — raw packaging strings come from Supabase (human-readable multi-line or legacy base64 "MULTI:" format). */
type LightMultiRowRaw = {
  itemName?: string;
  unitCost?: number;
  length?: string | number;
  width?: string | number;
  height?: string | number;
  qtyPerCarton?: number;
};

function decodeBase64ToStringLocal(base64: string): string | null {
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return null;
  }
}

function parseMultiPackagingRaw(packagingStr: string | undefined): LightMultiRowRaw[] | null {
  const raw = (packagingStr ?? "").trim();
  if (!raw || raw === "-") return null;

  if (raw.startsWith("MULTI:")) {
    const decoded = decodeBase64ToStringLocal(raw.slice("MULTI:".length));
    if (!decoded) return null;
    try {
      const parsed = JSON.parse(decoded);
      if (parsed?.v === 1 && parsed?.type === "LIGHT_MULTIPLE" && Array.isArray(parsed?.rows)) {
        return parsed.rows;
      }
    } catch {
      /* noop */
    }
    return null;
  }

  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return null;
  const isOldFormat = lines.length % 3 === 0;
  const isNewFormat = lines.length % 4 === 0;
  if (!isOldFormat && !isNewFormat) return null;

  const rows: LightMultiRowRaw[] = [];
  const linesPerItem = isNewFormat ? 4 : 3;
  for (let i = 0; i < lines.length; i += linesPerItem) {
    const itemName = lines[i] || "";
    let qtyPerCarton = 0;
    let dimensions = "";
    let unitCostStr = "";
    if (isNewFormat) {
      const qtyLine = lines[i + 1] || "";
      dimensions = lines[i + 2] || "";
      unitCostStr = lines[i + 3] || "";
      const qtyMatch = qtyLine.match(/^Qty:\s*(\d+)/);
      qtyPerCarton = qtyMatch ? parseInt(qtyMatch[1], 10) : 0;
    } else {
      dimensions = lines[i + 1] || "";
      unitCostStr = lines[i + 2] || "";
    }
    const dimParts = dimensions.split("×").map((p) => p.trim());
    const costMatch = unitCostStr.match(/^([\d.]+)/);
    rows.push({
      itemName,
      length: dimParts[0] || "-",
      width: dimParts[1] || "-",
      height: dimParts[2] || "-",
      unitCost: costMatch ? parseFloat(costMatch[1]) : 0,
      qtyPerCarton,
    });
  }
  return rows.length ? rows : null;
}

function formatCommercialDetailsPlainText(
  commercialTypeRaw: string | undefined,
  packagingStr: string | undefined,
  pcsPerCartonStr: string | undefined,
  productName?: string,
): { qtyCtn: string; commercialType: string; packaging: string } {
  let ct = (commercialTypeRaw || "BASIC").toUpperCase();
  const nameLower = (productName || "").toLowerCase();
  if (nameLower.includes("lights (multiple)") || nameLower.includes("light (multiple)")) ct = "LIGHT";
  else if (nameLower.includes("lights (single)") || nameLower.includes("light (single)")) ct = "LIGHT";

  const pack = packagingStr && packagingStr !== "" ? packagingStr : "-";
  const pcs = pcsPerCartonStr && pcsPerCartonStr !== "" ? pcsPerCartonStr : "-";

  if (ct === "POLE") return { qtyCtn: "-", commercialType: "Pole", packaging: "-" };

  if (ct === "LIGHT") {
    const rows = parseMultiPackagingRaw(pack);
    let isMultiple = !!rows && rows.length > 0;
    if (nameLower.includes("lights (multiple)") || nameLower.includes("light (multiple)")) isMultiple = true;
    else if (nameLower.includes("lights (single)") || nameLower.includes("light (single)")) isMultiple = false;

    if (isMultiple && rows && rows.length > 0) {
      const packagingLines = rows.map((r, idx) => {
        const name = r.itemName || `Item ${idx + 1}`;
        return `${name}: ${r.length ?? "-"} cm × ${r.width ?? "-"} cm × ${r.height ?? "-"} cm (${(Number(r.unitCost ?? 0) || 0).toFixed(2)} USD)`;
      });
      const qtyLines = rows.map((r, idx) => {
        const name = r.itemName || `Item ${idx + 1}`;
        return `${name}: Qty ${r.qtyPerCarton ?? "-"}`;
      });
      return {
        qtyCtn: qtyLines.join("\n"),
        commercialType: "Light (Multiple)",
        packaging: packagingLines.join("\n"),
      };
    }

    return { qtyCtn: pcs, commercialType: "Light (Single)", packaging: pack };
  }

  return { qtyCtn: pcs, commercialType: "Basic", packaging: pack };
}

/* ─────────────────────────────────────────────────────────────── */
/* BUILDERS                                                         */
/* ─────────────────────────────────────────────────────────────── */

/** Builder: from productOffers state (Create & Edit modes) */
export function buildExcelItemsFromProductOffers(params: {
  itemDescriptions: string[];
  itemImages: string[];
  itemQtyString: string;
  productOffers: Record<number, any[]>;
  spfNumber: string;
}): SPFExcelItemRow[] {
  const { itemDescriptions, itemImages, itemQtyString, productOffers, spfNumber } = params;
  const qtys = (itemQtyString || "").split(",").map((q) => q.trim());

  const optionIndexToLetters = (idx: number) => {
    let n = idx;
    let s = "";
    while (n >= 0) {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  };

  // Each item (row) is built independently — offers never spill into another item's block.
  return itemDescriptions.map((desc, rowIndex) => {
    const rowBase = `${spfNumber}-${String(rowIndex + 1).padStart(3, "0")}`;
    const offers = productOffers[rowIndex] || [];

    return {
      agentItemNumber: rowBase,
      agentImageUrl: itemImages[rowIndex],
      agentItemQty: qtys[rowIndex] || "-",
      agentDescription: (desc || "").replace(/\|/g, " · "),
      offers: offers.map((prod: any, i: number) => {
        const { qtyCtn, commercialType, packaging } = buildPackagingAndQtyText(prod);
        const qty = prod.qty ?? 1;
        const cost = Number(prod?.commercialDetails?.unitCost || 0);
        const specsText = (prod.technicalSpecifications || [])
          .map((g: any) =>
            [
              g.title,
              ...(g.specs || [])
                .filter((s: any) => s.value?.trim())
                .map((s: any) => `${s.specId}: ${s.value}`),
            ]
              .filter(Boolean)
              .join("\n"),
          )
          .filter(Boolean)
          .join("\n\n");

        return {
          offerItemNumber: offers.length > 1 ? `${rowBase}-${optionIndexToLetters(i)}` : rowBase,
          imageUrl: prod.mainImage?.url,
          technicalSpecifications: specsText || "-",
          qtyCtn,
          moq: prod.__moq || "-",
          warranty: prod?.commercialDetails?.warranty || "-",
          quotationsValidity: (() => {
            const qv = prod.__quotationsValidity || prod.__priceValidity || prod.price_validity;
            if (!qv) return "-";
            try {
              const date = new Date(qv);
              if (isNaN(date.getTime())) {
                return "TBA";
              }
              return date.toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            } catch {
              return "TBA";
            }
          })(),
          productionLeadTime: (() => {
            const plt = prod.__productionLeadTime;
            if (!plt) return "-";
            try {
              const date = new Date(plt);
              if (isNaN(date.getTime())) {
                return "TBA";
              }
              return date.toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            } catch {
              return "TBA";
            }
          })(),
          deliveryLeadTime: (() => {
            const dlt = prod.__deliveryLeadTime;
            if (!dlt) return "-";
            try {
              const date = new Date(dlt);
              if (isNaN(date.getTime())) {
                return "TBA";
              }
              return date.toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            } catch {
              return "TBA";
            }
          })(),
          commercialType,
          packaging,
          totalCost: (qty * cost).toFixed(2),
        };
      }),
    };
  });
}

/** Builder: from parsed row-* arrays (View mode in spf-request-fetch.tsx) */
export function buildExcelItemsFromViewData(params: {
  spfNumber: string;
  itemDescriptions: string[];
  itemImages: string[];
  itemQtyString: string;
  rowImages: string[][];
  rowSubtotals: string[][];
  rowWarranties: string[][];
  rowPriceValidities: string[][];
  rowLeadTimes: string[][];
  rowItemCodes: string[][];
  rowSpecsFlat: string[][][];
  rowCommercialTypes: string[][];
  rowPackaging: string[][];
  rowPcsPerCartons: string[][];
  rowProductNames: string[][];
  rowMoqs: string[][];
  rowQuotationsValidities: string[][];
  rowProductionLeadTimes: string[][];
  rowDeliveryLeadTimes: string[][];
}): SPFExcelItemRow[] {
  const {
    spfNumber,
    itemDescriptions,
    itemImages,
    itemQtyString,
    rowImages,
    rowSubtotals,
    rowWarranties,
    rowPriceValidities,
    rowLeadTimes,
    rowItemCodes,
    rowSpecsFlat,
    rowCommercialTypes,
    rowPackaging,
    rowPcsPerCartons,
    rowProductNames,
    rowMoqs,
    rowQuotationsValidities,
    rowProductionLeadTimes,
    rowDeliveryLeadTimes,
  } = params;
  const qtys = (itemQtyString || "").split(",").map((q) => q.trim());

  return itemDescriptions.map((desc, rowIndex) => {
    const prodImages = rowImages[rowIndex] ?? [];
    const hasProducts = prodImages.length > 0 && !(prodImages.length === 1 && prodImages[0] === "");

    return {
      agentItemNumber: `${spfNumber}-${String(rowIndex + 1).padStart(3, "0")}`,
      agentImageUrl: itemImages[rowIndex],
      agentItemQty: qtys[rowIndex] || "-",
      agentDescription: (desc || "").replace(/\|/g, " · "),
      offers: !hasProducts
        ? []
        : prodImages.map((img, i) => {
            const specsForOpt = (rowSpecsFlat[rowIndex]?.[i] ?? []) as any;
            const { qtyCtn, commercialType, packaging } = formatCommercialDetailsPlainText(
              (rowCommercialTypes[rowIndex] ?? [])[i],
              (rowPackaging[rowIndex] ?? [])[i],
              (rowPcsPerCartons[rowIndex] ?? [])[i],
              (rowProductNames[rowIndex] ?? [])[i],
            );
            return {
              offerItemNumber:
                (rowItemCodes[rowIndex] ?? [])[i] && (rowItemCodes[rowIndex] ?? [])[i] !== "-"
                  ? (rowItemCodes[rowIndex] ?? [])[i]
                  : `${spfNumber}-${String(rowIndex + 1).padStart(3, "0")}`,
              imageUrl: img,
              technicalSpecifications: Array.isArray(specsForOpt) ? specsForOpt.join("\n") : "-",
              warranty: (rowWarranties[rowIndex] ?? [])[i] || "-",
              quotationsValidity: (() => {
                const pv = (rowQuotationsValidities[rowIndex] ?? [])[i] || (rowPriceValidities[rowIndex] ?? [])[i];
                if (!pv || pv === "-") return "-";
                try {
                  const date = new Date(pv);
                  if (isNaN(date.getTime())) {
                    return "TBA";
                  }
                  return date.toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                } catch {
                  return "TBA";
                }
              })(),
              productionLeadTime: (() => {
                const plt = (rowProductionLeadTimes[rowIndex] ?? [])[i];
                if (!plt || plt === "-") return "-";
                try {
                  const date = new Date(plt);
                  if (isNaN(date.getTime())) {
                    return "TBA";
                  }
                  return date.toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                } catch {
                  return "TBA";
                }
              })(),
              deliveryLeadTime: (() => {
                const dlt = (rowDeliveryLeadTimes[rowIndex] ?? [])[i];
                if (!dlt || dlt === "-") return "-";
                try {
                  const date = new Date(dlt);
                  if (isNaN(date.getTime())) {
                    return "TBA";
                  }
                  return date.toLocaleString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                } catch {
                  return "TBA";
                }
              })(),
              moq: (rowMoqs[rowIndex] ?? [])[i] || "-",
              qtyCtn,
              commercialType,
              packaging,
              totalCost: (rowSubtotals[rowIndex] ?? [])[i] || "0",
            };
          }),
    };
  });
}

/* ─────────────────────────────────────────────────────────────── */
/* HYPERLINK HELPER                                                 */
/* ─────────────────────────────────────────────────────────────── */
function setLinkCell(cell: ExcelJS.Cell, url: string | undefined, label: string) {
  const trimmed = (url ?? "").trim();
  if (!trimmed || trimmed === "-") {
    cell.value = "-";
    return;
  }
  cell.value = { text: label, hyperlink: trimmed } as any;
  cell.font = { color: { argb: "FF0563C1" }, underline: true };
}

/* ─────────────────────────────────────────────────────────────── */
/* TECHNICAL SPECS RICH TEXT (bolds group titles like "LAMP DETAILS") */
/* ─────────────────────────────────────────────────────────────── */
// Heuristic: a "specId: value" line always has a colon; a group title line
// (e.g. "LAMP DETAILS", "SOLAR PANEL DETAILS", "TEST") never does.
function buildSpecsRichText(text: string): ExcelJS.CellRichTextValue | string {
  if (!text || text === "-") return text ?? "-";
  const lines = text.split("\n");
  const richText = lines.map((line, idx) => {
    const isLast = idx === lines.length - 1;
    const isTitle = line.trim().length > 0 && !line.includes(":");
    return {
      text: line + (isLast ? "" : "\n"),
      font: isTitle ? { bold: true } : {},
    };
  });
  return { richText };
}

/* ─────────────────────────────────────────────────────────────── */
/* ROW HEIGHT ESTIMATION (accounts for word-wrap, not just \n)     */
/* ─────────────────────────────────────────────────────────────── */
function estimateWrappedLineCount(text: string, columnWidthChars: number, charWidthFactor = 1.15): number {
  if (!text) return 1;
  const effectiveWidth = Math.max(5, Math.floor(columnWidthChars * charWidthFactor));
  return text.split("\n").reduce((total, line) => {
    if (line.length === 0) return total + 1;
    return total + Math.max(1, Math.ceil(line.length / effectiveWidth));
  }, 0);
}

/* ─────────────────────────────────────────────────────────────── */
/* COLUMN WIDTH ESTIMATION (auto-stretch horizontally)              */
/* ─────────────────────────────────────────────────────────────── */
function longestLineLength(value: unknown): number {
  if (value === null || value === undefined) return 0;
  let text: string;
  if (typeof value === "object" && value !== null && "richText" in (value as any)) {
    text = ((value as any).richText as { text: string }[]).map((r) => r.text).join("");
  } else if (typeof value === "object" && value !== null && "text" in (value as any)) {
    text = String((value as any).text ?? "");
  } else {
    text = String(value);
  }
  return text.split("\n").reduce((max, line) => Math.max(max, line.length), 0);
}

// Caps stop any single column from stretching the whole sheet too wide —
// beyond the cap, wrapText + the row-height pass below takes over instead.
const COLUMN_WIDTH_CAPS: Record<string, number> = {
  agentItemNumber: 20,
  agentImage: 18,
  agentItemQty: 16,
  agentDescription: 45,
  spacer: 3,
  offerItemNumber: 20,
  itemImage: 18,
  technicalSpecifications: 55,
  qtyCtn: 22,
  moq: 12,
  warranty: 16,
  quotationsValidity: 22,
  productionLeadTime: 18,
  deliveryLeadTime: 18,
  commercialType: 18,
  packaging: 40,
  totalCost: 16,
};

function autoFitColumnWidths(sheet: ExcelJS.Worksheet) {
  sheet.columns?.forEach((col) => {
    if (!col?.key) return;
    const cap = COLUMN_WIDTH_CAPS[col.key] ?? (col.width ?? 20);
    let maxLen = 8;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = longestLineLength(cell.value);
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(cap, Math.max(col.width ?? 10, maxLen + 2));
  });
}

/* ─────────────────────────────────────────────────────────────── */
/* MAIN EXPORT                                                      */
/* ─────────────────────────────────────────────────────────────── */
export async function exportSPFRequestToExcel(spfNumber: string, items: SPFExcelItemRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("SPF Request");

  sheet.columns = [
    { key: "agentItemNumber", width: 16 },
    { key: "agentImage", width: 18 },
    { key: "agentItemQty", width: 14 },
    { key: "agentDescription", width: 30 },
    { key: "spacer", width: 3 },
    { key: "offerItemNumber", width: 16 },
    { key: "itemImage", width: 18 },
    { key: "technicalSpecifications", width: 40 },
    { key: "qtyCtn", width: 16 },
    { key: "moq", width: 10 },
    { key: "warranty", width: 12 },
    { key: "quotationsValidity", width: 18 },
    { key: "productionLeadTime", width: 16 },
    { key: "deliveryLeadTime", width: 16 },
    { key: "commercialType", width: 16 },
    { key: "packaging", width: 35 },
    { key: "totalCost", width: 14 },
  ];

  sheet.mergeCells("A1:D1");
  sheet.mergeCells("F1:Q1");

  const agentHeader = sheet.getCell("A1");
  agentHeader.value = "AGENT'S OFFER";
  agentHeader.font = { bold: true };
  agentHeader.alignment = { horizontal: "center", vertical: "middle" };
  agentHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00FF00" } };

  const supplierHeader = sheet.getCell("F1");
  supplierHeader.value = "SUPPLIER'S OFFER";
  supplierHeader.font = { bold: true };
  supplierHeader.alignment = { horizontal: "center", vertical: "middle" };
  supplierHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } };

  ["E1", "E2"].forEach((addr) => {
    sheet.getCell(addr).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
  });

  const columnTitles = [
    "Agent Item #",
    "Agent Image",
    "Agent Item Qty",
    "Agent Description",
    "",
    "Offer Item #",
    "Item Image",
    "Technical Specifications",
    "Qty/Ctn",
    "MOQ",
    "Warranty",
    "Quotations Validity",
    "Production Lead Time",
    "Delivery Lead Time",
    "Commerical Type",
    "Packaging",
    "Total Cost",
  ];
  const titleRow = sheet.getRow(2);
  columnTitles.forEach((title, idx) => {
    const cell = titleRow.getCell(idx + 1);
    cell.value = title;
    cell.font = { bold: true };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    if (title) {
      cell.border = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      };
    }
  });
  titleRow.height = 30;

  let currentRow = 3;
  const pendingRowHeights: { row: number; specs: string; packaging: string; qtyCtn: string }[] = [];

  for (const item of items) {
    const offers = item.offers.length ? item.offers : [{ offerItemNumber: "-" } as SPFExcelOfferRow];
    const startRow = currentRow;
    const endRow = currentRow + offers.length - 1;

    if (offers.length > 1) {
      sheet.mergeCells(`A${startRow}:A${endRow}`);
      sheet.mergeCells(`B${startRow}:B${endRow}`);
      sheet.mergeCells(`C${startRow}:C${endRow}`);
      sheet.mergeCells(`D${startRow}:D${endRow}`);
      sheet.mergeCells(`E${startRow}:E${endRow}`);
    }

    sheet.getCell(`A${startRow}`).value = item.agentItemNumber;
    sheet.getCell(`A${startRow}`).alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell(`C${startRow}`).value = item.agentItemQty ?? "-";
    sheet.getCell(`C${startRow}`).alignment = { vertical: "middle", horizontal: "center" };
    sheet.getCell(`D${startRow}`).value = item.agentDescription ?? "-";
    sheet.getCell(`D${startRow}`).alignment = { vertical: "middle", wrapText: true };

    // Agent Image -> hyperlink instead of embedded image
    setLinkCell(sheet.getCell(`B${startRow}`), item.agentImageUrl, "View Item Photo");
    sheet.getCell(`B${startRow}`).alignment = { vertical: "middle", horizontal: "center" };

    // Thicker top border on the first row of each new item, to visually separate items from one another
    ["A", "B", "C", "D"].forEach((col) => {
      const topCell = sheet.getCell(`${col}${startRow}`);
      topCell.border = {
        ...topCell.border,
        top: { style: "medium" },
      };
    });

    for (let r = startRow; r <= endRow; r++) {
      sheet.getCell(`E${r}`).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } };
      ["A", "B", "C", "D"].forEach((col) => {
        const cell = sheet.getCell(`${col}${r}`);
        cell.border = {
          ...cell.border,
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });
    }

    for (let i = 0; i < offers.length; i++) {
      const row = startRow + i;
      const offer = offers[i];

      sheet.getCell(`F${row}`).value = offer.offerItemNumber ?? "-";
      setLinkCell(sheet.getCell(`G${row}`), offer.imageUrl, "View Product Photo");
      sheet.getCell(`H${row}`).value = buildSpecsRichText(offer.technicalSpecifications ?? "-");
      sheet.getCell(`I${row}`).value = offer.qtyCtn ?? "-";
      sheet.getCell(`J${row}`).value = offer.moq ?? "-";
      sheet.getCell(`K${row}`).value = offer.warranty ?? "-";
      sheet.getCell(`L${row}`).value = offer.quotationsValidity ?? "-";
      sheet.getCell(`M${row}`).value = offer.productionLeadTime ?? "-";
      sheet.getCell(`N${row}`).value = offer.deliveryLeadTime ?? "-";
      sheet.getCell(`O${row}`).value = offer.commercialType ?? "-";
      sheet.getCell(`P${row}`).value = offer.packaging ?? "-";
      sheet.getCell(`Q${row}`).value = offer.totalCost ?? "-";

      ["F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q"].forEach((col) => {
        const cell = sheet.getCell(`${col}${row}`);
        const isCentered = !["H", "P", "G"].includes(col);
        cell.alignment = {
          vertical: "middle",
          wrapText: true,
          horizontal: isCentered ? "center" : "left",
        };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "thin" },
          left: { style: "thin" },
          right: { style: "thin" },
        };
      });

      // Defer row height until AFTER columns are auto-fit (below), so the wrap
      // estimate is measured against the real final column widths, not a guess.
      pendingRowHeights.push({
        row,
        specs: offer.technicalSpecifications ?? "",
        packaging: offer.packaging ?? "",
        qtyCtn: offer.qtyCtn ?? "",
      });
    }

currentRow = endRow + 1;
  }

  // HORIZONTAL auto-stretch: widen each column to fit its longest single line (capped)
  autoFitColumnWidths(sheet);

  // VERTICAL auto-stretch: now that column widths are final, measure wrapped-line
  // counts against the real widths and set row heights so nothing is clipped
  const specsWidth = sheet.getColumn("technicalSpecifications").width ?? 40;
  const packagingWidth = sheet.getColumn("packaging").width ?? 35;
  const qtyCtnWidth = sheet.getColumn("qtyCtn").width ?? 16;

  pendingRowHeights.forEach(({ row, specs, packaging, qtyCtn }) => {
    const lineCount = Math.max(
      estimateWrappedLineCount(specs, specsWidth),
      estimateWrappedLineCount(packaging, packagingWidth),
      estimateWrappedLineCount(qtyCtn, qtyCtnWidth),
      1,
    );
    sheet.getRow(row).height = Math.max(20, lineCount * 16 + 6);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/octet-stream" });
  saveAs(blob, `${spfNumber || "SPF-Request"}.xlsx`);
}