import type { NextApiRequest, NextApiResponse } from "next";
import { getPhilippinesISOString } from "@/lib/datetime";
import { supabase } from "@/utils/supabase";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const ROW_SEP = "|ROW|";

const encodeBase64Json = (value: any): string =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64");

type StoredCommercial = {
  commercialType: string;
  pcsPerCarton: string;
  packaging: string;
};

const buildStoredCommercial = (commercialDetails: any): StoredCommercial => {
  const commercialType = String(commercialDetails?.commercialType || "BASIC").toUpperCase();

  if (commercialType === "POLE") {
    return { commercialType, pcsPerCarton: "-", packaging: "-" };
  }

  if (commercialType === "LIGHT") {
    const useArrayInput = Boolean(commercialDetails?.useArrayInput);
    const multiRows = Array.isArray(commercialDetails?.multiRows)
      ? commercialDetails.multiRows
      : [];

    if (useArrayInput && multiRows.length) {
      const packagingLines: string[] = [];
      for (const row of multiRows) {
        const itemName = row?.itemName ?? "";
        const qtyPerCarton = Number(row?.qtyPerCarton ?? 0) || 0;
        const length = row?.length ?? "-";
        const width = row?.width ?? "-";
        const height = row?.height ?? "-";
        const unitCost = Number(row?.unitCost ?? 0) || 0;
        packagingLines.push(itemName);
        packagingLines.push(`Qty: ${qtyPerCarton}`);
        packagingLines.push(`${length} × ${width} × ${height}`);
        packagingLines.push(`${unitCost.toFixed(2)} USD`);
      }
      return {
        commercialType,
        pcsPerCarton: "-",
        packaging: packagingLines.join("\n"),
      };
    }
  }

  const packagingData = commercialDetails?.packaging;
  let packagingStr = "-";
  if (typeof packagingData === "string") {
    packagingStr = packagingData.trim() || "-";
  } else if (packagingData && typeof packagingData === "object") {
    const length = packagingData.length || "-";
    const width = packagingData.width || "-";
    const height = packagingData.height || "-";
    packagingStr = `${length} x ${width} x ${height}`;
  }

  const pcsPerCarton = String(commercialDetails?.pcsPerCarton ?? "-");
  return { commercialType, pcsPerCarton, packaging: packagingStr };
};

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
      referenceid,
      tsm,
      manager,
      item_code,
      totalItemRows,
      selectedProducts,
      spf_creation_start_time,
      spf_creation_end_time,
      userId,
    } = req.body;

    if (!spf_number) {
      return res.status(400).json({ message: "Missing SPF number" });
    }

    /* ── Resolve edited_by ── */
    let resolvedEditedBy: string | null = null;
    try {
      if (userId) {
        const { connectToDatabase } = await import("@/lib/mongodb");
        const { ObjectId } = await import("mongodb");
        const mongoDb = await connectToDatabase();
        const user = await mongoDb.collection("users").findOne(
          { _id: new ObjectId(userId) },
          { projection: { ReferenceID: 1 } }
        );
        resolvedEditedBy = user?.ReferenceID || null;
      }
    } catch (err) {
      console.error("Failed to resolve resolvedEditedBy:", err);
    }

    const products = Array.isArray(selectedProducts) ? selectedProducts : [];
    const rowCount = typeof totalItemRows === "number" ? totalItemRows : 1;

    /* ── Get current version number ── */
    const { data: historyRows } = await supabase
      .from("spf_creation_history")
      .select("version_number")
      .eq("spf_number", spf_number)
      .order("version_number", { ascending: false })
      .limit(1);

    const lastVersion =
      historyRows && historyRows.length > 0 ? historyRows[0].version_number : 0;
    const nextVersion = lastVersion + 1;

    /* ── Fetch current status ── */
    let currentStatus: string = "Pending For Procurement";
    let currentReferenceId: string | null = null;
    try {
      const { data: currentCreation } = await supabase
        .from("spf_creation")
        .select("status, referenceid")
        .eq("spf_number", spf_number)
        .maybeSingle();
      if (currentCreation?.status) {
        currentStatus = currentCreation.status;
      }
      if (currentCreation?.referenceid) {
        currentReferenceId = currentCreation.referenceid;
      }
    } catch (err) {
      console.error("Failed to fetch current status:", err);
    }

    // Preserve existing referenceid during edit - never change it
    const effectiveReferenceId = currentReferenceId ?? null;

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
    const rowProductNames:       string[] = [];
    const rowOriginalSpecs:      string[] = [];
    const rowProductRefIDs:      string[] = [];
    const rowBranches:          string[] = [];
    const rowSpfRemarksPD:      string[] = [];
    const rowCommercialTypes:   string[] = [];

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
      const productRefIDs: string[] = [];
      const branches: string[] = [];
      const spfRemarksPD: string[] = [];
      const commercialTypes: string[] = [];

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
        const unitCost     = Number(p?.commercialDetails?.unitCost || 0);
        const factory      = p?.commercialDetails?.factoryAddress    || "-";
        const port         = p?.commercialDetails?.portOfDischarge   || "-";
        const subtotal     = qty * unitCost;
        const warranty = p?.commercialDetails?.warranty || "-";
        const storedCommercial = buildStoredCommercial(p?.commercialDetails);

        // price_validity: store as-is (text column, delimited string)
        const rawPV = p?.price_validity;
        let priceValidity = "-";
        if (rawPV && rawPV !== "" && rawPV !== "-") {
          try {
            const parsed = new Date(rawPV);
            priceValidity = isNaN(parsed.getTime()) ? "-" : parsed.toISOString();
          } catch {
            priceValidity = "-";
          }
        }

        images.push(p?.mainImage?.url || "-");
        qtys.push(String(qty));
        unitCosts.push(String(unitCost));
        pcsPerCartons.push(storedCommercial.pcsPerCarton);
        packaging.push(storedCommercial.packaging);
        warranties.push(warranty);
        commercialTypes.push(storedCommercial.commercialType);
        factories.push(factory);
        ports.push(port);
        subtotals.push(String(subtotal));
        supplierBrands.push(p?.supplier?.supplierBrand || p?.supplier?.supplierBrandName || "-");
        priceValidities.push(priceValidity);

        /* ── Carry __sellingCost/__leadTime from existing products ── */
        sellingCosts.push(p?.__sellingCost ?? "-");
        leadTimes.push(p?.__leadTime      ?? "-");

        itemCodes.push(hasMultipleOffers ? `${rowBase}-${optionIndexToLetters(optIdx)}` : rowBase);
        dimensionalDrawings.push(p?.dimensionalDrawing?.url || "-");
        illuminanceDrawings.push(p?.illuminanceDrawing?.url || "-");

        const resolvedProductName = p?.__tdsProductName ?? p?.productName;
        productNames.push(
          resolvedProductName && String(resolvedProductName).trim() !== ""
            ? String(resolvedProductName)
            : "-"
        );

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

        /* ── Original tech specs (for editing later) ── */
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

        /* ── Product Reference ID for syncing ── */
        productRefIDs.push(p?.productReferenceID || p?.id || "-");

        /* ── Branch/Country selection ── */
        const availableCountries = p?.countries || [];
        const selectedBranch = p?.__selectedBranch || (availableCountries.length === 1 ? availableCountries[0] : "-");
        branches.push(selectedBranch);

        /* ── PD Remarks ── */
        spfRemarksPD.push(p?.__spfRemarksPD || "-");
      }

      rowImages.push(images.join(","));
      rowQtys.push(qtys.join(","));
      rowSpecs.push(specs.join(" || "));
      rowUnitCosts.push(unitCosts.join(","));
      rowPcsPerCarton.push(pcsPerCartons.join(","));
      rowPackaging.push(packaging.join(","));
      rowWarranties.push(warranties.join(","));
      rowFactories.push(factories.join(","));
      rowPorts.push(ports.join(","));
      rowSubtotals.push(subtotals.join(","));
      rowSupplierBrands.push(supplierBrands.join(","));
      rowCompanyNames.push(companyNames.join(","));
      rowContactNames.push(contactNames.join(","));
      rowContactNumbers.push(contactNumbers.join(","));
      rowSellingCosts.push(sellingCosts.join(","));
      rowLeadTimes.push(leadTimes.join(","));
      rowItemCodes.push(itemCodes.join(","));
      rowPriceValidities.push(priceValidities.join(","));
      rowDimensionalDrawings.push(dimensionalDrawings.join(","));
      rowIlluminanceDrawings.push(illuminanceDrawings.join(","));
      rowProductNames.push(productNames.join(","));
      rowProductRefIDs.push(productRefIDs.join(","));
      rowBranches.push(branches.join(","));
      rowSpfRemarksPD.push(spfRemarksPD.join(","));
      rowCommercialTypes.push(commercialTypes.join(","));
    }

    // Fill arrays for empty rows
    for (let i = rowOriginalSpecs.length; i < rowCount; i++) {
      rowOriginalSpecs.push("-");
      rowProductRefIDs.push("-");
    }

    for (let i = rowProductNames.length; i < rowCount; i++) {
      rowProductNames.push("-");
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
    const finalProductNames        = rowProductNames.join(ROW_SEP);
    const finalOriginalSpecs       = rowOriginalSpecs.join(ROW_SEP);
    const finalProductRefIDs       = rowProductRefIDs.join(ROW_SEP);
    const finalBranches            = rowBranches.join(ROW_SEP);
    const finalSpfRemarksPD        = rowSpfRemarksPD.join(ROW_SEP);
    const finalCommercialTypes     = rowCommercialTypes.join(ROW_SEP);
    const rowTdsPdfUrls: string[] = [];
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const rowProducts = rowMap[rowIdx] || [];
      rowTdsPdfUrls.push(rowProducts.map((p: any) => p.__tdsPdfUrl ?? "").join(","));
    }
    const finalTds = rowTdsPdfUrls.join(ROW_SEP);
    const finalItemCode        = rowItemCodes.some((r) => r !== "" && r.length > 0)
      ? rowItemCodes.join(ROW_SEP)
      : (item_code ?? null);

    const nowISO = getPhilippinesISOString();

    /* ── INSERT version history snapshot ── */
    await supabase.from("spf_creation_history").insert({
      spf_number,
      version_number: nextVersion,
      version_label:  `${spf_number}_v${nextVersion}`,
      created_at:     nowISO,
      edited_by:      resolvedEditedBy,
      item_added_author: resolvedEditedBy,
      date_updated:   nowISO,

      status: currentStatus,

      supplier_brand:                        finalSupplierBrands,
      product_offer_image:                   finalImages,
      product_offer_qty:                     finalQtys,
      product_offer_technical_specification: finalSpecs,
      original_technical_specification:        finalOriginalSpecs,
      product_reference_id:                    finalProductRefIDs,
      supplier_branch:                         finalBranches,
      commercial_type:                         finalCommercialTypes,
      product_name:                            finalProductNames,
      product_offer_unit_cost:               finalUnitCosts,
      product_offer_pcs_per_carton:          finalPcsPerCarton,
      product_offer_packaging_details:       finalPackaging,
      warranty:                              finalWarranties,
      product_offer_factory_address:         finalFactories,
      product_offer_port_of_discharge:       finalPorts,
      product_offer_subtotal:                finalSubtotals,
      spf_remarks_pd:                          finalSpfRemarksPD,
      company_name:   finalCompanyNames,
      contact_name:   finalContactNames,
      contact_number: finalContactNumbers,
      final_selling_cost: finalSellingCosts,
      proj_lead_time:     finalLeadTimes,
      price_validity:     finalPriceValidities,
      tds: finalTds,
      dimensional_drawing: finalDimensionalDrawings,
      illuminance_drawing: finalIlluminanceDrawings,

      spf_creation_start_time: spf_creation_start_time ?? null,
      spf_creation_end_time:   spf_creation_end_time   ?? null,

      referenceid: effectiveReferenceId,
      tsm:         tsm         ?? null,
      manager:     manager     ?? null,
      item_code:   finalItemCode || item_code || null,
    });

    /* ── UPDATE main spf_creation table ── */
    await supabase
      .from("spf_creation")
      .update({
        referenceid: effectiveReferenceId,
        tsm:         tsm         ?? null,
        manager:     manager     ?? null,

        company_name:                           finalCompanyNames,
        supplier_brand:                         finalSupplierBrands,
        product_offer_image:                    finalImages,
        product_offer_qty:                      finalQtys,
        product_offer_technical_specification:  finalSpecs,
        original_technical_specification:       finalOriginalSpecs,
        product_reference_id:                   finalProductRefIDs,
        supplier_branch:                        finalBranches,
        commercial_type:                        finalCommercialTypes,
        product_name:                           finalProductNames,
        product_offer_unit_cost:                finalUnitCosts,
        product_offer_pcs_per_carton:           finalPcsPerCarton,
        product_offer_packaging_details:        finalPackaging,
        warranty:                               finalWarranties,
        product_offer_factory_address:          finalFactories,
        product_offer_port_of_discharge:        finalPorts,
        product_offer_subtotal:                 finalSubtotals,

        item_code: finalItemCode || item_code || null,

        spf_remarks_pd: finalSpfRemarksPD,
        contact_name:   finalContactNames,
        contact_number: finalContactNumbers,
        final_selling_cost: finalSellingCosts,
        proj_lead_time:     finalLeadTimes,
        price_validity:     finalPriceValidities,
        dimensional_drawing: finalDimensionalDrawings,
        illuminance_drawing: finalIlluminanceDrawings,
        tds: finalTds,

        status: "Pending For Procurement",

        spf_creation_start_time: spf_creation_start_time ?? null,
        spf_creation_end_time:   spf_creation_end_time   ?? null,
        date_updated: nowISO,
      })
      .eq("spf_number", spf_number);

    /* ── UPDATE parent spf_request date_updated ── */
    await supabase
      .from("spf_request")
      .update({ date_updated: nowISO })
      .eq("spf_number", spf_number);

    /* ── Audit log ── */
    try {
      const { logSPFVersionEvent } = await import("@/lib/auditlogger");
      await logSPFVersionEvent({
        whatHappened:   "SPF Version Created",
        spf_number,
        version_label:  `${spf_number}_v${nextVersion}`,
        version_number: nextVersion,
        referenceID:    effectiveReferenceId ?? undefined,
        userId:         userId           ?? undefined,
      });
    } catch (auditErr) {
      console.error("Audit log error:", auditErr);
    }

    /* ── Delete draft from spf_creation_draft ── */
    try {
      const { error: deleteDraftError } = await supabase
        .from("spf_creation_draft")
        .delete()
        .eq("spf_number", spf_number);
      
      if (deleteDraftError) {
        console.error("Draft deletion error:", deleteDraftError);
      }
    } catch (deleteErr) {
      console.error("Draft deletion error:", deleteErr);
    }

    return res.status(200).json({
      success:       true,
      version_label: `${spf_number}_v${nextVersion}`,
    });

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
}
