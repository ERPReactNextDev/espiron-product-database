import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { supabase } from "@/utils/supabase";

const ROW_SEP = "|ROW|";

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
  try { return Buffer.from(base64, "base64").toString("utf-8"); } catch { return null; }
}

function decodeMultiPackaging(packagingStr: string | undefined): MultiPackagingPayloadV1 | null {
  const raw = (packagingStr ?? "").trim();
  if (!raw.startsWith("MULTI:")) return null;
  const decoded = decodeBase64ToString(raw.slice("MULTI:".length));
  if (!decoded) return null;
  try {
    const parsed = JSON.parse(decoded);
    if (parsed?.v !== 1 || parsed?.type !== "LIGHT_MULTIPLE" || !Array.isArray(parsed?.rows)) return null;
    return parsed as MultiPackagingPayloadV1;
  } catch { return null; }
}

function parseHumanReadableMultiPackaging(packagingStr: string | undefined): MultiPackagingPayloadV1 | null {
  const raw = (packagingStr ?? "").trim();
  if (!raw || raw === "-") return null;
  if (raw.startsWith("MULTI:")) return decodeMultiPackaging(raw);

  const lines = raw.split("\n").map((l) => l.trim()).filter((l) => l);
  if (lines.length === 0) return null;

  const isOldFormat = lines.length % 3 === 0;
  const isNewFormat = lines.length % 4 === 0;
  if (!isOldFormat && !isNewFormat) return null;

  const rows: LightMultipleRow[] = [];
  const linesPerItem = isNewFormat ? 4 : 3;

  for (let i = 0; i < lines.length; i += linesPerItem) {
    const itemName = lines[i] || "";
    let qtyPerCarton = 0, dimensions = "", unitCostStr = "";
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
    const dimParts = dimensions.split("\u00D7").map((p) => p.trim());
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

  if (rows.length === 0) return null;
  return { v: 1, type: "LIGHT_MULTIPLE", rows };
}

function parsePackagingDimensions(packagingStr: string | undefined) {
  const raw = (packagingStr ?? "").trim();
  if (!raw || raw === "-") return { length: "-", width: "-", height: "-" };
  const parts = raw.split(/(?:\s*x\s*|\s*×\s*)/i).map((p) => p.trim()).filter(Boolean);
  return { length: parts[0] ?? "-", width: parts[1] ?? "-", height: parts[2] ?? "-" };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const spf_number = searchParams.get("spf_number") ?? undefined;

    if (!spf_number) {
      return NextResponse.json({ message: "Missing SPF number" }, { status: 400 });
    }

    const { data: draft, error } = await supabase
      .from("spf_creation_draft")
      .select("*")
      .eq("spf_number", spf_number)
      .maybeSingle();

    if (error) {
      console.error("Draft fetch error:", error);
      return NextResponse.json({ message: "Failed to fetch draft", error }, { status: 500 });
    }

    if (!draft) {
      return NextResponse.json({ message: "No draft found", hasDraft: false }, { status: 404 });
    }

    const splitRows = (value: string | null): string[] => {
      if (!value) return [];
      return value.split(ROW_SEP);
    };

    const rawItemCodes = splitRows(draft.item_code);

    const extractRowNumber = (code: string): number | null => {
      const match = code.match(/-(\d{3})(?:-[A-Z]+)?$/);
      if (!match) return null;
      return parseInt(match[1], 10) - 1;
    };

    const parsedRowIndices = rawItemCodes.map(extractRowNumber);
    const maxParsedRow: number = parsedRowIndices.reduce<number>(
      (max, idx) => (idx !== null && idx > max ? idx : max), -1
    );
    const rowCount =
      maxParsedRow >= 0 ? maxParsedRow + 1 : splitRows(draft.product_offer_image).length || 1;

    const flatIndexToRowIndex: number[] = parsedRowIndices.map((idx) => idx ?? 0);

    const formatDateTimeLocal = (value: string | null): string => {
      if (!value || value === "-" || value === "") return "";
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
      try {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}T${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
        }
      } catch {}
      return value;
    };

    const parseSingleRowSpec = (raw: string): any[] => {
      if (!raw || raw === "-") return [];
      return raw.split("@@").map((group) => {
        const [title, specsStr] = group.split("~~");
        const specs = specsStr
          ? specsStr.split(";;").map((spec) => {
              const colonIdx = spec.indexOf(":");
              if (colonIdx === -1) return { specId: spec.trim(), value: "" };
              return { specId: spec.slice(0, colonIdx).trim(), value: spec.slice(colonIdx + 1).trim() };
            })
          : [];
        return { title: title?.trim() ?? "", specs };
      });
    };

    const flatImages          = splitRows(draft.product_offer_image);
    const flatQtys            = splitRows(draft.product_offer_qty);
    const flatUnitCosts       = splitRows(draft.product_offer_unit_cost);
    const flatPcsPerCartons   = splitRows(draft.product_offer_pcs_per_carton);
    const flatPackaging       = splitRows(draft.product_offer_packaging_details);
    const flatWarranties      = splitRows((draft as any).warranty ?? null);
    const flatFactories       = splitRows(draft.product_offer_factory_address);
    const flatPorts           = splitRows(draft.product_offer_port_of_discharge);
    const flatSubtotals       = splitRows(draft.product_offer_subtotal);
    const flatSupplierBrands  = splitRows(draft.supplier_brand);
    const flatSupplierModelCodes = splitRows((draft as any).supplier_model_code ?? null);
    const flatCompanyNames    = splitRows(draft.company_name);
    const flatContactNames    = splitRows(draft.contact_name);
    const flatContactNumbers  = splitRows(draft.contact_number);
    const flatSellingCosts    = splitRows(draft.final_selling_cost);
    const flatLeadTimes       = splitRows(draft.proj_lead_time);
    const flatPriceValidities = splitRows(draft.price_validity);
    const flatDimDrawings     = splitRows(draft.dimensional_drawing);
    const flatIllumDrawings   = splitRows(draft.illuminance_drawing);
    const flatProductNames    = splitRows((draft as any).product_name ?? null);
    const flatTdsBrands       = splitRows((draft as any).tds_brand ?? null);
    const flatProductRefIDs   = splitRows(draft.product_reference_id);
    const flatBranches        = splitRows(draft.supplier_branch);
    const flatSpfRemarksPD    = splitRows(draft.spf_remarks_pd);
    const flatCommercialTypes = splitRows(draft.commercial_type);
    const flatTdsPdfUrls      = splitRows(draft.tds);
    const flatIsExisting      = splitRows(draft.is_existing);
    const flatMoqs            = splitRows((draft as any).moq ?? null);
    const flatQuotationsValidities = splitRows((draft as any).quotations_validity ?? null);
    const flatProductionLeadTimes  = splitRows((draft as any).production_lead_time ?? null);
    const flatDeliveryLeadTimes    = splitRows((draft as any).delivery_lead_time ?? null);
    const flatSpecs     = splitRows(draft.product_offer_technical_specification).map(parseSingleRowSpec);
    const flatOrigSpecs = splitRows(draft.original_technical_specification).map(parseSingleRowSpec);

    const productOffersByRow: Record<number, any[]> = {};
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) productOffersByRow[rowIdx] = [];

    for (let flatIdx = 0; flatIdx < flatImages.length; flatIdx++) {
      const img = flatImages[flatIdx];
      if (!img || img === "-") continue;

      const rowIdx = flatIndexToRowIndex[flatIdx] ?? 0;
      const commercialTypeRaw = (flatCommercialTypes[flatIdx] || "BASIC").toUpperCase();
      const rawPackaging = flatPackaging[flatIdx] || "-";

      let packagingData = { length: "-", width: "-", height: "-" };
      let useArrayInput = false;
      let multiRows: LightMultipleRow[] = [];
      let totalUnitCost: number | undefined;

      const isLightMultiple = commercialTypeRaw === "LIGHT (MULTIPLE)" || commercialTypeRaw === "LIGHT_MULTIPLE";
      const isLightSingle   = commercialTypeRaw === "LIGHT (SINGLE)"   || commercialTypeRaw === "LIGHT_SINGLE";
      const isLightType     = commercialTypeRaw === "LIGHT" || isLightMultiple || isLightSingle;
      const isPoleType      = commercialTypeRaw === "POLE";

      if (isLightMultiple || (isLightType && !isLightSingle)) {
        const decodedMulti = parseHumanReadableMultiPackaging(rawPackaging);
        if (decodedMulti?.rows?.length) {
          useArrayInput = true;
          multiRows = decodedMulti.rows.map((r) => ({
            itemName: r.itemName ?? "",
            unitCost: Number(r.unitCost ?? 0) || 0,
            length: (r.length ?? "-").toString(),
            width: (r.width ?? "-").toString(),
            height: (r.height ?? "-").toString(),
            qtyPerCarton: Number(r.qtyPerCarton ?? 0) || 0,
          }));
          totalUnitCost = multiRows.reduce((sum, r) => sum + (Number(r.unitCost) || 0), 0);
        } else {
          packagingData = parsePackagingDimensions(rawPackaging);
        }
      } else {
        packagingData = parsePackagingDimensions(rawPackaging);
      }

      const product: any = {
        mainImage: { url: img },
        qty: Number(flatQtys[flatIdx] || 1),
        productName: flatProductNames[flatIdx] && flatProductNames[flatIdx] !== "-" ? flatProductNames[flatIdx] : "",
        technicalSpecifications: flatSpecs[flatIdx] || [],
        __originalTechnicalSpecifications: flatOrigSpecs[flatIdx] || [],
        commercialDetails: {
          unitCost: flatUnitCosts[flatIdx] || "0",
          pcsPerCarton: flatPcsPerCartons[flatIdx] || "-",
          packaging: packagingData,
          warranty: flatWarranties[flatIdx] || "-",
          factoryAddress: flatFactories[flatIdx] || "-",
          portOfDischarge: flatPorts[flatIdx] || "-",
          commercialType: isLightMultiple ? "LIGHT" : isLightSingle ? "LIGHT" : isPoleType ? "POLE" : isLightType ? "LIGHT" : "BASIC",
          useArrayInput,
          multiRows,
          ...(typeof totalUnitCost === "number" ? { totalUnitCost } : {}),
        },
        supplier: { supplierBrand: flatSupplierBrands[flatIdx] || "-", company: flatCompanyNames[flatIdx] || "-" },
        supplier_model_code: flatSupplierModelCodes[flatIdx] || "",
        contact_name: flatContactNames[flatIdx] || "-",
        contact_number: flatContactNumbers[flatIdx] || "-",
        __sellingCost: flatSellingCosts[flatIdx] || "-",
        __leadTime: flatLeadTimes[flatIdx] || "-",
        __priceValidity: formatDateTimeLocal(flatPriceValidities[flatIdx] || null),
        dimensionalDrawing: (() => { const u = flatDimDrawings[flatIdx]; return u && u !== "-" ? { url: u } : null; })(),
        illuminanceDrawing: (() => { const u = flatIllumDrawings[flatIdx]; return u && u !== "-" ? { url: u } : null; })(),
        productReferenceID: flatProductRefIDs[flatIdx] || null,
        __selectedBranch: flatBranches[flatIdx] || "-",
        __spfRemarksPD: flatSpfRemarksPD[flatIdx] || "-",
        __tdsPdfUrl: flatTdsPdfUrls[flatIdx] || "",
        __tdsBrand: flatTdsBrands[flatIdx] && flatTdsBrands[flatIdx] !== "-" ? flatTdsBrands[flatIdx] : "",
        __tdsProductName: flatProductNames[flatIdx] && flatProductNames[flatIdx] !== "-" ? flatProductNames[flatIdx] : "",
        __isExisting: flatIsExisting[flatIdx] === "true",
        __rowIndex: rowIdx,
        __moq: flatMoqs[flatIdx] || "-",
        __quotationsValidity: flatQuotationsValidities[flatIdx] || "-",
        __productionLeadTime: flatProductionLeadTimes[flatIdx] || "-",
        __deliveryLeadTime: flatDeliveryLeadTimes[flatIdx] || "-",
      };

      productOffersByRow[rowIdx].push(product);
    }

    return NextResponse.json({
      success: true,
      hasDraft: true,
      draft: {
        spf_number: draft.spf_number,
        referenceid: draft.referenceid,
        tsm: draft.tsm,
        manager: draft.manager,
        draft_author: draft.draft_author,
        item_code: draft.item_code,
        status: draft.status,
        is_edit_mode: draft.is_edit_mode,
        original_spf_number: draft.original_spf_number,
        spf_creation_start_time: draft.spf_creation_start_time,
        date_created: draft.date_created,
        date_updated: draft.date_updated,
        final_unit_cost: (draft as any).final_unit_cost,
        final_subtotal: (draft as any).final_subtotal,
        item_added_date: (draft as any).item_added_date,
        item_added_author: (draft as any).item_added_author,
        revision_remarks: (draft as any).revision_remarks,
        revision_type: (draft as any).revision_type,
        spf_remarks_procurement: (draft as any).spf_remarks_procurement,
        tds_pdf_urls: (draft as any).tds_pdf_urls,
      },
      productOffers: productOffersByRow,
      totalItemRows: rowCount,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ message: err.message || "Server error" }, { status: 500 });
  }
}
