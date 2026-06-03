import type { NextApiRequest, NextApiResponse } from "next";
import { getPhilippinesISOString } from "@/lib/datetime";
import { supabase } from "@/utils/supabase";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const ROW_SEP = "|ROW|";
const ROW_BOUNDARY = "|ROW|";

const supplierCache = new Map<
  string,
  { company: string; contactNames: string; contactNumbers: string }
>();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const {
      spf_number,
      item_code,
      totalItemRows,
      selectedProducts,
      spf_creation_start_time,
      is_edit_mode,
      original_spf_number,
      userId,
    } = req.body;

    if (!spf_number) {
      return res.status(400).json({ message: "Missing SPF number" });
    }

    /* ── Fetch spf_request metadata ── */
    const { data: spfRequest, error: spfRequestError } = await supabase
      .from("spf_request")
      .select("referenceid, tsm, manager")
      .eq("spf_number", spf_number)
      .single();

    if (spfRequestError || !spfRequest) {
      console.error("spf_request fetch error:", spfRequestError);
      return res.status(400).json({ message: "SPF request not found" });
    }

    const referenceIdValue = spfRequest.referenceid ?? null;
    const tsmValue         = spfRequest.tsm          ?? null;
    const managerValue     = spfRequest.manager       ?? null;

    /* ── Resolve draft_author ── */
    let draft_author: string | null = null;
    try {
      if (userId) {
        const { connectToDatabase } = await import("@/lib/mongodb");
        const { ObjectId } = await import("mongodb");
        const mongoDb = await connectToDatabase();
        const user = await mongoDb.collection("users").findOne(
          { _id: new ObjectId(userId) },
          { projection: { ReferenceID: 1 } }
        );
        draft_author = user?.ReferenceID || null;
      }
    } catch (err) {
      console.error("Failed to resolve draft_author:", err);
    }

    const products = Array.isArray(selectedProducts) ? selectedProducts : [];
    const rowCount = typeof totalItemRows === "number" ? totalItemRows : 1;

    /* ── Pre-fetch all unique supplier contacts ── */
    const uniqueSupplierIds = [
      ...new Set(products.map((p: any) => p?.supplier?.supplierId).filter(Boolean)),
    ] as string[];

    for (const supplierId of uniqueSupplierIds) {
      if (supplierCache.has(supplierId)) continue;
      try {
        const supplierSnap = await getDoc(doc(db, "suppliers", supplierId));
        if (supplierSnap.exists()) {
          const d: any   = supplierSnap.data();
          const contacts = d.contacts || [];
          supplierCache.set(supplierId, {
            company:        d.company || "-",
            contactNames:   contacts.map((c: any) => c.name).filter(Boolean).join(" | "),
            contactNumbers: contacts.map((c: any) => c.phone).filter(Boolean).join(" | "),
          });
        }
      } catch (err) {
        console.error("Supplier fetch error:", err);
      }
    }

    /* ── Group products by row ── */
    const rowMap: Record<number, any[]> = {};
    for (let i = 0; i < rowCount; i++) rowMap[i] = [];
    for (const p of products) {
      const idx = typeof p.__rowIndex === "number" ? p.__rowIndex : 0;
      if (!rowMap[idx]) rowMap[idx] = [];
      rowMap[idx].push(p);
    }

    /* ── Per-row accumulators ── */
    const rowImages:          string[] = [];
    const rowQtys:            string[] = [];
    const rowSpecs:           string[] = [];
    const rowUnitCosts:       string[] = [];
    const rowPcsPerCarton:    string[] = [];
    const rowPackaging:       string[] = [];
    const rowWarranties:      string[] = [];
    const rowFactories:       string[] = [];
    const rowPorts:           string[] = [];
    const rowSubtotals:       string[] = [];
    const rowSupplierBrands:  string[] = [];
    const rowCompanyNames:    string[] = [];
    const rowContactNames:    string[] = [];
    const rowContactNumbers:  string[] = [];
    const rowSellingCosts:    string[] = [];
    const rowLeadTimes:       string[] = [];
    const rowItemCodes:       string[] = [];
    const rowPriceValidities: string[] = [];
    const rowDimensionalDrawings: string[] = [];
    const rowIlluminanceDrawings: string[] = [];
    const rowProductNames: string[] = [];
    const rowTdsBrands: string[] = [];
    const rowOriginalSpecs:      string[] = [];
    const rowProductRefIDs:      string[] = [];
    const rowBranches:          string[] = [];
    const rowSpfRemarksPD:      string[] = [];
    const rowCommercialTypes:   string[] = [];
    const rowTdsPdfUrls:        string[] = [];
    const rowIsExisting:        string[] = [];

    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const rowProducts = rowMap[rowIdx] || [];

      const images:          string[] = [];
      const qtys:            string[] = [];
      const specs:           string[] = [];
      const unitCosts:       string[] = [];
      const pcsPerCartons:   string[] = [];
      const packaging:       string[] = [];
      const warranties:      string[] = [];
      const factories:       string[] = [];
      const ports:           string[] = [];
      const subtotals:       string[] = [];
      const supplierBrands:  string[] = [];
      const companyNames:    string[] = [];
      const contactNames:    string[] = [];
      const contactNumbers:  string[] = [];
      const sellingCosts:    string[] = [];
      const leadTimes:       string[] = [];
      const itemCodes:       string[] = [];
      const priceValidities: string[] = [];
      const dimensionalDrawings: string[] = [];
      const illuminanceDrawings: string[] = [];
      const productNames: string[] = [];
      const tdsBrands: string[] = [];
      const productRefIDs: string[] = [];
      const branches: string[] = [];
      const spfRemarksPD: string[] = [];
      const commercialTypes: string[] = [];
      const tdsPdfUrls: string[] = [];
      const isExisting: string[] = [];

      const rowBase = `${spf_number}-${String(rowIdx + 1).padStart(3, "0")}`;
      const optionIndexToLetters = (idx: number) => {
        let n = idx;
        let s = "";
        while (n >= 0) {
          s = String.fromCharCode(65 + (n % 26)) + s;
          n = Math.floor(n / 26) - 1;
        }
        return s;
      };
      const hasMultipleOffers = rowProducts.length > 1;

      for (let optIdx = 0; optIdx < rowProducts.length; optIdx++) {
        const p = rowProducts[optIdx];

        const qty          = Number(p.qty || 0);
        const commercialType = (p?.commercialDetails?.commercialType || "BASIC").toUpperCase();
        const useArrayInput =
          commercialType === "LIGHT" && p?.commercialDetails?.useArrayInput === true;
        
        // Extract unit cost: for LIGHT Multiple, calculate from multiRows or use totalUnitCost; otherwise use direct unitCost
        let unitCost = 0;
        if (useArrayInput && Array.isArray(p?.commercialDetails?.multiRows) && p.commercialDetails.multiRows.length > 0) {
          // LIGHT (Multiple): sum all item unit costs from multiRows
          unitCost = p.commercialDetails.multiRows.reduce((sum: number, row: any) => sum + (Number(row?.unitCost || 0)), 0);
        } else if (useArrayInput && p?.commercialDetails?.totalUnitCost) {
          // Fallback to totalUnitCost if multiRows not available
          unitCost = Number(p.commercialDetails.totalUnitCost);
        } else {
          // LIGHT (Single), BASIC, or POLE: use direct unitCost
          unitCost = Number(p?.commercialDetails?.unitCost || 0);
        }
        
        const factory      = p?.commercialDetails?.factoryAddress    || "-";
        const port         = p?.commercialDetails?.portOfDischarge   || "-";
        const subtotal     = qty * unitCost;

        let pcsPerCarton = String(p?.commercialDetails?.pcsPerCarton ?? "-");
        let packagingStr = "- x - x -";

        if (
          commercialType === "LIGHT" &&
          useArrayInput &&
          Array.isArray(p?.commercialDetails?.multiRows) &&
          p.commercialDetails.multiRows.length > 0
        ) {
          pcsPerCarton = "-";
          packagingStr = p.commercialDetails.multiRows
            .map((r: Record<string, unknown>) => {
              const itemName = (r?.itemName ?? "").toString();
              const qtyPerCarton = Number(r?.qtyPerCarton ?? 0) || 0;
              const length = (r?.length ?? "-").toString();
              const width = (r?.width ?? "-").toString();
              const height = (r?.height ?? "-").toString();
              const rowUnitCost = Number(r?.unitCost ?? 0) || 0;
              return `${itemName}\nQty: ${qtyPerCarton}\n${length} × ${width} × ${height}\n${rowUnitCost} USD`;
            })
            .join("\n");
        } else {
          const packagingData = p?.commercialDetails?.packaging;
          let length = "-";
          let width = "-";
          let height = "-";

          if (typeof packagingData === "string") {
            const parts = packagingData
              .split(/(?:\s*x\s*|\s*×\s*)/i)
              .map((s) => s.trim())
              .filter(Boolean);
            length = parts[0] ?? "-";
            width = parts[1] ?? "-";
            height = parts[2] ?? "-";
          } else {
            length = packagingData?.length || "-";
            width = packagingData?.width || "-";
            height = packagingData?.height || "-";
          }

          packagingStr = `${length} x ${width} x ${height}`;
        }
        const warranty = p?.commercialDetails?.warranty || "-";

        // price_validity - preserve datetime-local format (YYYY-MM-DDTHH:mm)
        const rawPV = p?.__priceValidity || p?.price_validity;
        let priceValidity = "-";
        if (rawPV && rawPV !== "" && rawPV !== "-") {
          // If it's already in datetime-local format (YYYY-MM-DDTHH:mm), use it directly
          if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(rawPV)) {
            priceValidity = rawPV;
          } else {
            // Try to parse and convert to datetime-local format
            try {
              const parsed = new Date(rawPV);
              if (!isNaN(parsed.getTime())) {
                // Convert to YYYY-MM-DDTHH:mm format for datetime-local input
                const year = parsed.getFullYear();
                const month = String(parsed.getMonth() + 1).padStart(2, '0');
                const day = String(parsed.getDate()).padStart(2, '0');
                const hours = String(parsed.getHours()).padStart(2, '0');
                const minutes = String(parsed.getMinutes()).padStart(2, '0');
                priceValidity = `${year}-${month}-${day}T${hours}:${minutes}`;
              }
            } catch {
              priceValidity = "-";
            }
          }
        }

        images.push(p?.mainImage?.url || "-");
        qtys.push(String(qty));
        unitCosts.push(String(unitCost));
        pcsPerCartons.push(pcsPerCarton);
        packaging.push(packagingStr);
        warranties.push(warranty);
        
        // Determine commercial type label
        let commercialTypeLabel = "Basic";
        if (commercialType === "POLE") {
          commercialTypeLabel = "Pole";
        } else if (commercialType === "LIGHT") {
          if (useArrayInput && Array.isArray(p?.commercialDetails?.multiRows) && p.commercialDetails.multiRows.length > 0) {
            commercialTypeLabel = "Light (Multiple)";
          } else {
            commercialTypeLabel = "Light (Single)";
          }
        }
        commercialTypes.push(commercialTypeLabel);
        
        factories.push(factory);
        ports.push(port);
        subtotals.push(String(subtotal));
        supplierBrands.push(p?.supplier?.supplierBrand || p?.supplier?.supplierBrandName || "-");
        sellingCosts.push(p?.__sellingCost ?? "-");
        leadTimes.push(p?.__leadTime ?? "-");
        itemCodes.push(hasMultipleOffers ? `${rowBase}-${optionIndexToLetters(optIdx)}` : rowBase);
        priceValidities.push(priceValidity);
        const dimUrl = p?.dimensionalDrawing?.url;
        const illuUrl = p?.illuminanceDrawing?.url;
        dimensionalDrawings.push(dimUrl && dimUrl !== "-" ? dimUrl : "-");
        illuminanceDrawings.push(illuUrl && illuUrl !== "-" ? illuUrl : "-");
        tdsPdfUrls.push(p?.__tdsPdfUrl ?? "");

        const resolvedProductName = p?.__tdsProductName ?? p?.productName;
        productNames.push(resolvedProductName && String(resolvedProductName).trim() !== "" ? String(resolvedProductName) : "-");
        const resolvedBrand = p?.__tdsBrand;
        tdsBrands.push(resolvedBrand && String(resolvedBrand).trim() !== "" ? String(resolvedBrand) : "-");

        const supplierId = String(p?.supplier?.supplierId || "");
        const cached     = supplierId ? supplierCache.get(supplierId) : undefined;
        companyNames.push(cached?.company        || p?.supplier?.company || "-");
        contactNames.push(cached?.contactNames    || "-");
        contactNumbers.push(cached?.contactNumbers || "-");

        /* ── Tech specs ── */
        if (p?.technicalSpecifications?.length) {
          const groupedTech = p.technicalSpecifications
            .map((g: any) => {
              const title     = (g.title || "").trim();
              const specLines = (g.specs || [])
                .filter((s: any) => s.value && s.value.trim() !== "")
                .map((s: any) => `${s.specId}: ${s.value.trim()}`)
                .join(";;");
              if (!specLines) return null;
              return title ? `${title}~~${specLines}` : specLines;
            })
            .filter(Boolean)
            .join("@@");
          specs.push(groupedTech || "-");
        } else {
          specs.push("-");
        }

        /* ── Original tech specs ── */
        const origSpecs = p?.__originalTechnicalSpecifications || p?.technicalSpecifications;
        if (origSpecs?.length) {
          const groupedOrig = origSpecs
            .map((g: any) => {
              const title     = (g.title || "").trim();
              const specLines = (g.specs || [])
                .filter((s: any) => s.value && s.value.trim() !== "")
                .map((s: any) => `${s.specId}: ${s.value.trim()}`)
                .join(";;");
              if (!specLines) return null;
              return title ? `${title}~~${specLines}` : specLines;
            })
            .filter(Boolean)
            .join("@@");
          rowOriginalSpecs.push(groupedOrig || "-");
        } else {
          rowOriginalSpecs.push("-");
        }

        productRefIDs.push(p?.productReferenceID || p?.id || "-");

        /* ── Branch/Country selection ── */
        const availableCountries = p?.countries || [];
        const selectedBranch = p?.__selectedBranch || (availableCountries.length === 1 ? availableCountries[0] : "-");
        branches.push(selectedBranch);

        /* ── PD Remarks ── */
        spfRemarksPD.push(p?.__spfRemarksPD || "-");

        /* ── Is Existing (for tracking products from original SPF vs newly added) ── */
        isExisting.push(p?.__isExisting === true ? "true" : "false");
      }

      if (rowProducts.length === 0) {
        itemCodes.push("-");
        priceValidities.push("-");
        dimensionalDrawings.push("-");
        illuminanceDrawings.push("-");
        productNames.push("-");
        tdsBrands.push("-");
      }

      rowImages.push(images.join(ROW_SEP));
      rowQtys.push(qtys.join(ROW_SEP));
      rowSpecs.push(specs.join(ROW_SEP));
      rowUnitCosts.push(unitCosts.join(ROW_SEP));
      rowPcsPerCarton.push(pcsPerCartons.join(ROW_SEP));
      rowPackaging.push(packaging.join(ROW_SEP));
      rowWarranties.push(warranties.join(ROW_SEP));
      rowFactories.push(factories.join(ROW_SEP));
      rowPorts.push(ports.join(ROW_SEP));
      rowSubtotals.push(subtotals.join(ROW_SEP));
      rowSupplierBrands.push(supplierBrands.join(ROW_SEP));
      rowCompanyNames.push(companyNames.join(ROW_SEP));
      rowContactNames.push(contactNames.join(ROW_SEP));
      rowContactNumbers.push(contactNumbers.join(ROW_SEP));
      rowSellingCosts.push(sellingCosts.join(ROW_SEP));
      rowLeadTimes.push(leadTimes.join(ROW_SEP));
      rowItemCodes.push(itemCodes.join(ROW_SEP));
      rowPriceValidities.push(priceValidities.join(ROW_SEP));
      rowDimensionalDrawings.push(dimensionalDrawings.join(ROW_SEP));
      rowIlluminanceDrawings.push(illuminanceDrawings.join(ROW_SEP));
      rowProductNames.push(productNames.join(ROW_SEP));
      rowTdsBrands.push(tdsBrands.join(ROW_SEP));
      rowProductRefIDs.push(productRefIDs.join(ROW_SEP));
      rowBranches.push(branches.join(ROW_SEP));
      rowSpfRemarksPD.push(spfRemarksPD.join(ROW_SEP));
      rowCommercialTypes.push(commercialTypes.join(ROW_SEP));
      rowTdsPdfUrls.push(tdsPdfUrls.join(ROW_SEP));
      rowIsExisting.push(isExisting.join(ROW_SEP));
    }

    // Fill arrays for empty rows
    for (let i = rowOriginalSpecs.length; i < rowCount; i++) {
      rowOriginalSpecs.push("-");
      rowProductRefIDs.push("-");
    }

    for (let i = rowProductNames.length; i < rowCount; i++) {
      rowProductNames.push("-");
    }

    for (let i = rowTdsBrands.length; i < rowCount; i++) {
      rowTdsBrands.push("-");
    }

    /* ── Final strings ── */
    const finalImages          = rowImages.join(ROW_SEP);
    const finalQtys            = rowQtys.join(ROW_SEP);
    const finalSpecs           = rowSpecs.join(ROW_SEP);
    const finalUnitCosts       = rowUnitCosts.join(ROW_SEP);
    const finalPcsPerCarton    = rowPcsPerCarton.join(ROW_SEP);
    const finalPackaging       = rowPackaging.join(ROW_SEP);
    const finalWarranties      = rowWarranties.join(ROW_SEP);
    const finalFactories       = rowFactories.join(ROW_SEP);
    const finalPorts           = rowPorts.join(ROW_SEP);
    const finalSubtotals       = rowSubtotals.join(ROW_SEP);
    const finalSupplierBrands  = rowSupplierBrands.join(ROW_SEP);
    const finalCompanyNames    = rowCompanyNames.join(ROW_SEP);
    const finalContactNames    = rowContactNames.join(ROW_SEP);
    const finalContactNumbers  = rowContactNumbers.join(ROW_SEP);
    const finalSellingCosts    = rowSellingCosts.join(ROW_SEP);
    const finalLeadTimes       = rowLeadTimes.join(ROW_SEP);
    const finalPriceValidities = rowPriceValidities.join(ROW_SEP);
    const finalDimensionalDrawings = rowDimensionalDrawings.join(ROW_SEP);
    const finalIlluminanceDrawings = rowIlluminanceDrawings.join(ROW_SEP);
    const finalProductNames = rowProductNames.join(ROW_SEP);
    const finalTdsBrands = rowTdsBrands.join(ROW_SEP);
    const finalOriginalSpecs       = rowOriginalSpecs.join(ROW_SEP);
    const finalProductRefIDs       = rowProductRefIDs.join(ROW_SEP);
    const finalBranches            = rowBranches.join(ROW_SEP);
    const finalSpfRemarksPD        = rowSpfRemarksPD.join(ROW_SEP);
    const finalCommercialTypes     = rowCommercialTypes.join(ROW_SEP);
    const finalTdsPdfUrls          = rowTdsPdfUrls.join(ROW_BOUNDARY);
    const finalIsExisting          = rowIsExisting.join(ROW_SEP);
    const finalItemCode        = rowItemCodes.some((r) => r !== "-" && r !== "")
      ? rowItemCodes.join(ROW_SEP)
      : (item_code ?? null);

    const nowISO = getPhilippinesISOString();

    /* ── Upsert draft ── */
    const { error: upsertError } = await supabase
      .from("spf_creation_draft")
      .upsert({
        spf_number,
        referenceid: referenceIdValue,
        tsm: tsmValue,
        manager: managerValue,
        draft_author,
        item_code: finalItemCode,

        company_name: finalCompanyNames,
        supplier_brand: finalSupplierBrands,
        contact_name: finalContactNames,
        contact_number: finalContactNumbers,

        product_offer_image: finalImages,
        product_offer_qty: finalQtys,
        product_offer_technical_specification: finalSpecs,
        original_technical_specification: finalOriginalSpecs,
        product_reference_id: finalProductRefIDs,
        supplier_branch: finalBranches,
        spf_remarks_pd: finalSpfRemarksPD,
        commercial_type: finalCommercialTypes,
        product_offer_unit_cost: finalUnitCosts,
        product_offer_pcs_per_carton: finalPcsPerCarton,
        product_offer_packaging_details: finalPackaging,
        warranty: finalWarranties,
        product_offer_factory_address: finalFactories,
        product_offer_port_of_discharge: finalPorts,
        product_offer_subtotal: finalSubtotals,

        final_selling_cost: finalSellingCosts,
        proj_lead_time: finalLeadTimes,
        price_validity: finalPriceValidities,
        tds: finalTdsPdfUrls,
        dimensional_drawing: finalDimensionalDrawings,
        illuminance_drawing: finalIlluminanceDrawings,
        product_name: finalProductNames,
        tds_brand: finalTdsBrands,
        is_existing: finalIsExisting,

        // Additional fields for sync with spf_creation
        final_unit_cost: finalUnitCosts,
        final_subtotal: finalSubtotals,
        item_added_date: null,
        item_added_author: draft_author,
        revision_remarks: null,
        revision_type: null,
        spf_remarks_procurement: null,
        tds_pdf_urls: finalTdsPdfUrls,

        status: "Draft",
        is_edit_mode: is_edit_mode ?? false,
        original_spf_number: original_spf_number ?? null,

        spf_creation_start_time: spf_creation_start_time ?? null,
        spf_creation_end_time: null,

        date_created: nowISO,
        date_updated: nowISO,
      }, {
        onConflict: "spf_number",
      });

    if (upsertError) {
      console.error("Draft upsert error:", upsertError);
      return res.status(500).json({ message: "Failed to save draft", error: upsertError });
    }

    return res.status(200).json({ 
      success: true, 
      message: "Draft saved successfully",
      spf_number,
    });

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
