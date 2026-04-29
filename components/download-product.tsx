"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Download } from "lucide-react";
import ExcelJS from "exceljs";
import saveAs from "file-saver";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Props = {
  products: any[];
  iconOnly?: boolean;
};

export default function DownloadProduct({ products, iconOnly = false }: Props) {
  const [open, setOpen] = React.useState(false);

  const convertDriveToThumbnail = (url?: string) => {
    if (!url) return "";
    if (!url.includes("drive.google.com")) return url;
    let fileId = "";
    const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match1?.[1]) fileId = match1[1];
    if (match2?.[1]) fileId = match2[1];
    if (fileId) return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    return url;
  };

  const GROUP_COLORS = ["BDD7EE", "FFE699"];

  const handleDownload = async () => {
    const wb = new ExcelJS.Workbook();

    const sheetMap = new Map<string, any[]>();
    products.forEach((p) => {
      const familyName = p.productFamilies?.[0]?.productFamilyName || "Others";
      if (!sheetMap.has(familyName)) sheetMap.set(familyName, []);
      sheetMap.get(familyName)!.push(p);
    });

    for (const [sheetName, sheetProducts] of sheetMap) {
      const ws = wb.addWorksheet(sheetName);

      const categoryTypeId = sheetProducts[0]?.categoryTypes?.[0]?.productUsageId || null;
      const productFamilyId = sheetProducts[0]?.productFamilies?.[0]?.productFamilyId || null;

      let templateSnap: any = { forEach: () => {} };
      if (categoryTypeId && productFamilyId) {
        templateSnap = await getDocs(
          query(
            collection(db, "technicalSpecifications"),
            where("categoryTypeId", "==", categoryTypeId),
            where("productFamilyId", "==", productFamilyId),
            where("isActive", "==", true),
          ),
        );
      }

      const groupMap = new Map<string, string[]>();
      templateSnap.forEach((doc: any) => {
        const data = doc.data();
        groupMap.set(data.title, data.specs.map((s: any) => s.specId));
      });

      /* ─────────────────────────────────────────────────────────────────
       * Column layout:
       *  Cols 1-7       : static product fields
       *  Cols 8+        : technical spec columns (grouped)
       *  Next 7         : COMMERCIAL DETAILS — BASIC (Unit Cost … Port of Discharge)
       *  Next 2         : Dimensional Drawing, Illuminance Level
       *  Next 1         : Available Countries
       *  Next 1         : MOQ
       *  Next 2         : Warranty Number, Warranty Period
       *  Next 1         : Commercial Type
       *  Next 3         : POLE — Qty Per Container, Landed Cost, SRP
       *  Next 7         : LIGHT (SINGLE DIMENSION) — Unit Cost, L, W, H, Qty/Box, Landed, SRP
       *  Next 10        : LIGHT (MULTIPLE DIMENSION) — Item Names|…, Unit Cost|…, L|…, W|…, H|…, Qty/Box|…, Landed|…, SRP|…, Total Landed, Total SRP [last 2 = DOWNLOAD ONLY]
       * ───────────────────────────────────────────────────────────────── */
      const staticColumns = [
        "Product Usage",
        "Product Family",
        "Product Class",
        "Price Point",
        "Brand Origin",
        "Supplier Brand",
        "Image URL",
      ];

      const header1: any[] = [];
      const header2: any[] = [];
      const header3: any[] = [];

      // Static cols 1-7
      staticColumns.forEach((col) => {
        header1.push(col);
        header2.push("");
        header3.push("");
      });

      // Technical spec cols
      groupMap.forEach((specIds, groupTitle) => {
        specIds.forEach((specId) => {
          header1.push(specId);
          header2.push(groupTitle);
          header3.push("");
        });
      });

      // ── COMMERCIAL DETAILS (BASIC) ──
      header1.push("Unit Cost", "Length", "Width", "Height", "pcs/carton", "Factory Address", "Port of Discharge");
      header2.push("COMMERCIAL DETAILS", "", "", "", "", "", "");
      header3.push("", "Packaging Details (cm)", "", "", "", "", "");

      // ── Drawings ──
      header1.push("Dimensional Drawing", "Illuminance Level");
      header2.push("DRAWINGS", "");
      header3.push("", "");

      // ── Available Countries ──
      header1.push("Available Countries");
      header2.push("");
      header3.push("");

      // ── MOQ ──
      header1.push("MOQ");
      header2.push("");
      header3.push("");

      // ── Warranty ──
      header1.push("Warranty Number", "Warranty Period");
      header2.push("WARRANTY", "");
      header3.push("", "");

      // ── Commercial Type ──
      header1.push("Commercial Type");
      header2.push("");
      header3.push("");

      // ── POLE ──
      header1.push("POLE - Qty Per Container", "POLE - Landed Cost", "POLE - SRP");
      header2.push("POLE", "", "");
      header3.push("", "", "");

      // ── LIGHT (SINGLE DIMENSION) ──
      header1.push(
        "LIGHT (Single) - Unit Cost",
        "LIGHT (Single) - Length",
        "LIGHT (Single) - Width",
        "LIGHT (Single) - Height",
        "LIGHT (Single) - Qty/Box",
        "LIGHT (Single) - Landed Cost",
        "LIGHT (Single) - SRP",
      );
      header2.push("LIGHT (SINGLE DIMENSION)", "", "", "", "", "", "");
      header3.push("", "", "", "", "", "", "");

      // ── LIGHT (MULTIPLE DIMENSION) — 8 fixed pipe-delimited columns ──
      header1.push(
        "LIGHT (Multiple) - Item Names",
        "LIGHT (Multiple) - Unit Costs",
        "LIGHT (Multiple) - Lengths",
        "LIGHT (Multiple) - Widths",
        "LIGHT (Multiple) - Heights",
        "LIGHT (Multiple) - Qty/Boxes",
        "LIGHT (Multiple) - Landed Costs",
        "LIGHT (Multiple) - SRPs",
      );
      header2.push("LIGHT (MULTIPLE DIMENSION)", "", "", "", "", "", "", "");
      header3.push("", "", "", "", "", "", "", "");

      // ── LIGHT (MULTIPLE) TOTALS — download only (part of LIGHT MULTIPLE group) ──
      header1.push("LIGHT (Multiple) - Total Landed Cost", "LIGHT (Multiple) - Total SRP");
      header2.push("LIGHT (MULTIPLE DIMENSION)", "LIGHT (MULTIPLE DIMENSION)");
      header3.push("", "");

      ws.addRow(header1);
      ws.addRow(header2);
      ws.addRow(header3);

      // ── Merge group headers for technical specs ──
      let colStart = staticColumns.length + 1;
      let groupIndex = 0;
      groupMap.forEach((specIds) => {
        const colEnd = colStart + specIds.length - 1;
        if (colEnd > colStart) ws.mergeCells(2, colStart, 2, colEnd);
        const color = GROUP_COLORS[groupIndex % GROUP_COLORS.length];
        for (let col = colStart; col <= colEnd; col++) {
          const h1 = ws.getRow(1).getCell(col);
          const h2 = ws.getRow(2).getCell(col);
          h1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
          h1.font = { bold: true };
          h1.alignment = { vertical: "middle", horizontal: "center" };
          h2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
          h2.font = { bold: true, italic: true };
          h2.alignment = { vertical: "middle", horizontal: "center" };
        }
        groupIndex++;
        colStart = colEnd + 1;
      });

      // colStart now points to COMMERCIAL DETAILS
      const cdStart = colStart;
      const cdEnd = cdStart + 6;

      // ── Merge COMMERCIAL DETAILS header ──
      ws.mergeCells(2, cdStart, 2, cdEnd);
      ws.mergeCells(3, cdStart + 1, 3, cdStart + 3);

      // ── Drawings ──
      const drawStart = cdEnd + 1;
      const drawEnd = drawStart + 1;
      ws.mergeCells(2, drawStart, 2, drawEnd);

      // ── Available Countries ──
      const countriesCol = drawEnd + 1;

      // ── MOQ ──
      const moqCol = countriesCol + 1;

      // ── Warranty ──
      const warrantyStart = moqCol + 1;
      const warrantyEnd = warrantyStart + 1;
      ws.mergeCells(2, warrantyStart, 2, warrantyEnd);

      // ── Commercial Type ──
      const commercialTypeCol = warrantyEnd + 1;

      // ── POLE ──
      const poleStart = commercialTypeCol + 1;
      const poleEnd = poleStart + 2;
      ws.mergeCells(2, poleStart, 2, poleEnd);

      // ── LIGHT (SINGLE) ──
      const lightSingleStart = poleEnd + 1;
      const lightSingleEnd = lightSingleStart + 6;
      ws.mergeCells(2, lightSingleStart, 2, lightSingleEnd);

      // ── LIGHT (MULTIPLE) — 8 pipe-delimited columns + 2 total columns ──
      const lightMultiStart = lightSingleEnd + 1;
      const lightMultiEnd = lightMultiStart + 9; // 8 data cols + 2 total cols = 10 cols total
      ws.mergeCells(2, lightMultiStart, 2, lightMultiEnd);

      // ── Style helpers ──
      const applyHeaderStyle = (row: ExcelJS.Row, col: number, bgColor: string, white = false, italic = false) => {
        const cell = row.getCell(col);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgColor } };
        cell.font = { bold: true, color: { argb: white ? "FFFFFF" : "000000" }, italic };
        cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      };

      // Static cols (blue)
      for (let col = 1; col <= staticColumns.length; col++) {
        applyHeaderStyle(ws.getRow(1), col, "4472C4", true);
      }

      // COMMERCIAL DETAILS (purple)
      for (let col = cdStart; col <= cdEnd; col++) {
        applyHeaderStyle(ws.getRow(1), col, "D9D2E9");
        applyHeaderStyle(ws.getRow(2), col, "D9D2E9", false, true);
        applyHeaderStyle(ws.getRow(3), col, "D9D2E9", false, true);
      }

      // Drawings (green)
      for (let col = drawStart; col <= drawEnd; col++) {
        applyHeaderStyle(ws.getRow(1), col, "E2EFDA");
        applyHeaderStyle(ws.getRow(2), col, "E2EFDA", false, true);
        applyHeaderStyle(ws.getRow(3), col, "E2EFDA");
      }

      // Available Countries (orange)
      applyHeaderStyle(ws.getRow(1), countriesCol, "FCE4D6");
      applyHeaderStyle(ws.getRow(2), countriesCol, "FCE4D6");
      applyHeaderStyle(ws.getRow(3), countriesCol, "FCE4D6");

      // MOQ (yellow)
      applyHeaderStyle(ws.getRow(1), moqCol, "FFF2CC");
      applyHeaderStyle(ws.getRow(2), moqCol, "FFF2CC");
      applyHeaderStyle(ws.getRow(3), moqCol, "FFF2CC");

      // Warranty (light teal)
      for (let col = warrantyStart; col <= warrantyEnd; col++) {
        applyHeaderStyle(ws.getRow(1), col, "DDEBF7");
        applyHeaderStyle(ws.getRow(2), col, "DDEBF7", false, true);
        applyHeaderStyle(ws.getRow(3), col, "DDEBF7");
      }

      // Commercial Type (gray)
      applyHeaderStyle(ws.getRow(1), commercialTypeCol, "EDEDED");
      applyHeaderStyle(ws.getRow(2), commercialTypeCol, "EDEDED");
      applyHeaderStyle(ws.getRow(3), commercialTypeCol, "EDEDED");

      // POLE (red-ish)
      for (let col = poleStart; col <= poleEnd; col++) {
        applyHeaderStyle(ws.getRow(1), col, "FCE4D6");
        applyHeaderStyle(ws.getRow(2), col, "FCE4D6", false, true);
        applyHeaderStyle(ws.getRow(3), col, "FCE4D6");
      }

      // LIGHT Single (light blue)
      for (let col = lightSingleStart; col <= lightSingleEnd; col++) {
        applyHeaderStyle(ws.getRow(1), col, "DEEAF1");
        applyHeaderStyle(ws.getRow(2), col, "DEEAF1", false, true);
        applyHeaderStyle(ws.getRow(3), col, "DEEAF1");
      }

      // LIGHT Multiple (light green) — includes 8 data cols + 2 total cols
      for (let col = lightMultiStart; col <= lightMultiEnd; col++) {
        applyHeaderStyle(ws.getRow(1), col, "E2EFDA");
        applyHeaderStyle(ws.getRow(2), col, "E2EFDA", false, true);
        applyHeaderStyle(ws.getRow(3), col, "E2EFDA");
      }

      // LIGHT Multiple Totals (darker green for emphasis) — last 2 cols only
      const lightMultiTotalsStart = lightMultiEnd - 1;
      for (let col = lightMultiTotalsStart; col <= lightMultiEnd; col++) {
        applyHeaderStyle(ws.getRow(1), col, "C6E0B4");
        applyHeaderStyle(ws.getRow(2), col, "C6E0B4", false, true);
        applyHeaderStyle(ws.getRow(3), col, "C6E0B4");
      }

      // ── Data rows ──
      sheetProducts.forEach((product) => {
        const row: any[] = [];
        const cd = product.commercialDetails || {};

        // Static cols 1-7
        row.push(product.categoryTypes?.[0]?.categoryTypeName || "");
        row.push(product.productFamilies?.[0]?.productFamilyName || "");
        row.push(product.productClass || "");
        row.push(product.pricePoint || "");
        row.push(product.brandOrigin || "CHINA");
        row.push(product.supplier?.supplierBrand || "ECONOMY");
        row.push(convertDriveToThumbnail(product.mainImage?.url || ""));

        // Technical spec cols
        groupMap.forEach((specIds, groupTitle) => {
          const groupData = product.technicalSpecifications?.find(
            (g: any) => g.title === groupTitle,
          );
          specIds.forEach((specId) => {
            const spec = groupData?.specs?.find((s: any) => s.specId === specId);
            row.push(spec?.value || "");
          });
        });

        // COMMERCIAL DETAILS (BASIC)
        row.push(cd.unitCost || "");
        row.push(cd.packaging?.length || "");
        row.push(cd.packaging?.width || "");
        row.push(cd.packaging?.height || "");
        row.push(cd.pcsPerCarton || "");
        row.push(cd.factoryAddress || "");
        row.push(cd.portOfDischarge || "");

        // Drawings
        row.push(convertDriveToThumbnail(product.dimensionalDrawing?.url || ""));
        row.push(convertDriveToThumbnail(product.illuminanceDrawing?.url || ""));

        // Available Countries
        row.push((product.countries || []).join(" | "));

        // MOQ
        row.push(cd.moq || "");

        // Warranty
        const warrantyStr = cd.warranty || "";
        const warrantyParts = warrantyStr.split(" ");
        row.push(warrantyParts[0] || "");
        row.push(warrantyParts.slice(1).join(" ") || "");

        // Commercial Type
        row.push(cd.commercialType || "BASIC");

        // POLE
        if (cd.commercialType === "POLE") {
          row.push(cd.qtyPerContainer || "");
          // Compute landed & SRP
          const uc = parseFloat(cd.unitCost) || 0;
          const qty = parseInt(cd.qtyPerContainer) || 0;
          const landed = qty > 0 ? (uc * 65 + 520000 / qty) * 1.01 : 0;
          const srp = landed ? Math.ceil(landed / 0.45 / 100) * 100 : 0;
          row.push(landed ? landed.toFixed(2) : "");
          row.push(srp || "");
        } else {
          row.push("", "", "");
        }

        // LIGHT (SINGLE DIMENSION)
        if (cd.commercialType === "LIGHT" && !cd.useArrayInput) {
          row.push(cd.unitCost || "");
          row.push(cd.packaging?.length || "");
          row.push(cd.packaging?.width || "");
          row.push(cd.packaging?.height || "");
          row.push(cd.pcsPerCarton || "");
          // landedCost & srp stored in db
          row.push(cd.landedCost ? cd.landedCost.toFixed(2) : "");
          row.push(cd.srp || "");
        } else {
          row.push("", "", "", "", "", "", "");
        }

        // LIGHT (MULTIPLE DIMENSION) — 8 pipe-delimited columns
        const multiRows: any[] = (cd.commercialType === "LIGHT" && cd.useArrayInput && Array.isArray(cd.multiRows))
          ? cd.multiRows
          : [];

        const joinField = (fn: (r: any) => any) =>
          multiRows.length ? multiRows.map(fn).join(" | ") : "";

        row.push(joinField((r) => r.itemName || ""));
        row.push(joinField((r) => r.unitCost ?? ""));
        row.push(joinField((r) => r.length ?? ""));
        row.push(joinField((r) => r.width ?? ""));
        row.push(joinField((r) => r.height ?? ""));
        row.push(joinField((r) => r.qtyPerCarton ?? ""));
        row.push(joinField((r) => r.landed ? r.landed.toFixed(2) : ""));
        row.push(joinField((r) => r.srp ?? ""));

        // LIGHT (MULTIPLE) TOTALS — download only
        if (cd.commercialType === "LIGHT" && cd.useArrayInput && Array.isArray(cd.multiRows) && cd.multiRows.length > 0) {
          const totalLanded = cd.multiRows.reduce((sum: number, r: any) => sum + (parseFloat(r.landed) || 0), 0);
          const totalSrp = cd.multiRows.reduce((sum: number, r: any) => sum + (parseFloat(r.srp) || 0), 0);
          // Round up Total SRP to nearest 100: Math.ceil(totalSrp / 100) * 100
          const roundedSrp = totalSrp ? Math.ceil(totalSrp / 100) * 100 : "";
          row.push(totalLanded ? totalLanded.toFixed(2) : "");
          row.push(roundedSrp);
        } else {
          row.push("", "");
        }

        ws.addRow(row);
      });

      // ── Cell alignment ──
      const totalCols = ws.columnCount;
      for (let r = 4; r <= ws.rowCount; r++) {
        for (let col = 1; col <= totalCols; col++) {
          ws.getRow(r).getCell(col).alignment = {
            vertical: "middle", horizontal: "center", wrapText: true,
          };
        }
      }

      // ── Auto column width ──
      ws.columns.forEach((column) => {
        let max = 15;
        column.eachCell?.({ includeEmpty: true }, (cell) => {
          const len = cell.value?.toString().length || 0;
          if (len > max) max = len;
        });
        column.width = Math.min(max + 4, 40);
      });

      ws.views = [{ state: "frozen", ySplit: 3 }];
    }

    const buffer = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "ProductList.xlsx");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {iconOnly ? (
          <button className="h-8 w-8 rounded-full border border-gray-200 bg-white/80 flex items-center justify-center">
            <Download className="h-4 w-4 text-gray-600" />
          </button>
        ) : (
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download Product</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleDownload}>Download</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
