import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/utils/supabase";

const ROW_SEP = "|ROW|";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const { spf_number } = req.query;

    if (!spf_number || typeof spf_number !== "string") {
      return res.status(400).json({ message: "Missing SPF number" });
    }

    /* ── Fetch draft ── */
    const { data: draft, error } = await supabase
      .from("spf_creation_draft")
      .select("*")
      .eq("spf_number", spf_number)
      .maybeSingle();

    if (error) {
      console.error("Draft fetch error:", error);
      return res.status(500).json({ message: "Failed to fetch draft", error });
    }

    if (!draft) {
      return res.status(404).json({ message: "No draft found", hasDraft: false });
    }

    /* ── Parse draft data into structured format ── */
    const parseRowData = (value: string | null): string[] => {
      if (!value) return [];
      return value.split(ROW_SEP);
    };

    const parseCommaDelimited = (value: string | null): string[][] => {
      const rows = parseRowData(value);
      return rows.map(row => row.split(",").map(v => v.trim()));
    };

    const parsePipeDelimited = (value: string | null): string[][] => {
      const rows = parseRowData(value);
      return rows.map(row => row.split(" | ").map(v => v.trim()));
    };

    // Parse technical specs (format: "Group1~~spec1:val1;;spec2:val2@@Group2~~...")
    const parseTechnicalSpecs = (value: string | null): any[] => {
      if (!value || value === "-") return [];
      const rows = parseRowData(value);
      return rows.map(row => {
        if (row === "-" || !row) return [];
        const groups = row.split("@@");
        return groups.map(group => {
          const [title, specsStr] = group.split("~~");
          const specs = specsStr ? specsStr.split(";;").map(spec => {
            const [specId, value] = spec.split(":");
            return { specId: specId?.trim(), value: value?.trim() };
          }) : [];
          return { title: title?.trim(), specs };
        });
      });
    };

    const rowCount = parseRowData(draft.product_offer_image).length || 1;

    // Helper to format date for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatDateTimeLocal = (value: string | null): string => {
      if (!value || value === "-" || value === "") return "";
      // If already in datetime-local format, return as-is
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return value;
      // If it's an ISO string, convert it
      try {
        const parsed = new Date(value);
        if (!isNaN(parsed.getTime())) {
          const year = parsed.getFullYear();
          const month = String(parsed.getMonth() + 1).padStart(2, '0');
          const day = String(parsed.getDate()).padStart(2, '0');
          const hours = String(parsed.getHours()).padStart(2, '0');
          const minutes = String(parsed.getMinutes()).padStart(2, '0');
          return `${year}-${month}-${day}T${hours}:${minutes}`;
        }
      } catch {}
      return value;
    };

    // Reconstruct product offers by row
    const productOffersByRow: Record<number, any[]> = {};
    
    const images = parseCommaDelimited(draft.product_offer_image);
    const qtys = parseCommaDelimited(draft.product_offer_qty);
    const specs = parseTechnicalSpecs(draft.product_offer_technical_specification);
    const origSpecs = parseTechnicalSpecs(draft.original_technical_specification);
    const unitCosts = parseCommaDelimited(draft.product_offer_unit_cost);
    const pcsPerCartons = parsePipeDelimited(draft.product_offer_pcs_per_carton);
    const packagingDetails = parseCommaDelimited(draft.product_offer_packaging_details);
    const factories = parseCommaDelimited(draft.product_offer_factory_address);
    const ports = parseCommaDelimited(draft.product_offer_port_of_discharge);
    const subtotals = parseCommaDelimited(draft.product_offer_subtotal);
    const supplierBrands = parseCommaDelimited(draft.supplier_brand);
    const companyNames = parseCommaDelimited(draft.company_name);
    const contactNames = parseCommaDelimited(draft.contact_name);
    const contactNumbers = parseCommaDelimited(draft.contact_number);
    const sellingCosts = parseCommaDelimited(draft.final_selling_cost);
    const leadTimes = parseCommaDelimited(draft.proj_lead_time);
    const itemCodes = parseCommaDelimited(draft.item_code);
    const priceValidities = parseCommaDelimited(draft.price_validity);
    const dimensionalDrawings = parseCommaDelimited(draft.dimensional_drawing);
    const illuminanceDrawings = parseCommaDelimited(draft.illuminance_drawing);
    const productNames = parseCommaDelimited((draft as any).product_name ?? null);
    const tdsBrands = parseCommaDelimited((draft as any).tds_brand ?? null);
    const productRefIDs = parseCommaDelimited(draft.product_reference_id);
    const branches = parseCommaDelimited(draft.supplier_branch);
    const spfRemarksPD = parseCommaDelimited(draft.spf_remarks_pd);
    const commercialTypes = parseCommaDelimited(draft.commercial_type);
    const tdsPdfUrls = parseCommaDelimited(draft.tds);
    const isExisting = parseCommaDelimited(draft.is_existing);

    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const rowProducts: any[] = [];
      const rowImageList = images[rowIdx] || [];
      
      for (let optIdx = 0; optIdx < rowImageList.length; optIdx++) {
        if (rowImageList[optIdx] === "-" || !rowImageList[optIdx]) continue;

        const product: any = {
          mainImage: { url: rowImageList[optIdx] },
          qty: Number(qtys[rowIdx]?.[optIdx] || 1),
          productName: productNames[rowIdx]?.[optIdx] && productNames[rowIdx][optIdx] !== "-" ? productNames[rowIdx][optIdx] : "",
          technicalSpecifications: specs[rowIdx] || [],
          __originalTechnicalSpecifications: origSpecs[rowIdx] || [],
          commercialDetails: {
            unitCost: unitCosts[rowIdx]?.[optIdx] || "0",
            pcsPerCarton: pcsPerCartons[rowIdx]?.[optIdx] || "-",
            packaging: packagingDetails[rowIdx]?.[optIdx] || "-",
            factoryAddress: factories[rowIdx]?.[optIdx] || "-",
            portOfDischarge: ports[rowIdx]?.[optIdx] || "-",
            commercialType: commercialTypes[rowIdx]?.[optIdx] || "BASIC",
          },
          supplier: {
            supplierBrand: supplierBrands[rowIdx]?.[optIdx] || "-",
            company: companyNames[rowIdx]?.[optIdx] || "-",
          },
          contact_name: contactNames[rowIdx]?.[optIdx] || "-",
          contact_number: contactNumbers[rowIdx]?.[optIdx] || "-",
          __sellingCost: sellingCosts[rowIdx]?.[optIdx] || "-",
          __leadTime: leadTimes[rowIdx]?.[optIdx] || "-",
          __priceValidity: formatDateTimeLocal(priceValidities[rowIdx]?.[optIdx] || null),
          dimensionalDrawing: (() => {
            const u = dimensionalDrawings[rowIdx]?.[optIdx];
            return u && u !== "-" ? { url: u } : null;
          })(),
          illuminanceDrawing: (() => {
            const u = illuminanceDrawings[rowIdx]?.[optIdx];
            return u && u !== "-" ? { url: u } : null;
          })(),
          productReferenceID: productRefIDs[rowIdx]?.[optIdx] || null,
          __selectedBranch: branches[rowIdx]?.[optIdx] || "-",
          __spfRemarksPD: spfRemarksPD[rowIdx]?.[optIdx] || "-",
          __tdsPdfUrl: tdsPdfUrls[rowIdx]?.[optIdx] || "",
          __tdsBrand: tdsBrands[rowIdx]?.[optIdx] && tdsBrands[rowIdx][optIdx] !== "-" ? tdsBrands[rowIdx][optIdx] : "",
          __tdsProductName: productNames[rowIdx]?.[optIdx] && productNames[rowIdx][optIdx] !== "-" ? productNames[rowIdx][optIdx] : "",
          __isExisting: isExisting[rowIdx]?.[optIdx] === "true",
          __rowIndex: rowIdx,
        };

        rowProducts.push(product);
      }

      productOffersByRow[rowIdx] = rowProducts;
    }

    return res.status(200).json({
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
      },
      productOffers: productOffersByRow,
      totalItemRows: rowCount,
    });

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
