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

    /* ── Resolve item_added_author ── */
    let item_added_author: string | null = null;
    try {
      if (userId) {
        const { connectToDatabase } = await import("@/lib/mongodb");
        const { ObjectId } = await import("mongodb");
        const mongoDb = await connectToDatabase();
        const user = await mongoDb.collection("users").findOne(
          { _id: new ObjectId(userId) },
          { projection: { ReferenceID: 1 } }
        );
        item_added_author = user?.ReferenceID || null;
      }
    } catch (err) {
      console.error("Failed to resolve item_added_author:", err);
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
        sellingCosts.push("-");
        leadTimes.push("-");
        itemCodes.push(hasMultipleOffers ? `${rowBase}-${optionIndexToLetters(optIdx)}` : rowBase);
        priceValidities.push(priceValidity);
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

      if (rowProducts.length === 0) {
        itemCodes.push("-");
        priceValidities.push("-");
        dimensionalDrawings.push("-");
        illuminanceDrawings.push("-");
        productNames.push("-");
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
    const finalItemCode        = rowItemCodes.some((r) => r !== "-" && r !== "")
      ? rowItemCodes.join(ROW_SEP)
      : (item_code ?? null);

    const initialStatus = "Pending For Procurement";
    // ── TDS PDF URLs per product per row ──
    const rowTdsPdfUrls: string[] = [];
    for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
      const rowProducts = rowMap[rowIdx] || [];
      rowTdsPdfUrls.push(rowProducts.map((p: any) => p.__tdsPdfUrl ?? "").join(","));
    }
    const finalTds = rowTdsPdfUrls.join(ROW_SEP);

    /* ── Check existing SPF ── */
    const { data: existing, error: checkError } = await supabase
      .from("spf_creation")
      .select("id, spf_creation_start_time, spf_creation_end_time")
      .eq("spf_number", spf_number)
      .maybeSingle();

    if (checkError) {
      console.error(checkError);
      return res.status(500).json(checkError);
    }

    /* ── INSERT ── */
    if (!existing) {
      const { error: insertError } = await supabase
        .from("spf_creation")
        .insert({
          spf_number,
          referenceid:      referenceIdValue,
          tsm:              tsmValue,
          manager:          managerValue,
          item_added_author,
          item_code:        finalItemCode,

          company_name:   finalCompanyNames,
          supplier_brand: finalSupplierBrands,
          contact_name:   finalContactNames,
          contact_number: finalContactNumbers,

          product_offer_image:                   finalImages,
          product_offer_qty:                     finalQtys,
          product_offer_technical_specification: finalSpecs,
          original_technical_specification:        finalOriginalSpecs,
          product_reference_id:                    finalProductRefIDs,
          supplier_branch:                         finalBranches,
          spf_remarks_pd:                          finalSpfRemarksPD,
          commercial_type:                       finalCommercialTypes,
          product_name:                          finalProductNames,
          product_offer_unit_cost:               finalUnitCosts,
          product_offer_pcs_per_carton:          finalPcsPerCarton,
          product_offer_packaging_details:       finalPackaging,
          warranty:                              finalWarranties,
          product_offer_factory_address:         finalFactories,
          product_offer_port_of_discharge:       finalPorts,
          product_offer_subtotal:                finalSubtotals,

          final_selling_cost: finalSellingCosts,
          proj_lead_time:     finalLeadTimes,
          price_validity:     finalPriceValidities,
          tds: finalTds,
          dimensional_drawing: finalDimensionalDrawings,
          illuminance_drawing: finalIlluminanceDrawings,

          status: initialStatus,

          spf_creation_start_time: spf_creation_start_time ?? null,
          spf_creation_end_time:   spf_creation_end_time   ?? null,

          date_created: getPhilippinesISOString(),
          date_updated: getPhilippinesISOString(),
        });

      if (insertError) {
        console.error(insertError);
        return res.status(500).json(insertError);
      }

      const nowISO = getPhilippinesISOString();

      /* ── Version history v1 ── */
      const { error: historyError } = await supabase
        .from("spf_creation_history")
        .insert({
          spf_number,
          version_number: 1,
          version_label:  `${spf_number}_v1`,
          created_at:     nowISO,
          edited_by:      null,
          item_added_author,
          date_updated:   nowISO,

          status: initialStatus,

          supplier_brand:                        finalSupplierBrands,
          product_offer_image:                   finalImages,
          product_offer_qty:                     finalQtys,
          product_offer_technical_specification: finalSpecs,
          original_technical_specification:        finalOriginalSpecs,
          product_reference_id:                    finalProductRefIDs,
          supplier_branch:                         finalBranches,
          spf_remarks_pd:                          finalSpfRemarksPD,
          commercial_type:                         finalCommercialTypes,
          product_name:                            finalProductNames,
          product_offer_unit_cost:               finalUnitCosts,
          product_offer_pcs_per_carton:          finalPcsPerCarton,
          product_offer_packaging_details:       finalPackaging,
          warranty:                              finalWarranties,
          product_offer_factory_address:         finalFactories,
          product_offer_port_of_discharge:       finalPorts,
          product_offer_subtotal:                finalSubtotals,

          company_name:   finalCompanyNames,
          contact_name:   finalContactNames,
          contact_number: finalContactNumbers,

          proj_lead_time:     finalLeadTimes,
          final_selling_cost: finalSellingCosts,
          price_validity:     finalPriceValidities,
          tds: finalTds,
          dimensional_drawing: finalDimensionalDrawings,
          illuminance_drawing: finalIlluminanceDrawings,

          item_code: finalItemCode,

          spf_creation_start_time: spf_creation_start_time ?? null,
          spf_creation_end_time:   spf_creation_end_time   ?? null,

          referenceid: referenceIdValue,
          tsm:         tsmValue,
          manager:     managerValue,
        });

      if (historyError) {
        console.error("History insert error:", historyError);
      }

      /* ── UPDATE parent spf_request date_updated ── */
      await supabase
        .from("spf_request")
        .update({ date_updated: nowISO })
        .eq("spf_number", spf_number);
    } else {
      const updateISO = getPhilippinesISOString();
      await supabase
        .from("spf_creation")
        .update({
          spf_creation_start_time: spf_creation_start_time ?? existing?.spf_creation_start_time ?? null,
          spf_creation_end_time:   spf_creation_end_time   ?? existing?.spf_creation_end_time   ?? null,
          date_updated: updateISO,
          original_technical_specification: finalOriginalSpecs,
          product_reference_id: finalProductRefIDs,
          warranty: finalWarranties,
          product_name: finalProductNames,
        })
        .eq("spf_number", spf_number);

      /* ── UPDATE parent spf_request date_updated ── */
      await supabase
        .from("spf_request")
        .update({ date_updated: updateISO })
        .eq("spf_number", spf_number);
    }

    /* ── Audit log ── */
    try {
      const { logSPFVersionEvent } = await import("@/lib/auditlogger");
      await logSPFVersionEvent({
        whatHappened:   "SPF Created",
        spf_number,
        version_label:  `${spf_number}_v1`,
        version_number: 1,
        referenceID:    item_added_author ?? undefined,
        userId:         userId            ?? undefined,
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

    return res.status(200).json({ success: true, message: "SPF created successfully" });

  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
}
