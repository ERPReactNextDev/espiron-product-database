"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, FileText, Upload, X } from "lucide-react";
import GenerateTDSBrand from "@/components/generate-tds-brand";
import { generateTDSPdf } from "@/lib/generateTDSPdf";
import { jsPDF as jsPDFClass } from "jspdf";
import autoTable from "jspdf-autotable";

type TechnicalSpecification = {
  title: string;
  specs: {
    specId: string;
    value: string;
  }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  product: {
    productName?: string;
    itemCode?: string;
    __tdsBrand?: string;
    mainImage?: { url: string };
    dimensionalDrawing?: { url: string };
    illuminanceDrawing?: { url: string };
    technicalSpecifications?: TechnicalSpecification[];
  } | null;
  onTDSGenerated?: (payload: {
    tdsUrl: string;
    productName: string;
    tdsBrand: string;
    dimensionalDrawingUrl: string;
    illuminanceDrawingUrl: string;
  }) => void;
};

const convertDriveToThumbnail = (url: string) => {
  if (!url || !url.includes("drive.google.com")) return url;

  let fileId = "";
  const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

  if (match1 && match1[1]) fileId = match1[1];
  if (match2 && match2[1]) fileId = match2[1];

  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
  }

  return url;
};

export default function SPFGenerateTDSDialog({
  open,
  onClose,
  product,
  onTDSGenerated,
}: Props) {
  const [selectedBrand, setSelectedBrand] = useState("");
  const [productName, setProductName] = useState("");
  const [itemCode, setItemCode] = useState("");
  const [hideEmptySpecs, setHideEmptySpecs] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedTdsUrl, setUploadedTdsUrl] = useState<string | null>(null);

  const [uploadedDimensionalDrawing, setUploadedDimensionalDrawing] = useState<File | null>(null);
  const [uploadedIlluminanceLevel, setUploadedIlluminanceLevel] = useState<File | null>(null);

  const [dimensionalLink, setDimensionalLink] = useState("");
  const [illuminanceLink, setIlluminanceLink] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);

  const uploadDrawing = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/request/spf-request-upload-drawing-api", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Drawing upload failed";
      const clonedResponse = response.clone();
      try {
        const error = await response.json();
        errorMessage = error.message || error.error || errorMessage;
      } catch {
        // Response is not JSON, try to get text from cloned response
        const errorText = await clonedResponse.text();
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    const result = await response.json();
    return result.secure_url;
  };

  useEffect(() => {
    if (open && product) {
      setSelectedBrand(product.__tdsBrand || "");
      setProductName(product.productName || "");
      setItemCode(product.itemCode || "");
      setUploadedTdsUrl(null);
      setUploadedDimensionalDrawing(null);
      setUploadedIlluminanceLevel(null);
      setDimensionalLink(product.dimensionalDrawing?.url || "");
      setIlluminanceLink(product.illuminanceDrawing?.url || "");
    }
  }, [open, product]);

  const handleDimensionalDrawingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setUploadedDimensionalDrawing(event.target.files[0]);
      setDimensionalLink("");
    }
  };

  const handleIlluminanceLevelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setUploadedIlluminanceLevel(event.target.files[0]);
      setIlluminanceLink("");
    }
  };

  const generateAndUploadPDF = async () => {
    if (!selectedBrand) {
      toast.error("Please select a brand");
      return;
    }

    setIsUploading(true);
    try {
      // Generate PDF using the library function
      const jsPDF = (await import("jspdf")).default;
      const autoTable = (await import("jspdf-autotable")).default;

      const dimensionalSource =
        uploadedDimensionalDrawing ||
        (dimensionalLink ? { url: dimensionalLink } : null) ||
        product?.dimensionalDrawing;
      const illuminanceSource =
        uploadedIlluminanceLevel ||
        (illuminanceLink ? { url: illuminanceLink } : null) ||
        product?.illuminanceDrawing;

      // Upload drawings with error handling - don't block if they fail
      let persistedDimensionalUrl = "";
      let persistedIlluminanceUrl = "";

      try {
        if (uploadedDimensionalDrawing) {
          persistedDimensionalUrl = await uploadDrawing(uploadedDimensionalDrawing);
        } else {
          persistedDimensionalUrl = dimensionalLink || product?.dimensionalDrawing?.url || "";
        }
      } catch (error) {
        console.warn("Dimensional drawing upload failed, continuing without it:", error);
        persistedDimensionalUrl = dimensionalLink || product?.dimensionalDrawing?.url || "";
      }

      try {
        if (uploadedIlluminanceLevel) {
          persistedIlluminanceUrl = await uploadDrawing(uploadedIlluminanceLevel);
        } else {
          persistedIlluminanceUrl = illuminanceLink || product?.illuminanceDrawing?.url || "";
        }
      } catch (error) {
        console.warn("Illuminance drawing upload failed, continuing without it:", error);
        persistedIlluminanceUrl = illuminanceLink || product?.illuminanceDrawing?.url || "";
      }

      // Generate PDF Blob with all fallbacks
      const pdfBlob = await generateTDSPdfBlob({
        jsPDF,
        autoTable,
        brand: selectedBrand,
        productName: productName || "Product Name",
        itemCode: itemCode || "",
        mainImage: product?.mainImage || null,
        technicalSpecifications: product?.technicalSpecifications || [],
        dimensionalDrawing: dimensionalSource || null,
        illuminanceDrawing: illuminanceSource || null,
        hideEmptySpecs,
      });

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", pdfBlob, `${productName || "Product"}-${itemCode || "Item"}-TDS.pdf`);

      const response = await fetch("/api/request/spf-request-upload-tds-api", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Upload failed";
        const clonedResponse = response.clone();
        try {
          const error = await response.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch {
          // Response is not JSON, try to get text from cloned response
          const errorText = await clonedResponse.text();
          errorMessage = errorText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      // Create Google Docs viewer URL
      const googleDocsUrl = `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(result.secure_url)}`;
      
      setUploadedTdsUrl(googleDocsUrl);
      
      toast.success("TDS PDF uploaded successfully!");
      
      if (onTDSGenerated) {
        onTDSGenerated({
          tdsUrl: googleDocsUrl,
          productName: productName || "",
          tdsBrand: selectedBrand || "",
          dimensionalDrawingUrl: persistedDimensionalUrl,
          illuminanceDrawingUrl: persistedIlluminanceUrl,
        });
      }
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload TDS PDF");
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="!max-w-none w-[95vw] max-h-[90vh] overflow-y-auto"
        style={{ maxWidth: "95vw" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate TDS
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Brand Selection */}
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <p className="text-sm font-semibold">Select Brand</p>
            <div className="flex gap-4 flex-wrap">
              {["Lit", "Lumera", "Ecoshift"].map((brand) => (
                <label key={brand} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={brand}
                    checked={selectedBrand === brand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="accent-gray-800"
                  />
                  <span className="text-sm">{brand}</span>
                </label>
              ))}
            </div>
          </div>

          {!selectedBrand && (
            <div className="text-center text-sm text-muted-foreground py-10">
              Please select a brand first to continue.
            </div>
          )}

          {selectedBrand && (
            <div className="space-y-4">
              {/* Product Name */}
              <div className="bg-white rounded-xl border p-4 space-y-2">
                <p className="text-sm font-semibold">Product Name</p>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="Enter product name..."
                  className="w-full border rounded-lg h-10 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              {/* Item Code - Read Only */}
              <div className="bg-white rounded-xl border p-4 space-y-2">
                <p className="text-sm font-semibold">Item Code</p>
                <input
                  type="text"
                  value={itemCode}
                  readOnly
                  disabled
                  className="w-full border rounded-lg h-10 px-3 text-sm bg-gray-100 text-gray-600 focus:outline-none cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">Item code is auto-filled from the product</p>
              </div>

              {/* Drawings */}
              <div className="grid grid-cols-2 gap-3">
                {/* Dimensional Drawing */}
                <div className="bg-white rounded-xl border p-3 space-y-2">
                  <p className="text-xs font-semibold">Dimensional Drawing</p>
                  {(uploadedDimensionalDrawing || dimensionalLink || product?.dimensionalDrawing?.url) && (
                    <img
                      src={
                        uploadedDimensionalDrawing
                          ? URL.createObjectURL(uploadedDimensionalDrawing)
                          : convertDriveToThumbnail(dimensionalLink || product?.dimensionalDrawing?.url || "")
                      }
                      className="w-full h-[80px] object-contain border rounded-lg"
                      alt="Dimensional Drawing"
                    />
                  )}
                  <label className="flex items-center justify-center h-9 border-2 border-dashed rounded-lg cursor-pointer text-xs text-gray-400 hover:border-blue-400 transition bg-gray-50">
                    Replace image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDimensionalDrawingChange}
                      className="hidden"
                    />
                  </label>
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500">Or paste image link</p>
                    <input
                      type="text"
                      value={dimensionalLink}
                      onChange={(e) => setDimensionalLink(e.target.value)}
                      placeholder="https://..."
                      className="w-full border rounded-lg h-8 px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </div>
                </div>

                {/* Illuminance Level */}
                <div className="bg-white rounded-xl border p-3 space-y-2">
                  <p className="text-xs font-semibold">Illuminance Level</p>
                  {(uploadedIlluminanceLevel || illuminanceLink || product?.illuminanceDrawing?.url) && (
                    <img
                      src={
                        uploadedIlluminanceLevel
                          ? URL.createObjectURL(uploadedIlluminanceLevel)
                          : convertDriveToThumbnail(illuminanceLink || product?.illuminanceDrawing?.url || "")
                      }
                      className="w-full h-[80px] object-contain border rounded-lg"
                      alt="Illuminance Level"
                    />
                  )}
                  <label className="flex items-center justify-center h-9 border-2 border-dashed rounded-lg cursor-pointer text-xs text-gray-400 hover:border-blue-400 transition bg-gray-50">
                    Replace image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleIlluminanceLevelChange}
                      className="hidden"
                    />
                  </label>
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500">Or paste image link</p>
                    <input
                      type="text"
                      value={illuminanceLink}
                      onChange={(e) => setIlluminanceLink(e.target.value)}
                      placeholder="https://..."
                      className="w-full border rounded-lg h-8 px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </div>
                </div>
              </div>

              {/* Hide Empty Specs Toggle */}
              <div className="bg-white rounded-xl border p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideEmptySpecs}
                    onChange={(e) => setHideEmptySpecs(e.target.checked)}
                    className="w-4 h-4 accent-gray-800"
                  />
                  <span className="text-sm font-medium">
                    {hideEmptySpecs ? "Hide empty specs (ON)" : "Show all specs (OFF)"}
                  </span>
                </label>
              </div>

              {/* TDS Preview */}
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <span className="text-sm font-semibold">TDS Preview</span>
                </div>
                <div className="overflow-x-auto p-3">
                  <div className="min-w-[340px]">
                    <GenerateTDSBrand
                      ref={previewRef}
                      open={true}
                      company={selectedBrand as "Lit" | "Lumera" | "Ecoshift"}
                      productName={productName}
                      itemCode={itemCode}
                      mainImage={product?.mainImage}
                      technicalSpecifications={product?.technicalSpecifications}
                      dimensionalDrawing={uploadedDimensionalDrawing || (dimensionalLink ? { url: dimensionalLink } : null) || product?.dimensionalDrawing}
                      illuminanceLevel={uploadedIlluminanceLevel || (illuminanceLink ? { url: illuminanceLink } : null) || product?.illuminanceDrawing}
                      hideEmptySpecs={hideEmptySpecs}
                    />
                  </div>
                </div>
              </div>

              {/* Uploaded TDS Link Display */}
              {uploadedTdsUrl && (
                <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium text-green-700">TDS PDF Uploaded</span>
                    </div>
                    <button
                      onClick={() => setUploadedTdsUrl(null)}
                      className="text-green-600 hover:text-green-800"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <a
                    href={uploadedTdsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 underline break-all mt-1 block"
                  >
                    {uploadedTdsUrl}
                  </a>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isUploading}
                >
                  Close
                </Button>
                <Button
                  onClick={generateAndUploadPDF}
                  disabled={isUploading || !selectedBrand}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Generate & Upload TDS
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper function to generate PDF as Blob instead of downloading
async function generateTDSPdfBlob({
  jsPDF,
  autoTable,
  brand,
  productName,
  itemCode,
  mainImage,
  technicalSpecifications,
  dimensionalDrawing,
  illuminanceDrawing,
  hideEmptySpecs = true,
}: {
  jsPDF: any;
  autoTable: any;
  brand: string;
  productName: string;
  itemCode: string;
  mainImage?: { url: string } | null;
  technicalSpecifications?: TechnicalSpecification[] | null;
  dimensionalDrawing?: File | { url: string } | null;
  illuminanceDrawing?: File | { url: string } | null;
  hideEmptySpecs?: boolean;
}): Promise<Blob> {
  // Helper to convert drive URL
  const convertDriveToThumbnail = (url: string) => {
    if (!url || !url.includes("drive.google.com")) return url;
    let fileId = "";
    const match1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (match1 && match1[1]) fileId = match1[1];
    if (match2 && match2[1]) fileId = match2[1];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
    return url;
  };
  const pdf = new jsPDF("p", "pt", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const headerHeight = 100;
  const footerHeight = 30;
  let y = headerHeight + 20;

  // Header
  const brandLower = brand.toLowerCase();
  try {
    pdf.addImage(`/${brandLower}-header.png`, "PNG", 0, 0, pageWidth, headerHeight);
  } catch {
    // If header image fails, continue without it
    console.warn(`Failed to load header image for brand: ${brandLower}`);
  }

  // Product image
  const boxWidth = 150;
  const boxHeight = 120;
  const imageX = pageWidth / 2 - boxWidth - 60;
  pdf.setDrawColor(0, 0, 0);
  pdf.setLineWidth(1.5);
  pdf.rect(imageX, y, boxWidth, boxHeight);

  if (mainImage?.url) {
    try {
      const converted = convertDriveToThumbnail(mainImage.url);
      const proxyUrl = `/api/gdrive-image?url=${encodeURIComponent(converted)}`;
      const imgData = await fetch(proxyUrl)
        .then((r) => r.blob())
        .then(
          (blob) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            }),
        );
      const img = new Image();
      img.src = imgData;
      await new Promise((r) => {
        img.onload = r;
      });
      const pad = 10;
      const ratio = Math.min(
        (boxWidth - pad * 2) / img.width,
        (boxHeight - pad * 2) / img.height,
      );
      const fw = img.width * ratio;
      const fh = img.height * ratio;
      pdf.addImage(imgData, "PNG", imageX + (boxWidth - fw) / 2, y + (boxHeight - fh) / 2, fw, fh);
    } catch {}
  }

  // Title
  const textColumnX = imageX + boxWidth + 60;
  const textColumnWidth = boxWidth + 40;
  const title = productName || "Product Name";
  let titleFontSize = 24;
  let titleLines: string[] = [];
  while (true) {
    pdf.setFontSize(titleFontSize);
    titleLines = pdf.splitTextToSize(title, textColumnWidth);
    if (titleLines.length <= 2) break;
    titleFontSize -= 1;
    if (titleFontSize <= 12) break;
  }
  const lineY = y + boxHeight - 20;
  const titleY = lineY - titleLines.length * 14 - 4;
  const centerX = textColumnX + textColumnWidth / 2;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(titleFontSize);
  pdf.text(titleLines, centerX, titleY, { maxWidth: textColumnWidth, align: "center" });
  const uw = textColumnWidth * 1.25;
  pdf.setLineWidth(0.8);
  pdf.line(centerX - uw / 2, lineY, centerX + uw / 2, lineY);

  // Table
  y += 135;
  const activeFilters: string[] = (typeof window !== "undefined" && (window as any).__ACTIVE_FILTERS__) || [];

  const tableRows: any[] = [
    ["Brand :", { content: brand.toUpperCase(), styles: { fontStyle: "bold" } }],
    ["Item Code :", itemCode],
  ];

  (technicalSpecifications || [])
    .filter((g) => g.title !== "COMMERCIAL DETAILS")
    .forEach((group) => {
      const specs = hideEmptySpecs
        ? group.specs.filter((s) => s.value?.trim())
        : group.specs;
      if (hideEmptySpecs && !specs.length) return;
      tableRows.push([
        {
          content: group.title,
          colSpan: 2,
          styles: { fillColor: [210, 215, 220], fontStyle: "bold" },
        },
      ]);
      specs.forEach((spec) => {
        const raw = spec.value || "";
        const vals = raw.split("|").map((v) => v.trim()).filter(Boolean);
        const unique = Array.from(new Set(vals));
        let display = unique.join(" | ");
        if (activeFilters.length) {
          const filtered = unique.filter((v) => activeFilters.includes(v));
          if (filtered.length) display = filtered.join(" | ");
        }
        tableRows.push([spec.specId ? `${spec.specId} :` : "", display || ""]);
      });
    });

  const tableWidth = 450;
  const tableX = (pageWidth - tableWidth) / 2;

  const DRAWING_BLOCK_HEIGHT = 230;
  const FOOTER_REAL_HEIGHT = 90;
  const SAFE_MARGIN = 20;
  const maxTableHeight = pageHeight - FOOTER_REAL_HEIGHT - DRAWING_BLOCK_HEIGHT - SAFE_MARGIN - y;

  let fontSize = 11;
  while (fontSize > 6) {
    const test = new jsPDF("p", "pt", "a4");
    autoTable(test, {
      startY: y,
      theme: "grid",
      styles: { fontSize, cellPadding: 2 },
      body: tableRows,
      tableWidth: 450,
      pageBreak: "avoid",
    });
    if ((test as any).lastAutoTable.finalY - y <= maxTableHeight) break;
    fontSize -= 0.4;
  }

  autoTable(pdf, {
    startY: y,
    theme: "grid",
    pageBreak: "avoid",
    tableWidth,
    margin: { left: tableX },
    styles: { fontSize, cellPadding: 2, overflow: "linebreak" },
    body: tableRows,
    columnStyles: { 0: { cellWidth: 230 }, 1: { cellWidth: 220 } },
  });

  // Drawings
  const dimSource = dimensionalDrawing;
  const illuSource = illuminanceDrawing;

  if (dimSource || illuSource) {
    const tableEndY = (pdf as any).lastAutoTable.finalY;
    const drawingY = tableEndY + 35;
    const drawingW = 190;
    const drawingH = 95;
    const gapBetween = 60;

    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");

    const hasBoth = dimSource && illuSource;

    if (hasBoth) {
      const totalW = drawingW * 2 + gapBetween;
      const startX = (pageWidth - totalW) / 2;

      pdf.text("Dimensional Drawing", startX + drawingW / 2, drawingY - 10, { align: "center" });
      pdf.text("Illuminance Level", startX + drawingW + gapBetween + drawingW / 2, drawingY - 10, { align: "center" });

      try {
        let img: string;
        if (dimSource instanceof File) {
          img = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(dimSource);
          });
        } else {
          const converted = convertDriveToThumbnail(dimSource.url);
          const proxyUrl = `/api/gdrive-image?url=${encodeURIComponent(converted)}`;
          img = await fetch(proxyUrl)
            .then((r) => r.blob())
            .then(
              (blob) =>
                new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                }),
            );
        }
        pdf.addImage(img, "PNG", startX, drawingY, drawingW, drawingH);
      } catch {}

      try {
        let img2: string;
        if (illuSource instanceof File) {
          img2 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(illuSource);
          });
        } else {
          const converted = convertDriveToThumbnail(illuSource!.url);
          const proxyUrl = `/api/gdrive-image?url=${encodeURIComponent(converted)}`;
          img2 = await fetch(proxyUrl)
            .then((r) => r.blob())
            .then(
              (blob) =>
                new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                }),
            );
        }
        pdf.addImage(img2, "PNG", startX + drawingW + gapBetween, drawingY, drawingW, drawingH);
      } catch {}
    } else if (dimSource) {
      const startX = (pageWidth - drawingW) / 2;
      pdf.text("Dimensional Drawing", startX + drawingW / 2, drawingY - 10, { align: "center" });

      try {
        let img: string;
        if (dimSource instanceof File) {
          img = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(dimSource);
          });
        } else {
          const converted = convertDriveToThumbnail(dimSource.url);
          const proxyUrl = `/api/gdrive-image?url=${encodeURIComponent(converted)}`;
          img = await fetch(proxyUrl)
            .then((r) => r.blob())
            .then(
              (blob) =>
                new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                }),
            );
        }
        pdf.addImage(img, "PNG", startX, drawingY, drawingW, drawingH);
      } catch {}
    } else if (illuSource) {
      const startX = (pageWidth - drawingW) / 2;
      pdf.text("Illuminance Level", startX + drawingW / 2, drawingY - 10, { align: "center" });

      try {
        let img: string;
        if (illuSource instanceof File) {
          img = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(illuSource);
          });
        } else {
          const converted = convertDriveToThumbnail(illuSource!.url);
          const proxyUrl = `/api/gdrive-image?url=${encodeURIComponent(converted)}`;
          img = await fetch(proxyUrl)
            .then((r) => r.blob())
            .then(
              (blob) =>
                new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                }),
            );
        }
        pdf.addImage(img, "PNG", startX, drawingY, drawingW, drawingH);
      } catch {}
    }
  }

  // Footer
  try {
    const footerImg = new Image();
    footerImg.src = `/${brandLower}-footer.png`;
    await new Promise((r) => {
      footerImg.onload = r;
    });
    const ratio = pageWidth / footerImg.width;
    const fh = footerImg.height * ratio;
    pdf.addImage(`/${brandLower}-footer.png`, "PNG", 0, pageHeight - fh, pageWidth, fh);
  } catch {
    // If footer image fails, continue without it
    console.warn(`Failed to load footer image for brand: ${brandLower}`);
  }

  // Return as blob
  try {
    return pdf.output("blob");
  } catch (error) {
    console.error("Failed to generate PDF blob:", error);
    throw new Error("Failed to generate PDF");
  }
}
