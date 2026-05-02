"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Upload } from "lucide-react";
import ExcelJS from "exceljs";

import {
  collection,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  DocumentData,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import { logProductEvent, logProductUsageEvent, logProductFamilyEvent } from "@/lib/auditlogger";
import {
  createApprovalRequest,
  getApprovalUserProfile,
  shouldRequireApproval,
} from "@/lib/for-approval";
import {
  buildExcelColumnsMapFromWorkbook,
  parseWorkbookRowsNew,
  type ParsedProductRow,
} from "@/lib/product-bulk-insert-runner";

import DuplicateCheckModal, { DuplicateRow } from "@/components/duplicate-check-modal";
import RequestApprovalDialog from "@/components/request-approval-dialog";

type Props = { iconOnly?: boolean };
type UserDetails = { Firstname: string; Lastname: string; ReferenceID: string };
type CategoryType = { id: string; name: string };
type ProductFamily = { id: string; name: string; categoryTypeId: string };
type Supplier = { supplierId: string; company: string; supplierBrand?: string };
type TemplateSpec = { id: string; title: string; specs: { specId: string }[]; sortOrder?: number };

/* ─────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────── */
const cleanExcelValue = (val: any) => {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return val.toString();
  const str = val.toString().trim();
  return str === "-" ? "" : str;
};

const convertDriveToThumbnail = (url?: string) => {
  if (!url) return "";
  if (!url.includes("drive.google.com")) return url;
  const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  const fileId = m1?.[1] || m2?.[1] || "";
  return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;
};

const extractHyperlink = (cell: any): string => {
  if (!cell) return "";
  const v = typeof cell === "object" && "value" in cell ? cell.value : cell;
  if (!v) return "";
  if (typeof v === "object") {
    if (v.hyperlink) return v.hyperlink;
    if (v.text) return v.text;
    return String(v);
  }
  return cleanExcelValue(v);
};

/* ─────────────────────────────────────────────────────────────────
 * Fingerprint for duplicate detection
 * ───────────────────────────────────────────────────────────────── */
const normalizeSupplierBrand = (val: string | null | undefined): string => {
  const v = (val ?? "").trim().toUpperCase();
  if (v === "ECONOMY" || v === "-" || v === "N/A") return "";
  return v.toLowerCase();
};
const normalizeBrandOrigin = (val: string | null | undefined) =>
  (val ?? "").trim().toLowerCase();
const normalizeField = (val: string | null | undefined) =>
  (val ?? "").trim().toLowerCase();

const buildFingerprint = (
  usage: string, family: string, productClass: string,
  pricePoint: string, brandOrigin: string, supplierBrand: string,
) =>
  [
    normalizeField(usage), normalizeField(family), normalizeField(productClass),
    normalizeField(pricePoint), normalizeBrandOrigin(brandOrigin),
    normalizeSupplierBrand(supplierBrand),
  ].join("|");

/* ─────────────────────────────────────────────────────────────────
 * Build commercialDetails object from a parsed row
 * ───────────────────────────────────────────────────────────────── */
function buildCommercialDetails(row: ParsedProductRow): Record<string, any> {
  const ct = (row.commercialType || "BASIC").toUpperCase();
  const warranty = row.warrantyNumber
    ? `${row.warrantyNumber} ${row.warrantyPeriod || "months"}`.trim()
    : null;

  const base = {
    commercialType: ct,
    moq: row.moq ? parseInt(row.moq) : null,
    warranty,
    factoryAddress: row.factoryAddress || "",
    portOfDischarge: row.portOfDischarge || "",
  };

  if (ct === "POLE") {
    return {
      ...base,
      calculationType: "POLE",
      unitCost: row.unitCost ? parseFloat(row.unitCost) : null,
      qtyPerContainer: row.poleQtyPerContainer ? parseInt(row.poleQtyPerContainer) : null,
      landedCost: row.poleLandedCost ? parseFloat(row.poleLandedCost) : null,
      srp: row.poleSrp ? parseFloat(row.poleSrp) : null,
    };
  }

  if (ct === "LIGHT") {
    const hasMulti = row.lightMultiItemNames?.trim() !== "";

    if (hasMulti) {
      const parseArr = (s: string) => s.split("|").map((v) => v.trim()).filter(Boolean);
      const names   = parseArr(row.lightMultiItemNames);
      const ucs     = parseArr(row.lightMultiUnitCosts);
      const lengths = parseArr(row.lightMultiLengths);
      const widths  = parseArr(row.lightMultiWidths);
      const heights = parseArr(row.lightMultiHeights);
      const qtys    = parseArr(row.lightMultiQtyPerBoxes);
      const landeds = parseArr(row.lightMultiLandedCosts);
      const srps    = parseArr(row.lightMultiSrps);

      // Only treat as multi if we actually have item names
      if (names.length > 0) {
        const multiRows = names.map((name, i) => ({
          itemName: name,
          unitCost: parseFloat(ucs[i] || "0") || 0,
          length: parseFloat(lengths[i] || "0") || 0,
          width: parseFloat(widths[i] || "0") || 0,
          height: parseFloat(heights[i] || "0") || 0,
          qtyPerCarton: parseInt(qtys[i] || "1") || 1,
          landed: parseFloat(landeds[i] || "0") || 0,
          srp: parseFloat(srps[i] || "0") || 0,
        }));

        const totalLanded = multiRows.reduce((s, r) => s + r.landed, 0);
        const totalUnitCost = row.lightMultiTotalUnitCost ? parseFloat(row.lightMultiTotalUnitCost) : multiRows.reduce((s, r) => s + r.unitCost, 0);
        const totalSrp = row.lightMultiTotalSrp ? parseFloat(row.lightMultiTotalSrp) : multiRows.reduce((s, r) => s + r.srp, 0);

        return {
          ...base,
          calculationType: "LIGHTS",
          useArrayInput: true,
          multiRows,
          totalUnitCost: totalUnitCost || null,
          landedCost: totalLanded || null,
          srp: totalSrp || null,
        };
      }
    }

    return {
      ...base,
      calculationType: "LIGHTS",
      useArrayInput: false,
      unitCost: row.lightSingleUnitCost ? parseFloat(row.lightSingleUnitCost) : null,
      packaging: {
        length: row.lightSingleLength ? `${parseFloat(row.lightSingleLength)} cm` : null,
        width: row.lightSingleWidth ? `${parseFloat(row.lightSingleWidth)} cm` : null,
        height: row.lightSingleHeight ? `${parseFloat(row.lightSingleHeight)} cm` : null,
      },
      pcsPerCarton: row.lightSingleQtyPerBox ? parseInt(row.lightSingleQtyPerBox) : null,
      landedCost: row.lightSingleLandedCost ? parseFloat(row.lightSingleLandedCost) : null,
      srp: row.lightSingleSrp ? parseFloat(row.lightSingleSrp) : null,
      multiRows: [],
    };
  }

  // BASIC
  return {
    ...base,
    calculationType: null,
    unitCost: row.unitCost ? parseFloat(row.unitCost) : null,
    packaging: {
      length: row.length ? `${parseFloat(row.length)} cm` : null,
      width: row.width ? `${parseFloat(row.width)} cm` : null,
      height: row.height ? `${parseFloat(row.height)} cm` : null,
    },
    pcsPerCarton: row.pcsPerCarton ? parseInt(row.pcsPerCarton) : null,
  };
}

/* ─────────────────────────────────────────────────────────────────
 * Component
 * ───────────────────────────────────────────────────────────────── */
export default function UploadProduct({ iconOnly = false }: Props) {
  const { userId } = useUser();
  const [user, setUser] = useState<UserDetails | null>(null);

  const [open, setOpen] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [totalRows, setTotalRows] = React.useState(0);

  const [duplicateRows, setDuplicateRows] = useState<DuplicateRow[]>([]);
  const [duplicateCheckOpen, setDuplicateCheckOpen] = useState(false);
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [nonDuplicateParsedRows, setNonDuplicateParsedRows] = useState<ParsedProductRow[]>([]);

  const [requestApprovalOpen, setRequestApprovalOpen] = useState(false);
  const [requestingApproval, setRequestingApproval] = useState(false);
  const [approvalExcelColumns, setApprovalExcelColumns] = useState<Record<
    string, { title: string; specId: string; col: number }[]
  > | null>(null);
  const [approvalRowsPending, setApprovalRowsPending] = useState<ParsedProductRow[] | null>(null);
  const [approvalFilename, setApprovalFilename] = useState("");
  const [approvalDupSummary, setApprovalDupSummary] = useState("");
  const [approvalAfterDuplicate, setApprovalAfterDuplicate] = useState(false);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const cancelRef = React.useRef(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users?id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setUser({ Firstname: d.Firstname ?? "", Lastname: d.Lastname ?? "", ReferenceID: d.ReferenceID ?? "" }))
      .catch(console.error);
  }, [userId]);

  /* ─────────────────────────────────────────────────────────────────
   * Firestore helpers
   * ───────────────────────────────────────────────────────────────── */
  const findCategoryType = async (name: string): Promise<CategoryType | null> => {
    const q = query(collection(db, "categoryTypes"), where("name", "==", name), where("isActive", "==", true));
    const snap = await getDocs(q);
    if (!snap.empty) { const d = snap.docs[0]; return { id: d.id, name: (d.data() as DocumentData).name }; }
    const newDoc = await addDoc(collection(db, "categoryTypes"), { name, isActive: true, createdAt: serverTimestamp(), whatHappened: "Product Usage Added (Excel Upload)", date_updated: serverTimestamp() });
    await logProductUsageEvent({ whatHappened: "Product Usage Added", productUsageId: newDoc.id, productUsageName: name, referenceID: user?.ReferenceID, userId: userId ?? undefined, extra: { source: "excel_upload" } });
    return { id: newDoc.id, name };
  };

  const findProductFamily = async (categoryTypeId: string, name: string): Promise<ProductFamily | null> => {
    const q = query(collection(db, "productFamilies"), where("categoryTypeId", "==", categoryTypeId), where("name", "==", name), where("isActive", "==", true));
    const snap = await getDocs(q);
    if (!snap.empty) { const d = snap.docs[0]; const data = d.data() as DocumentData; return { id: d.id, name: data.name, categoryTypeId: data.categoryTypeId }; }
    const newDoc = await addDoc(collection(db, "productFamilies"), { name, categoryTypeId, isActive: true, createdAt: serverTimestamp(), whatHappened: "Product Family Added (Excel Upload)", date_updated: serverTimestamp() });
    await logProductFamilyEvent({ whatHappened: "Product Family Added", productFamilyId: newDoc.id, productFamilyName: name, productUsageId: categoryTypeId, referenceID: user?.ReferenceID, userId: userId ?? undefined, extra: { source: "excel_upload" } });
    return { id: newDoc.id, name, categoryTypeId };
  };

  const findSupplier = async (brand: string): Promise<Supplier | null> => {
    if (!brand) return null;
    const q = query(collection(db, "suppliers"), where("supplierBrand", "==", brand), where("isActive", "==", true));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0]; const data = d.data();
    return { supplierId: d.id, company: data.company, supplierBrand: data.supplierBrand || "" };
  };

  const createMissingTemplateSpecs = async (categoryTypeId: string, productFamilyId: string, excelColumns: { title: string; specId: string }[]) => {
    const templateSnap = await getDocs(query(collection(db, "technicalSpecifications"), where("categoryTypeId", "==", categoryTypeId), where("productFamilyId", "==", productFamilyId), where("isActive", "==", true)));
    const existingTitles = templateSnap.docs.map((d) => d.data().title);
    const groups = new Map<string, { specId: string }[]>();
    for (const col of excelColumns) {
      if (!groups.has(col.title)) groups.set(col.title, []);
      groups.get(col.title)!.push({ specId: col.specId });
    }
    let sortOrder = 0;
    for (const [title, specs] of groups) {
      sortOrder++;
      if (!existingTitles.includes(title)) {
        await addDoc(collection(db, "technicalSpecifications"), { categoryTypeId, productFamilyId, title, specs, sortOrder, isActive: true, createdAt: serverTimestamp(), whatHappened: "Product Added", date_updated: serverTimestamp() });
      } else {
        const existing = templateSnap.docs.find((d) => d.data().title === title);
        if (existing) await updateDoc(existing.ref, { sortOrder, date_updated: serverTimestamp() });
      }
    }
  };

  const findTemplateSpecs = async (categoryTypeId: string, productFamilyId: string): Promise<TemplateSpec[]> => {
    const q = query(collection(db, "technicalSpecifications"), where("categoryTypeId", "==", categoryTypeId), where("productFamilyId", "==", productFamilyId), where("isActive", "==", true));
    const snap = await getDocs(q);
    return snap.docs.map((d) => { const data = d.data() as DocumentData; return { id: d.id, title: data.title, specs: data.specs || [], sortOrder: data.sortOrder ?? 999 }; }).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
  };

  const syncExistingProductsToTemplate = async (categoryTypeId: string, productFamilyId: string) => {
    const templateSnap = await getDocs(query(collection(db, "technicalSpecifications"), where("categoryTypeId", "==", categoryTypeId), where("productFamilyId", "==", productFamilyId), where("isActive", "==", true)));
    const templates = templateSnap.docs.map((d) => ({ id: d.id, title: d.data().title, specs: d.data().specs || [], sortOrder: d.data().sortOrder ?? 999 })).sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));
    const productSnap = await getDocs(collection(db, "products"));
    for (const productDoc of productSnap.docs) {
      const data = productDoc.data();
      const family = data.productFamilies?.[0];
      if (!family || family.productFamilyId !== productFamilyId || family.productUsageId !== categoryTypeId) continue;
      const existingSpecs = data.technicalSpecifications || [];
      const mergedSpecs = templates.map((template) => {
        const existingGroup = existingSpecs.find((g: any) => g.title === template.title);
        return { technicalSpecificationId: template.id, title: template.title, specs: template.specs.map((spec: any) => { const existingRow = existingGroup?.specs?.find((r: any) => r.specId === spec.specId); return { specId: spec.specId, value: existingRow?.value || "" }; }) };
      });
      await updateDoc(productDoc.ref, { technicalSpecifications: mergedSpecs, updatedAt: serverTimestamp() });
    }
  };

  /* ─────────────────────────────────────────────────────────────────
   * Duplicate check
   * ───────────────────────────────────────────────────────────────── */
  const checkForDuplicates = async (rows: ParsedProductRow[]): Promise<{
    dupeRows: DuplicateRow[];
    nonDupes: ParsedProductRow[];
    dupeOriginals: ParsedProductRow[];
  }> => {
    const snap = await getDocs(collection(db, "products"));
    const existingFingerprints = new Set<string>();
    snap.docs.forEach((d) => {
      const data = d.data();
      if (data.isActive === false) return;
      existingFingerprints.add(buildFingerprint(
        data.categoryTypes?.[0]?.categoryTypeName ?? "",
        data.productFamilies?.[0]?.productFamilyName ?? "",
        data.productClass ?? "", data.pricePoint ?? "",
        data.brandOrigin ?? "", data.supplier?.supplierBrand ?? "",
      ));
    });

    const dupeOriginals: ParsedProductRow[] = [];
    const nonDupes: ParsedProductRow[] = [];

    for (const row of rows) {
      const fp = buildFingerprint(row.usage, row.family, row.productClass, row.pricePoint, row.brandOrigin, row.supplierBrand);
      if (existingFingerprints.has(fp)) dupeOriginals.push(row);
      else nonDupes.push(row);
    }

    const COLS = [
      "Usage", "Family", "Product Class", "Price Point", "Brand Origin", "Supplier Brand",
      "Image", "Commercial Type", "MOQ", "Warranty",
      "Dimensional", "Illuminance",
    ];

    const dupeRows: DuplicateRow[] = dupeOriginals.map((row, i) => ({
      key: `${i}-${row.usage}-${row.productClass}`,
      columns: COLS,
      values: [
        row.usage, row.family, row.productClass, row.pricePoint,
        row.brandOrigin, row.supplierBrand,
        row.imageURL ? "✓ Image" : "—",
        row.commercialType || "BASIC",
        row.moq || "—",
        row.warrantyNumber ? `${row.warrantyNumber} ${row.warrantyPeriod}` : "—",
        row.dimensionalURL ? "✓ Drawing" : "—",
        row.illuminanceURL ? "✓ Illuminance" : "—",
      ],
    }));

    return { dupeRows, nonDupes, dupeOriginals };
  };

  /* ─────────────────────────────────────────────────────────────────
   * Main upload handler
   * ───────────────────────────────────────────────────────────────── */
  const handleUpload = async () => {
    if (!file) return;
    cancelRef.current = false;
    setUploading(true);
    setApprovalAfterDuplicate(false);

    try {
      const workbook = new ExcelJS.Workbook();
      const buffer = await file.arrayBuffer();
      await workbook.xlsx.load(buffer);

      // Use new parser from runner
      const allRows = parseWorkbookRowsNew(workbook);
      setParsedRows(allRows);

      if (!allRows.length) {
        toast.warning("No valid rows found in the file.");
        setUploading(false);
        return;
      }

      const excelColumnsByWsIndex = buildExcelColumnsMapFromWorkbook(workbook);
      const { dupeRows, nonDupes } = await checkForDuplicates(allRows);
      const profile = userId ? await getApprovalUserProfile(userId) : null;
      const needsApproval = shouldRequireApproval(profile);

      if (dupeRows.length === allRows.length) {
        toast.error("Upload blocked", {
          description: `All ${allRows.length} rows already exist in the system. Nothing to upload.`,
        });
        setUploading(false);
        return;
      }

      if (needsApproval) {
        if (!profile) { toast.error("User profile not loaded"); setUploading(false); return; }
        setUploading(false);
        setApprovalExcelColumns(excelColumnsByWsIndex);
        setApprovalFilename(file.name);
        if (dupeRows.length > 0) {
          setDuplicateRows(dupeRows);
          setNonDuplicateParsedRows(nonDupes);
          setApprovalAfterDuplicate(true);
          setApprovalDupSummary(`${dupeRows.length} duplicate row(s) · ${nonDupes.length} new row(s) if you skip duplicates`);
          setDuplicateCheckOpen(true);
          return;
        }
        setApprovalRowsPending(allRows);
        setApprovalDupSummary("No duplicates detected vs existing products.");
        setRequestApprovalOpen(true);
        return;
      }

      if (dupeRows.length > 0) {
        setDuplicateRows(dupeRows);
        setNonDuplicateParsedRows(nonDupes);
        setDuplicateCheckOpen(true);
        setUploading(false);
        return;
      }

      await performUpload(allRows, workbook);
    } catch (error) {
      console.error(error);
      toast.error("Upload failed");
      setUploading(false);
    }
  };

  const submitProductUploadForApproval = async (message: string) => {
    if (!userId || !approvalRowsPending || !approvalExcelColumns) return;
    setRequestingApproval(true);
    try {
      const profile = await getApprovalUserProfile(userId);
      if (!profile) { toast.error("User profile not loaded"); return; }
      const rows = approvalRowsPending;
      await createApprovalRequest({
        actionType: "product_upload",
        entityLabel: approvalFilename,
        requester: profile,
        message,
        summary: `Upload products: ${approvalFilename}`,
        payload: {
          filename: approvalFilename,
          rows,
          excelColumnsByWsIndex: approvalExcelColumns,
          rowCount: rows.length,
          duplicateSummary: approvalDupSummary || null,
        },
      });
      await logProductEvent({ whatHappened: "Product For Approval Requested", referenceID: profile.referenceID, userId, extra: { source: "excel_upload", filename: approvalFilename, rows: rows.length } });
      toast.success("Upload request sent for approval");
      setRequestApprovalOpen(false);
      setOpen(false);
      setFile(null);
      setApprovalRowsPending(null);
      setApprovalExcelColumns(null);
      setApprovalDupSummary("");
      setApprovalAfterDuplicate(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to send approval request");
    } finally {
      setRequestingApproval(false);
    }
  };

  const handleSkipDuplicates = async () => {
    setDuplicateCheckOpen(false);
    if (!nonDuplicateParsedRows.length) { toast.warning("Nothing to upload", { description: "All rows were duplicates." }); return; }
    if (!file) return;
    if (approvalAfterDuplicate) {
      setApprovalAfterDuplicate(false);
      setApprovalRowsPending(nonDuplicateParsedRows);
      setRequestApprovalOpen(true);
      return;
    }
    setUploading(true);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    await performUpload(nonDuplicateParsedRows, workbook);
  };

  const handleUploadAll = async () => {
    setDuplicateCheckOpen(false);
    if (!file) return;
    if (approvalAfterDuplicate) {
      setApprovalAfterDuplicate(false);
      setApprovalDupSummary(`${duplicateRows.length} row(s) overlap existing products (upload all rows was selected).`);
      setApprovalRowsPending(parsedRows);
      setRequestApprovalOpen(true);
      return;
    }
    setUploading(true);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    await performUpload(parsedRows, workbook);
  };

  /* ─────────────────────────────────────────────────────────────────
   * Core upload
   * ───────────────────────────────────────────────────────────────── */
  const performUpload = async (rowsToUpload: ParsedProductRow[], workbook: ExcelJS.Workbook) => {
    cancelRef.current = false;
    try {
      try {
        if (!audioRef.current) {
          audioRef.current = new Audio("/musics/elevator-music.mp3");
          audioRef.current.loop = true;
          audioRef.current.volume = 0.4;
        }
        audioRef.current.play();
      } catch { console.warn("Audio blocked by browser"); }

      setTotalRows(rowsToUpload.length);
      setUploadProgress(0);

      const existingSnap = await getDocs(collection(db, "products"));
      let productCounter = existingSnap.size;

      // Build spec column map per worksheet
      const wsColumnsMap = new Map<number, { title: string; specId: string; col: number }[]>();
      for (let wsIndex = 0; wsIndex < workbook.worksheets.length; wsIndex++) {
        const ws = workbook.worksheets[wsIndex];
        const h1 = ws.getRow(1);
        const h2 = ws.getRow(2);
        const cols: { title: string; specId: string; col: number }[] = [];

        for (let col = 1; col <= ws.columnCount; col++) {
          const specId = cleanExcelValue(h1.getCell(col).value);
          const group  = cleanExcelValue(h2.getCell(col).value);

          if (col < 8) continue;

          const SKIP_GROUPS = ["COMMERCIAL DETAILS", "DRAWINGS", "WARRANTY", "POLE", "LIGHT (SINGLE DIMENSION)", "LIGHT (MULTIPLE DIMENSION)"];
          const SKIP_SPECS  = [
            "Unit Cost", "Length", "Width", "Height", "pcs/carton",
            "Factory Address", "Port of Discharge",
            "Dimensional Drawing", "Illuminance Level",
            "Available Countries", "MOQ",
            "Warranty Number", "Warranty Period", "Commercial Type",
            "POLE - Qty Per Container", "POLE - Landed Cost", "POLE - SRP",
            "LIGHT (Single) - Unit Cost", "LIGHT (Single) - Length", "LIGHT (Single) - Width",
            "LIGHT (Single) - Height", "LIGHT (Single) - Qty/Box",
            "LIGHT (Single) - Landed Cost", "LIGHT (Single) - SRP",
            "LIGHT (Multiple) - Item Names", "LIGHT (Multiple) - Unit Costs",
            "LIGHT (Multiple) - Lengths", "LIGHT (Multiple) - Widths",
            "LIGHT (Multiple) - Heights", "LIGHT (Multiple) - Qty/Boxes",
            "LIGHT (Multiple) - Landed Costs", "LIGHT (Multiple) - SRPs",
          ];
          if (!group || !specId) continue;
          cols.push({ title: group, specId, col });
        }
        wsColumnsMap.set(wsIndex, cols);
      }

      const syncedFamilies = new Set<string>();
      let totalInserted = 0;

      for (const row of rowsToUpload) {
        if (cancelRef.current) { toast.message("Upload cancelled"); break; }

        const category = await findCategoryType(row.usage);
        if (!category) continue;
        const productFamily = await findProductFamily(category.id, row.family);
        if (!productFamily) continue;
        const supplier = await findSupplier(row.supplierBrand);

        const excelColumns = wsColumnsMap.get(row.wsIndex) ?? [];
        const syncKey = `${category.id}_${productFamily.id}`;
        if (!syncedFamilies.has(syncKey)) {
          if (cancelRef.current) break;
          await createMissingTemplateSpecs(category.id, productFamily.id, excelColumns);
          if (cancelRef.current) break;
          await syncExistingProductsToTemplate(category.id, productFamily.id);
          syncedFamilies.add(syncKey);
        }

        const templateSpecs = await findTemplateSpecs(category.id, productFamily.id);
        const productSpecs = templateSpecs.map((template) => ({
          technicalSpecificationId: template.id,
          title: template.title,
          specs: template.specs.map((ts) => ({
            specId: ts.specId,
            value : row.specValues[`${template.title}||${ts.specId}`] ?? "",
          })),
        }));

        productCounter++;
        const referenceID = `PROD-SPF-${productCounter.toString().padStart(5, "0")}`;
        const commercialDetails = buildCommercialDetails(row);

        if (cancelRef.current) break;

        const newDocRef = await addDoc(collection(db, "products"), {
          productReferenceID: referenceID,
          productClass: row.productClass,
          pricePoint: row.pricePoint,
          brandOrigin: row.brandOrigin,
          supplier,
          mainImage: row.imageURL ? { url: row.imageURL } : null,
          dimensionalDrawing: row.dimensionalURL ? { url: row.dimensionalURL } : null,
          illuminanceDrawing: row.illuminanceURL ? { url: row.illuminanceURL } : null,
          categoryTypes: [{ productUsageId: category.id, categoryTypeName: category.name }],
          productFamilies: [{ productFamilyId: productFamily.id, productFamilyName: productFamily.name, productUsageId: category.id }],
          technicalSpecifications: productSpecs,
          commercialDetails,
          countries: row.countries ? row.countries.split("|").map((c) => c.trim()).filter(Boolean) : [],
          isActive: true,
          createdAt: serverTimestamp(),
          whatHappened: "Product Added",
          date_updated: serverTimestamp(),
        });

        await logProductEvent({
          whatHappened: "Product Added",
          productId: newDocRef.id,
          productReferenceID: referenceID,
          productClass: row.productClass,
          pricePoint: row.pricePoint,
          brandOrigin: row.brandOrigin,
          supplier: supplier ?? null,
          categoryTypes: [{ productUsageId: category.id, categoryTypeName: category.name }],
          productFamilies: [{ productFamilyId: productFamily.id, productFamilyName: productFamily.name }],
          mainImage: row.imageURL ? { url: row.imageURL } : null,
          dimensionalDrawing: row.dimensionalURL ? { url: row.dimensionalURL } : null,
          illuminanceDrawing: row.illuminanceURL ? { url: row.illuminanceURL } : null,
          technicalSpecifications: productSpecs,
          referenceID: user?.ReferenceID,
          userId: userId ?? undefined,
          extra: { source: "excel_upload", filename: file?.name ?? "" },
        });

        totalInserted++;
        setUploadProgress((prev) => prev + 1);
      }

      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;

      await logProductEvent({
        whatHappened: "Product Bulk Upload",
        inserted: totalInserted,
        referenceID: user?.ReferenceID,
        userId: userId ?? undefined,
        extra: { source: "excel_upload", filename: file?.name ?? "" },
      });

      toast.success("Upload complete");
      setOpen(false);
      setFile(null);
      setUploadProgress(0);
      setTotalRows(0);
    } catch (error) {
      console.error(error);
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {iconOnly ? (
            <button className="h-8 w-8 rounded-full border border-gray-200 bg-white/80 flex items-center justify-center">
              <Upload className="h-4 w-4 text-gray-600" />
            </button>
          ) : (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Upload className="w-4 h-4 mr-2" />
              Upload
            </Button>
          )}
        </DialogTrigger>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Products</DialogTitle>
          </DialogHeader>

          <div
            className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:bg-gray-50 transition"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) setFile(f); }}
            onClick={() => document.getElementById("product-upload-input")?.click()}
          >
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-500" />
              <p className="text-sm text-gray-600">Drag & Drop your Excel file here</p>
              <p className="text-xs text-gray-400">or click to browse</p>
              {file && !uploading && <p className="text-sm font-medium text-green-600">{file.name}</p>}
              {uploading && (
                <div className="flex flex-col items-center gap-2 mt-2">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
                  <p className="text-sm font-medium">Uploading products...</p>
                  <p className="text-xs text-gray-500">{uploadProgress} out of {totalRows}</p>
                </div>
              )}
            </div>
            <input id="product-upload-input" type="file" accept=".xlsx" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { cancelRef.current = true; audioRef.current?.pause(); if (audioRef.current) audioRef.current.currentTime = 0; setUploading(false); setOpen(false); toast.message("Upload cancelled"); }}>
              Cancel
            </Button>
            <Button disabled={!file || uploading} onClick={handleUpload}>
              {uploading ? "Checking..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DuplicateCheckModal
        open={duplicateCheckOpen}
        onOpenChange={setDuplicateCheckOpen}
        title={`${duplicateRows.length} Duplicate Product${duplicateRows.length > 1 ? "s" : ""} Found`}
        duplicates={duplicateRows}
        uploading={uploading}
        onSkipDuplicates={handleSkipDuplicates}
        onUploadAll={handleUploadAll}
      />

      <RequestApprovalDialog
        open={requestApprovalOpen}
        onOpenChange={(o) => {
          setRequestApprovalOpen(o);
          if (!o) {
            setApprovalRowsPending(null);
            setApprovalExcelColumns(null);
            setApprovalDupSummary("");
            setApprovalAfterDuplicate(false);
          }
        }}
        actionLabel="Upload products (Excel)"
        entityLabel={approvalFilename || "Excel file"}
        detailLines={[
          approvalDupSummary,
          approvalRowsPending?.length
            ? `${approvalRowsPending.length} product row(s) will be imported after approval.`
            : "",
        ].filter(Boolean)}
        onConfirm={submitProductUploadForApproval}
        loading={requestingApproval}
      />
    </>
  );
}
