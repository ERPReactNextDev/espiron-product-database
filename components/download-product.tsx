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





  const handleDownload = async () => {
    // Build CSV rows
    const csvRows: string[][] = [];
    
    // Header row
    const headers = [
      "Product Usage",
      "Product Name",
      "Product Family",
      "Product Class",
      "Price Point",
      "Brand Origin",
      "Supplier Brand",
      "Image URL",
      "Supplier Model Code",
      "Unit Cost",
      "Length",
      "Width",
      "Height",
      "pcs/carton",
      "Factory Address",
      "Port of Discharge",
      "Dimensional Drawing",
      "Illuminance Level",
      "Available Countries",
      "MOQ",
      "Warranty Number",
      "Warranty Period",
      "Commercial Type",
      "POLE - Qty Per Container",
      "POLE - Landed Cost",
      "POLE - SRP",
      "LIGHT (Single) - Unit Cost",
      "LIGHT (Single) - Length",
      "LIGHT (Single) - Width",
      "LIGHT (Single) - Height",
      "LIGHT (Single) - Qty/Box",
      "LIGHT (Single) - Landed Cost",
      "LIGHT (Single) - SRP",
      "LIGHT (Multiple) - Item Names",
      "LIGHT (Multiple) - Unit Costs",
      "LIGHT (Multiple) - Lengths",
      "LIGHT (Multiple) - Widths",
      "LIGHT (Multiple) - Heights",
      "LIGHT (Multiple) - Qty/Boxes",
      "LIGHT (Multiple) - Landed Costs",
      "LIGHT (Multiple) - SRPs",
      "LIGHT (Multiple) - Total Unit Cost",
      "LIGHT (Multiple) - Total Landed Cost",
      "LIGHT (Multiple) - Total SRP",
    ];
    csvRows.push(headers);

    // Data rows
    for (const product of products) {
      const cd = product.commercialDetails || {};
      const row: string[] = [];

      // Static fields
      row.push(escapeCSV(product.categoryTypes?.[0]?.categoryTypeName || ""));
      row.push(escapeCSV(product.productName || ""));
      row.push(escapeCSV(product.productFamilies?.[0]?.productFamilyName || ""));
      row.push(escapeCSV(product.productClass || ""));
      row.push(escapeCSV(product.pricePoint || ""));
      row.push(escapeCSV(product.brandOrigin || "CHINA"));
      row.push(escapeCSV(product.supplier?.supplierBrand || "ECONOMY"));
      row.push(escapeCSV(convertDriveToThumbnail(product.mainImage?.url || "")));
      row.push(escapeCSV(cd.supplierModelCode || ""));

      // Commercial Details (BASIC)
      row.push(escapeCSV(cd.unitCost || ""));
      row.push(escapeCSV(cd.packaging?.length || ""));
      row.push(escapeCSV(cd.packaging?.width || ""));
      row.push(escapeCSV(cd.packaging?.height || ""));
      row.push(escapeCSV(cd.pcsPerCarton || ""));
      row.push(escapeCSV(cd.factoryAddress || ""));
      row.push(escapeCSV(cd.portOfDischarge || ""));

      // Drawings
      row.push(escapeCSV(convertDriveToThumbnail(product.dimensionalDrawing?.url || "")));
      row.push(escapeCSV(convertDriveToThumbnail(product.illuminanceDrawing?.url || "")));

      // Available Countries
      row.push(escapeCSV((product.countries || []).join(" | ")));

      // MOQ
      row.push(escapeCSV(cd.moq || ""));

      // Warranty
      const warrantyStr = cd.warranty || "";
      const warrantyParts = warrantyStr.split(" ");
      row.push(escapeCSV(warrantyParts[0] || ""));
      row.push(escapeCSV(warrantyParts.slice(1).join(" ") || ""));

      // Commercial Type
      row.push(escapeCSV(cd.commercialType || "BASIC"));

      // POLE
      if (cd.commercialType === "POLE") {
        row.push(escapeCSV(cd.qtyPerContainer || ""));
        const uc = parseFloat(cd.unitCost) || 0;
        const qty = parseInt(cd.qtyPerContainer) || 0;
        const landed = qty > 0 ? (uc * 65 + 520000 / qty) * 1.01 : 0;
        const srp = landed ? Math.ceil(landed / 0.45 / 100) * 100 : 0;
        row.push(escapeCSV(landed ? landed.toFixed(2) : ""));
        row.push(escapeCSV(String(srp || "")));
      } else {
        row.push("", "", "");
      }

      // LIGHT (SINGLE DIMENSION)
      if (cd.commercialType === "LIGHT" && !cd.useArrayInput) {
        row.push(escapeCSV(cd.unitCost || ""));
        row.push(escapeCSV(cd.packaging?.length || ""));
        row.push(escapeCSV(cd.packaging?.width || ""));
        row.push(escapeCSV(cd.packaging?.height || ""));
        row.push(escapeCSV(cd.pcsPerCarton || ""));
        row.push(escapeCSV(cd.landedCost ? cd.landedCost.toFixed(2) : ""));
        row.push(escapeCSV(cd.srp || ""));
      } else {
        row.push("", "", "", "", "", "", "");
      }

      // LIGHT (MULTIPLE DIMENSION)
      const multiRows: any[] = (cd.commercialType === "LIGHT" && cd.useArrayInput && Array.isArray(cd.multiRows))
        ? cd.multiRows
        : [];

      const joinField = (fn: (r: any) => any) =>
        multiRows.length ? multiRows.map(fn).join(" | ") : "";

      row.push(escapeCSV(joinField((r) => r.itemName || "")));
      row.push(escapeCSV(joinField((r) => r.unitCost ?? "")));
      row.push(escapeCSV(joinField((r) => r.length ?? "")));
      row.push(escapeCSV(joinField((r) => r.width ?? "")));
      row.push(escapeCSV(joinField((r) => r.height ?? "")));
      row.push(escapeCSV(joinField((r) => r.qtyPerCarton ?? "")));
      row.push(escapeCSV(joinField((r) => r.landed ? r.landed.toFixed(2) : "")));
      row.push(escapeCSV(joinField((r) => r.srp ?? "")));

      // LIGHT (MULTIPLE) TOTALS
      if (cd.commercialType === "LIGHT" && cd.useArrayInput && Array.isArray(cd.multiRows) && cd.multiRows.length > 0) {
        const totalUnitCost = cd.multiRows.reduce((sum: number, r: any) => sum + (parseFloat(r.unitCost) || 0), 0);
        const totalLanded = cd.multiRows.reduce((sum: number, r: any) => sum + (parseFloat(r.landed) || 0), 0);
        const totalSrp = cd.multiRows.reduce((sum: number, r: any) => sum + (parseFloat(r.srp) || 0), 0);
        const roundedSrp = totalSrp ? Math.ceil(totalSrp / 100) * 100 : "";
        row.push(escapeCSV(totalUnitCost ? totalUnitCost.toFixed(2) : ""));
        row.push(escapeCSV(totalLanded ? totalLanded.toFixed(2) : ""));
        row.push(escapeCSV(String(roundedSrp)));
      } else {
        row.push("", "", "");
      }

      csvRows.push(row);
    }

    // Convert to CSV string
    const csvContent = csvRows.map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "ProductList.csv");
    setOpen(false);
  };

  const escapeCSV = (value: string): string => {
    if (!value) return "";
    const str = String(value);
    if (str.includes(",") || str.includes("\n") || str.includes("\"")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
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

          <DialogTitle>Download Products</DialogTitle>
          <p className="text-sm text-gray-500 mt-2">
            Download all {products.length} products from the database
          </p>

        </DialogHeader>

        <DialogFooter>

          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>

          <Button onClick={handleDownload}>Download {products.length} Products</Button>

        </DialogFooter>

      </DialogContent>

    </Dialog>

  );

}

