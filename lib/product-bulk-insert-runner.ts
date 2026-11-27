/**

 * Server/client Firestore bulk insert used when a product Excel upload is approved.

 * Auditing uses the original requester's referenceID / userId.

 */



import type { Workbook } from "exceljs";

import {

  addDoc,

  collection,

  getDocs,

  query,

  where,

  updateDoc,

  serverTimestamp,

  DocumentData,

} from "firebase/firestore";

import { db } from "@/lib/firebase";
import {
  addMissingTechnicalSpecificationTemplateSpecs,
  loadTechnicalSpecificationTemplates,
} from "@/lib/product-technical-specification-templates";

import {

  logProductEvent,

  logProductUsageEvent,

  logProductFamilyEvent,

} from "@/lib/auditlogger";



export type ParsedProductRow = {

  usage: string;

  usages: string[];

  productName: string;

  family: string;

  families: { name: string; usage: string }[];

  productType: string;

  productTypeUsage: string;

  productTypeFamily: string;

  productClass: string;

  pricePoint: string;

  brandOrigin: string;

  supplierBrand: string;

  imageURL: string;

  dimensionalURL: string;

  illuminanceURL: string;

  // BASIC commercial

  unitCost: string;

  length: string;

  width: string;

  height: string;

  pcsPerCarton: string;

  factoryAddress: string;

  portOfDischarge: string;

  supplierModelCode: string;

  countries: string;

  moq: string;

  warrantyNumber: string;

  warrantyPeriod: string;

  // Commercial type

  commercialType: string; // "BASIC" | "LIGHT" | "POLE"

  // POLE

  poleQtyPerContainer: string;

  poleLandedCost: string;

  poleSrp: string;

  // LIGHT single

  lightSingleUnitCost: string;

  lightSingleLength: string;

  lightSingleWidth: string;

  lightSingleHeight: string;

  lightSingleQtyPerBox: string;

  lightSingleLandedCost: string;

  lightSingleSrp: string;

  // LIGHT multiple (pipe-delimited per field)

  lightMultiItemNames: string;   // "item1 | item2 | ..."

  lightMultiUnitCosts: string;

  lightMultiLengths: string;

  lightMultiWidths: string;

  lightMultiHeights: string;

  lightMultiQtyPerBoxes: string;

  lightMultiLandedCosts: string;

  lightMultiSrps: string;

  lightMultiTotalUnitCost: string;

  lightMultiTotalLandedCost: string;

  lightMultiTotalSrp: string;

  // row meta

  wsIndex: number;

  rowIndex: number;

  specValues: Record<string, string>;

};



export type ExcelColumnsByWs = Record<string, { title: string; specId: string; col: number }[]>;



type CategoryType = { id: string; name: string };

type ProductFamily = { id: string; name: string; categoryTypeId: string };

type ProductType = { id: string; name: string; productFamilyId: string; categoryTypeId: string };

type Supplier = { supplierId: string; company: string; supplierBrand?: string };

type TemplateSpec = { id: string; title: string; specs: { specId: string }[]; sortOrder?: number };



const cleanVal = (val: unknown): string => {

  if (val === null || val === undefined) return "";

  if (typeof val === "number") return val.toString();

  const s = val.toString().trim();

  return s === "-" ? "" : s;

};

const splitExcelList = (value: string): string[] =>
  value.split("|").map(item => item.trim()).filter(Boolean);

const splitExcelListPreservingEmpty = (value: string): string[] =>
  value.trim() ? value.split("|").map(item => item.trim()) : [];



/* ─────────────────────────────────────────────────────────────────

 * Build excel column map from workbook (spec columns only)

 * ───────────────────────────────────────────────────────────────── */

export function buildExcelColumnsMapFromWorkbook(workbook: Workbook): ExcelColumnsByWs {

  const out: ExcelColumnsByWs = {};



  for (let wsIndex = 0; wsIndex < workbook.worksheets.length; wsIndex++) {

    const ws = workbook.worksheets[wsIndex];

    const h1 = ws.getRow(1);

    const h2 = ws.getRow(2);

    const hasMultipleFamilyColumns = cleanVal(h1.getCell(4).value).toLowerCase() === "product family usage";
    const hasProductTypeColumn = hasMultipleFamilyColumns || cleanVal(h1.getCell(4).value).toLowerCase() === "product type";
    const staticColumnOffset = hasMultipleFamilyColumns ? 4 : hasProductTypeColumn ? 1 : 0;



    const cols: { title: string; specId: string; col: number }[] = [];



    for (let col = 1; col <= ws.columnCount; col++) {

      const specId    = cleanVal(h1.getCell(col).value);

      const groupTitle = cleanVal(h2.getCell(col).value);



      // Skip static product fields, including Supplier Model Code.

      if (col < 10 + staticColumnOffset) continue;



      // Skip all known non-spec headers

      const SKIP_SPECS = [

        "COMMERCIAL DETAILS", "DRAWINGS", "WARRANTY",

        "POLE", "LIGHT (SINGLE DIMENSION)", "LIGHT (MULTIPLE DIMENSION)",

      ];

      const SKIP_H1 = [

        "Unit Cost", "Length", "Width", "Height", "pcs/carton",

        "Factory Address", "Port of Discharge",

        "Dimensional Drawing", "Illuminance Level",

        "Available Countries", "MOQ",

        "Warranty Number", "Warranty Period",

        "Commercial Type",

        "POLE - Qty Per Container", "POLE - Landed Cost", "POLE - SRP",

        "LIGHT (Single) - Unit Cost", "LIGHT (Single) - Length", "LIGHT (Single) - Width",

        "LIGHT (Single) - Height", "LIGHT (Single) - Qty/Box",

        "LIGHT (Single) - Landed Cost", "LIGHT (Single) - SRP",

        "LIGHT (Multiple) - Item Names", "LIGHT (Multiple) - Unit Costs",

        "LIGHT (Multiple) - Lengths", "LIGHT (Multiple) - Widths",

        "LIGHT (Multiple) - Heights", "LIGHT (Multiple) - Qty/Boxes",

        "LIGHT (Multiple) - Landed Costs", "LIGHT (Multiple) - SRPs",

      ];



      if (SKIP_SPECS.includes(groupTitle)) continue;

      if (SKIP_H1.includes(specId)) continue;



      if (!groupTitle || !specId) continue;



      cols.push({ title: groupTitle, specId, col });

    }



    out[String(wsIndex)] = cols;

  }



  return out;

}



/* ─────────────────────────────────────────────────────────────────

 * Parse a workbook into flat rows

 * ───────────────────────────────────────────────────────────────── */

export function parseWorkbookRowsNew(workbook: Workbook): ParsedProductRow[] {

  const result: ParsedProductRow[] = [];



  const extractHyperlink = (cell: any): string => {

    if (!cell) return "";

    const v = cell.value;

    if (!v) return "";

    if (typeof v === "object") {

      if (v.hyperlink) return v.hyperlink;

      if (v.text) return v.text;

      return String(v);

    }

    return cleanVal(v);

  };



  const convertDrive = (url?: string): string => {

    if (!url) return "";

    if (!url.includes("drive.google.com")) return url;

    const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);

    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);

    const fileId = m1?.[1] || m2?.[1] || "";

    return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;

  };



  for (let wsIndex = 0; wsIndex < workbook.worksheets.length; wsIndex++) {

    const ws = workbook.worksheets[wsIndex];

    const h1 = ws.getRow(1);

    const h2 = ws.getRow(2);

    const hasMultipleFamilyColumns = cleanVal(h1.getCell(4).value).toLowerCase() === "product family usage";
    const hasProductTypeColumn = hasMultipleFamilyColumns || cleanVal(h1.getCell(4).value).toLowerCase() === "product type";
    const staticColumnOffset = hasMultipleFamilyColumns ? 4 : hasProductTypeColumn ? 1 : 0;
    const productTypeColumn = hasMultipleFamilyColumns ? 5 : hasProductTypeColumn ? 4 : -1;



    // Build column index maps

    const specCols: { title: string; specId: string; col: number }[] = [];



    interface ColMap {

      unitCost: number; length: number; width: number; height: number;

      pcsPerCarton: number; factoryAddress: number; portOfDischarge: number;

      dimensionalURL: number; illuminanceURL: number;

      countries: number; moq: number;

      warrantyNumber: number; warrantyPeriod: number;

      commercialType: number;

      poleQty: number; poleLanded: number; poleSrp: number;

      lightSingleUC: number; lightSingleL: number; lightSingleW: number;

      lightSingleH: number; lightSingleQty: number; lightSingleLanded: number; lightSingleSrp: number;

      lightMultiItemNames: number; lightMultiUC: number; lightMultiL: number;

      lightMultiW: number; lightMultiH: number; lightMultiQty: number;

      lightMultiLanded: number; lightMultiSrp: number;

      lightMultiTotalUC: number; lightMultiTotalLanded: number; lightMultiTotalSrp: number;

    }



    const cm: ColMap = {

      unitCost: -1, length: -1, width: -1, height: -1,

      pcsPerCarton: -1, factoryAddress: -1, portOfDischarge: -1,

      dimensionalURL: -1, illuminanceURL: -1,

      countries: -1, moq: -1,

      warrantyNumber: -1, warrantyPeriod: -1,

      commercialType: -1,

      poleQty: -1, poleLanded: -1, poleSrp: -1,

      lightSingleUC: -1, lightSingleL: -1, lightSingleW: -1,

      lightSingleH: -1, lightSingleQty: -1, lightSingleLanded: -1, lightSingleSrp: -1,

      lightMultiItemNames: -1, lightMultiUC: -1, lightMultiL: -1,

      lightMultiW: -1, lightMultiH: -1, lightMultiQty: -1,

      lightMultiLanded: -1, lightMultiSrp: -1,

      lightMultiTotalUC: -1, lightMultiTotalLanded: -1, lightMultiTotalSrp: -1,

    };



    // Multi-row column arrays (for pipe-joining)

    const multiItemNameCols: number[] = [];

    const multiUCCols: number[] = [];

    const multiLCols: number[] = [];

    const multiWCols: number[] = [];

    const multiHCols: number[] = [];

    const multiQtyCols: number[] = [];

    const multiLandedCols: number[] = [];

    const multiSrpCols: number[] = [];



    for (let col = 1; col <= ws.columnCount; col++) {

      const spec  = cleanVal(h1.getCell(col).value);

      const group = cleanVal(h2.getCell(col).value);



      if (col < 10 + staticColumnOffset) continue;



      // Static commercial cols (old BASIC format)

      if (spec === "Unit Cost" && group === "COMMERCIAL DETAILS") { cm.unitCost = col; continue; }

      if (spec === "Length" && group === "") { cm.length = col; continue; }

      if (spec === "Width") { cm.width = col; continue; }

      if (spec === "Height") { cm.height = col; continue; }

      if (spec === "pcs/carton") { cm.pcsPerCarton = col; continue; }

      if (spec === "Factory Address") { cm.factoryAddress = col; continue; }

      if (spec === "Port of Discharge") { cm.portOfDischarge = col; continue; }

      if (spec === "Dimensional Drawing") { cm.dimensionalURL = col; continue; }

      if (spec === "Illuminance Level") { cm.illuminanceURL = col; continue; }

      if (spec === "Available Countries") { cm.countries = col; continue; }

      if (spec === "MOQ") { cm.moq = col; continue; }

      if (spec === "Warranty Number") { cm.warrantyNumber = col; continue; }

      if (spec === "Warranty Period") { cm.warrantyPeriod = col; continue; }

      if (spec === "Commercial Type") { cm.commercialType = col; continue; }



      // POLE

      if (spec === "POLE - Qty Per Container") { cm.poleQty = col; continue; }

      if (spec === "POLE - Landed Cost") { cm.poleLanded = col; continue; }

      if (spec === "POLE - SRP") { cm.poleSrp = col; continue; }



      // LIGHT Single

      if (spec === "LIGHT (Single) - Unit Cost") { cm.lightSingleUC = col; continue; }

      if (spec === "LIGHT (Single) - Length") { cm.lightSingleL = col; continue; }

      if (spec === "LIGHT (Single) - Width") { cm.lightSingleW = col; continue; }

      if (spec === "LIGHT (Single) - Height") { cm.lightSingleH = col; continue; }

      if (spec === "LIGHT (Single) - Qty/Box") { cm.lightSingleQty = col; continue; }

      if (spec === "LIGHT (Single) - Landed Cost") { cm.lightSingleLanded = col; continue; }

      if (spec === "LIGHT (Single) - SRP") { cm.lightSingleSrp = col; continue; }



      // LIGHT Multiple — fixed 8 pipe-delimited columns (no numbering)

      if (spec === "LIGHT (Multiple) - Item Names")   { multiItemNameCols.push(col); continue; }

      if (spec === "LIGHT (Multiple) - Unit Costs")   { multiUCCols.push(col); continue; }

      if (spec === "LIGHT (Multiple) - Lengths")      { multiLCols.push(col); continue; }

      if (spec === "LIGHT (Multiple) - Widths")       { multiWCols.push(col); continue; }

      if (spec === "LIGHT (Multiple) - Heights")      { multiHCols.push(col); continue; }

      if (spec === "LIGHT (Multiple) - Qty/Boxes")    { multiQtyCols.push(col); continue; }

      if (spec === "LIGHT (Multiple) - Landed Costs") { multiLandedCols.push(col); continue; }

      if (spec === "LIGHT (Multiple) - SRPs")         { multiSrpCols.push(col); continue; }



      // LIGHT Multiple Totals (download-only)

      if (spec === "LIGHT (Multiple) - Total Unit Cost")   { cm.lightMultiTotalUC = col; continue; }

      if (spec === "LIGHT (Multiple) - Total Landed Cost") { cm.lightMultiTotalLanded = col; continue; }

      if (spec === "LIGHT (Multiple) - Total SRP")         { cm.lightMultiTotalSrp = col; continue; }



      // Skip group-only labels

      const SKIP_GROUPS = ["COMMERCIAL DETAILS", "DRAWINGS", "WARRANTY", "POLE", "LIGHT (SINGLE DIMENSION)", "LIGHT (MULTIPLE DIMENSION)"];

      if (SKIP_GROUPS.includes(group)) continue;



      if (!group || !spec) continue;

      specCols.push({ title: group, specId: spec, col });

    }



    const getCell = (row: any, colIdx: number) =>

      colIdx > 0 ? cleanVal(row.getCell(colIdx).value) : "";

    const cleanCM = (v: string) => v.replace(/[^0-9.]/g, "");

    const joinCols = (row: any, cols: number[]) =>

      cols.map((c) => cleanVal(row.getCell(c).value)).join(" | ");



    let lastUsage = "", lastFamily = "", lastFamilyUsage = "", lastProductType = "";
    let lastProductTypeUsage = "", lastProductTypeFamily = "", lastClass = "", lastPP = "";

    let lastBO = "", lastSB = "", lastImg = "";


    for (let r = 4; r <= ws.actualRowCount; r++) {

      const row = ws.getRow(r);



      const usage        = cleanVal(row.getCell(1).value) || lastUsage;

      const productName  = cleanVal(row.getCell(2).value) || "";

      const family       = cleanVal(row.getCell(3).value) || lastFamily;

      const familyUsage  = hasMultipleFamilyColumns ? cleanVal(row.getCell(4).value) || lastFamilyUsage : "";

      const productType  = productTypeColumn > 0 ? cleanVal(row.getCell(productTypeColumn).value) || lastProductType : "";

      const productTypeUsage = hasMultipleFamilyColumns
        ? cleanVal(row.getCell(6).value) || lastProductTypeUsage
        : "";

      const productTypeFamily = hasMultipleFamilyColumns
        ? cleanVal(row.getCell(7).value) || lastProductTypeFamily
        : "";

      const productClass = cleanVal(row.getCell(4 + staticColumnOffset).value) || lastClass;

      const pricePoint   = cleanVal(row.getCell(5 + staticColumnOffset).value) || lastPP;

      const brandOrigin  = cleanVal(row.getCell(6 + staticColumnOffset).value) || lastBO;

      const supplierBrand = cleanVal(row.getCell(7 + staticColumnOffset).value) || lastSB;

      const imageURL     = convertDrive(extractHyperlink(row.getCell(8 + staticColumnOffset))) || lastImg;

      const supplierModelCodeStatic = cleanVal(row.getCell(9 + staticColumnOffset).value);

      const usages = splitExcelList(usage);
      const familyNames = splitExcelList(family);
      const familyUsageNames = hasMultipleFamilyColumns
        ? splitExcelListPreservingEmpty(familyUsage)
        : [usages[0] ?? ""];
      const parsedFamilies = familyNames.map((name, index) => ({ name, usage: familyUsageNames[index] ?? "" }));
      const resolvedProductTypeUsage = hasMultipleFamilyColumns ? productTypeUsage : (familyUsageNames[0] ?? "");
      const resolvedProductTypeFamily = hasMultipleFamilyColumns ? productTypeFamily : (familyNames[0] ?? "");

      lastUsage = usage; lastFamily = family; lastFamilyUsage = familyUsage;
      lastProductType = productType; lastProductTypeUsage = productTypeUsage; lastProductTypeFamily = productTypeFamily;
      lastClass = productClass;

      lastPP = pricePoint; lastBO = brandOrigin; lastSB = supplierBrand; lastImg = imageURL;



      if (usages.length === 0 || parsedFamilies.length === 0) continue;

      if (!productClass && !pricePoint && !brandOrigin && !supplierBrand) continue;



      const specValues: Record<string, string> = {};

      for (const sc of specCols) {

        specValues[`${sc.title}||${sc.specId}`] = cleanVal(row.getCell(sc.col).value);

      }



      result.push({

        usage: usages.join(" | "),
        usages,
        productName,
        family: familyNames.join(" | "),
        families: parsedFamilies,
        productType,
        productTypeUsage: resolvedProductTypeUsage,
        productTypeFamily: resolvedProductTypeFamily,
        productClass, pricePoint, brandOrigin, supplierBrand, imageURL,

        dimensionalURL: convertDrive(extractHyperlink(cm.dimensionalURL > 0 ? row.getCell(cm.dimensionalURL) : null)),

        illuminanceURL: convertDrive(extractHyperlink(cm.illuminanceURL > 0 ? row.getCell(cm.illuminanceURL) : null)),

        unitCost: getCell(row, cm.unitCost),

        length: cleanCM(getCell(row, cm.length)),

        width: cleanCM(getCell(row, cm.width)),

        height: cleanCM(getCell(row, cm.height)),

        pcsPerCarton: getCell(row, cm.pcsPerCarton),

        factoryAddress: getCell(row, cm.factoryAddress),

        portOfDischarge: getCell(row, cm.portOfDischarge),

        supplierModelCode: supplierModelCodeStatic,

        countries: getCell(row, cm.countries),

        moq: getCell(row, cm.moq),

        warrantyNumber: getCell(row, cm.warrantyNumber),

        warrantyPeriod: getCell(row, cm.warrantyPeriod),

        commercialType: getCell(row, cm.commercialType) || "BASIC",

        poleQtyPerContainer: getCell(row, cm.poleQty),

        poleLandedCost: getCell(row, cm.poleLanded),

        poleSrp: getCell(row, cm.poleSrp),

        lightSingleUnitCost: getCell(row, cm.lightSingleUC),

        lightSingleLength: cleanCM(getCell(row, cm.lightSingleL)),

        lightSingleWidth: cleanCM(getCell(row, cm.lightSingleW)),

        lightSingleHeight: cleanCM(getCell(row, cm.lightSingleH)),

        lightSingleQtyPerBox: getCell(row, cm.lightSingleQty),

        lightSingleLandedCost: getCell(row, cm.lightSingleLanded),

        lightSingleSrp: getCell(row, cm.lightSingleSrp),

        lightMultiItemNames: joinCols(row, multiItemNameCols),

        lightMultiUnitCosts: joinCols(row, multiUCCols),

        lightMultiLengths: joinCols(row, multiLCols),

        lightMultiWidths: joinCols(row, multiWCols),

        lightMultiHeights: joinCols(row, multiHCols),

        lightMultiQtyPerBoxes: joinCols(row, multiQtyCols),

        lightMultiLandedCosts: joinCols(row, multiLandedCols),

        lightMultiSrps: joinCols(row, multiSrpCols),

        lightMultiTotalUnitCost: getCell(row, cm.lightMultiTotalUC),

        lightMultiTotalLandedCost: getCell(row, cm.lightMultiTotalLanded),

        lightMultiTotalSrp: getCell(row, cm.lightMultiTotalSrp),

        wsIndex, rowIndex: r, specValues,

      });

    }

  }



  return result;

}



/* ─────────────────────────────────────────────────────────────────

 * Build commercialDetails from a parsed row

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

    // Check if multiple dimension

    const hasMulti = row.lightMultiItemNames && row.lightMultiItemNames.trim() !== "";



    if (hasMulti) {

      const parseArr = (s: string) => s.split("|").map((v) => v.trim()).filter(Boolean);

      const names    = parseArr(row.lightMultiItemNames);

      const ucs      = parseArr(row.lightMultiUnitCosts);

      const lengths  = parseArr(row.lightMultiLengths);

      const widths   = parseArr(row.lightMultiWidths);

      const heights  = parseArr(row.lightMultiHeights);

      const qtys     = parseArr(row.lightMultiQtyPerBoxes);

      const landeds  = parseArr(row.lightMultiLandedCosts);

      const srps     = parseArr(row.lightMultiSrps);



      const multiRows = names.map((name, i) => ({

        itemName    : name,

        unitCost    : parseFloat(ucs[i] || "0") || 0,

        length      : parseFloat(lengths[i] || "0") || 0,

        width       : parseFloat(widths[i] || "0") || 0,

        height      : parseFloat(heights[i] || "0") || 0,

        qtyPerCarton: parseInt(qtys[i] || "1") || 1,

        landed      : parseFloat(landeds[i] || "0") || 0,

        srp         : parseFloat(srps[i] || "0") || 0,

      }));



      const totalLanded = multiRows.reduce((s, r) => s + r.landed, 0);



      return {

        ...base,

        calculationType: "LIGHTS",

        useArrayInput: true,

        multiRows,

        landedCost: totalLanded || null,

        srp: multiRows[0]?.srp || null,

      };

    }



    // Single dimension

    return {

      ...base,

      calculationType: "LIGHTS",

      useArrayInput: false,

      unitCost: row.lightSingleUnitCost ? parseFloat(row.lightSingleUnitCost) : null,

      packaging: {

        length: row.lightSingleLength ? `${parseFloat(row.lightSingleLength)} cm` : null,

        width : row.lightSingleWidth  ? `${parseFloat(row.lightSingleWidth)} cm`  : null,

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

      width : row.width  ? `${parseFloat(row.width)} cm`  : null,

      height: row.height ? `${parseFloat(row.height)} cm` : null,

    },

    pcsPerCarton: row.pcsPerCarton ? parseInt(row.pcsPerCarton) : null,

  };

}



/* ─────────────────────────────────────────────────────────────────

 * Firestore helpers (shared)

 * ───────────────────────────────────────────────────────────────── */

async function findCategoryType(name: string, referenceID: string, userId: string): Promise<CategoryType | null> {

  const q = query(collection(db, "categoryTypes"), where("name", "==", name), where("isActive", "==", true));

  const snap = await getDocs(q);

  if (!snap.empty) {

    const d = snap.docs[0];

    return { id: d.id, name: (d.data() as DocumentData).name };

  }

  const newDoc = await addDoc(collection(db, "categoryTypes"), {

    name, isActive: true, createdAt: serverTimestamp(),

    whatHappened: "Product Usage Added (Excel Upload)", date_updated: serverTimestamp(),

  });

  await logProductUsageEvent({

    whatHappened: "Product Usage Added", productUsageId: newDoc.id, productUsageName: name,

    referenceID, userId, extra: { source: "excel_upload" },

  });

  return { id: newDoc.id, name };

}



async function findProductFamily(categoryTypeId: string, name: string, referenceID: string, userId: string): Promise<ProductFamily | null> {

  const q = query(

    collection(db, "productFamilies"),

    where("categoryTypeId", "==", categoryTypeId),

    where("name", "==", name),

    where("isActive", "==", true),

  );

  const snap = await getDocs(q);

  if (!snap.empty) {

    const d = snap.docs[0];

    const data = d.data() as DocumentData;

    return { id: d.id, name: data.name, categoryTypeId: data.categoryTypeId };

  }

  const newDoc = await addDoc(collection(db, "productFamilies"), {

    name, categoryTypeId, isActive: true, createdAt: serverTimestamp(),

    whatHappened: "Product Family Added (Excel Upload)", date_updated: serverTimestamp(),

  });

  await logProductFamilyEvent({

    whatHappened: "Product Family Added", productFamilyId: newDoc.id, productFamilyName: name,

    productUsageId: categoryTypeId, referenceID, userId, extra: { source: "excel_upload" },

  });

  return { id: newDoc.id, name, categoryTypeId };

}

async function findProductType(
  productFamilyId: string,
  categoryTypeId: string,
  name: string,
): Promise<ProductType | null> {
  const productTypeName = name.trim();
  if (!productTypeName) return null;

  const snap = await getDocs(query(collection(db, "productTypes"), where("productFamilyId", "==", productFamilyId)));
  const existing = snap.docs.find((productType) => {
    const data = productType.data() as DocumentData;
    return data.isActive === true && String(data.name ?? "").toLowerCase() === productTypeName.toLowerCase();
  });
  if (existing) {
    const data = existing.data() as DocumentData;
    return { id: existing.id, name: data.name, productFamilyId, categoryTypeId };
  }

  const newDoc = await addDoc(collection(db, "productTypes"), {
    name: productTypeName,
    productFamilyId,
    categoryTypeId,
    isActive: true,
    createdAt: serverTimestamp(),
    whatHappened: "Product Type Added (Excel Upload)",
    date_updated: serverTimestamp(),
  });
  return { id: newDoc.id, name: productTypeName, productFamilyId, categoryTypeId };
}

async function resolveRowClassifications(
  row: ParsedProductRow,
  referenceID: string,
  userId: string,
) {
  const usageNames = row.usages?.length ? row.usages : splitExcelList(row.usage);
  const familyRows = row.families?.length
    ? row.families
    : [{ name: row.family, usage: usageNames[0] ?? "" }];
  if (usageNames.length !== 1) {
    throw new Error(`Exactly one Product Usage is allowed in row ${row.rowIndex}.`);
  }
  if (familyRows.some((family) => family.usage.toLowerCase() !== usageNames[0].toLowerCase())) {
    throw new Error(`All Product Families must belong to the selected Product Usage in row ${row.rowIndex}.`);
  }
  const productTypeUsage = row.productTypeUsage || usageNames[0] || "";
  const productTypeFamily = row.productTypeFamily || familyRows[0]?.name || "";
  const categories = new Map<string, CategoryType>();
  for (const usageName of usageNames) {
    const category = await findCategoryType(usageName, referenceID, userId);
    if (!category) throw new Error(`Could not resolve Product Usage "${usageName}" in row ${row.rowIndex}.`);
    categories.set(usageName.toLowerCase(), category);
  }

  const families: { category: CategoryType; family: ProductFamily }[] = [];
  for (const item of familyRows) {
    const category = categories.get(item.usage.toLowerCase());
    if (!category) {
      throw new Error(`Product Family "${item.name}" references unknown Product Usage "${item.usage}" in row ${row.rowIndex}.`);
    }
    const family = await findProductFamily(category.id, item.name, referenceID, userId);
    if (!family) throw new Error(`Could not resolve Product Family "${item.name}" in row ${row.rowIndex}.`);
    families.push({ category, family });
  }

  const typeCategory = categories.get(productTypeUsage.toLowerCase());
  if (!typeCategory) {
    throw new Error(`Product Type references unknown Product Usage "${productTypeUsage}" in row ${row.rowIndex}.`);
  }
  const typeParent = families.find(({ category, family }) =>
    category.id === typeCategory.id && family.name.toLowerCase() === productTypeFamily.toLowerCase(),
  );
  if (!typeParent) {
    throw new Error(`Product Type parent "${productTypeFamily}" under "${productTypeUsage}" is not listed in row ${row.rowIndex}.`);
  }

  return { categories: Array.from(categories.values()), families, typeParent };
}



async function findSupplier(brand: string): Promise<Supplier | null> {

  if (!brand) return null;

  const q = query(collection(db, "suppliers"), where("supplierBrand", "==", brand), where("isActive", "==", true));

  const snap = await getDocs(q);

  if (snap.empty) return null;

  const d = snap.docs[0];

  const data = d.data();

  return { supplierId: d.id, company: data.company, supplierBrand: data.supplierBrand || "" };

}



async function createMissingTemplateSpecs(

  categoryTypeId: string, productFamilyId: string, productTypeId: string,

  excelColumns: { title: string; specId: string }[],

) {

  await addMissingTechnicalSpecificationTemplateSpecs(
    { categoryTypeId, productFamilyId, productTypeId },
    excelColumns,
  );

}



async function findTemplateSpecs(categoryTypeId: string, productFamilyId: string, productTypeId: string): Promise<TemplateSpec[]> {
  const result = await loadTechnicalSpecificationTemplates({ categoryTypeId, productFamilyId, productTypeId });
  return result.templates.map((template) => ({
    id: template.id,
    title: template.title,
    specs: template.specs.flatMap((spec) => spec.specId ? [{ specId: spec.specId }] : []),
    sortOrder: template.sortOrder ?? 999,
  }));

}



async function syncExistingProductsToTemplate(categoryTypeId: string, productFamilyId: string, productTypeId: string) {
  const { templates } = await loadTechnicalSpecificationTemplates({ categoryTypeId, productFamilyId, productTypeId });



  const productSnap = await getDocs(collection(db, "products"));

  for (const productDoc of productSnap.docs) {

    const data = productDoc.data();

    const families = data.productFamilies as { productFamilyId?: string; productUsageId?: string }[] | undefined;
    const hasFamily = families?.some(
      (family) => family.productFamilyId === productFamilyId && family.productUsageId === categoryTypeId,
    );
    if (!hasFamily) continue;
    const productTypes = data.productTypes as { productTypeId?: string }[] | undefined;
    if (!productTypes?.some((type) => type.productTypeId === productTypeId)) continue;

    const existingSpecs = (data.technicalSpecifications || []) as {
      title: string;
      specs: { specId: string; value?: string }[];
    }[];

    const mergedSpecs = templates.map((template) => {

      const existingGroup = existingSpecs.find((group) => group.title === template.title);

      return {

        technicalSpecificationId: template.id,

        title: template.title,

        specs: template.specs.flatMap((spec) => {
          if (!spec.specId) return [];
          const existingRow = existingGroup?.specs.find((row) => row.specId === spec.specId);
          return [{ specId: spec.specId, value: existingRow?.value || "" }];
        }),

      };

    });

    await updateDoc(productDoc.ref, { technicalSpecifications: mergedSpecs, updatedAt: serverTimestamp() });

  }

}



/* ─────────────────────────────────────────────────────────────────

 * Main bulk insert

 * ───────────────────────────────────────────────────────────────── */

export async function insertParsedProductBulk(params: {

  rows: ParsedProductRow[];

  excelColumnsByWsIndex: ExcelColumnsByWs;

  referenceID: string;

  userId: string;

  filename: string;

}): Promise<{ inserted: number }> {

  const { rows, excelColumnsByWsIndex, referenceID, userId, filename } = params;



  const existingSnap = await getDocs(collection(db, "products"));

  let productCounter = existingSnap.size;

  const syncedFamilies = new Set<string>();

  let totalInserted = 0;



  for (const row of rows) {

    const { categories, families, typeParent } = await resolveRowClassifications(row, referenceID, userId);
    const productType = await findProductType(typeParent.family.id, typeParent.category.id, row.productType);
    if (!productType) throw new Error(`Missing Product Type for row ${row.rowIndex} in worksheet ${row.wsIndex + 1}.`);
    const supplier = await findSupplier(row.supplierBrand);



    const excelColumns = excelColumnsByWsIndex[String(row.wsIndex)] ?? [];

    const syncKey = `${typeParent.category.id}_${typeParent.family.id}_${productType.id}`;

    if (!syncedFamilies.has(syncKey)) {

      await createMissingTemplateSpecs(typeParent.category.id, typeParent.family.id, productType.id, excelColumns);

      await syncExistingProductsToTemplate(typeParent.category.id, typeParent.family.id, productType.id);

      syncedFamilies.add(syncKey);

    }



    const templateSpecs = await findTemplateSpecs(typeParent.category.id, typeParent.family.id, productType.id);

    const productSpecs = templateSpecs.map((template) => ({

      technicalSpecificationId: template.id,

      title: template.title,

      specs: template.specs.map((ts) => ({

        specId: ts.specId,

        value : row.specValues[`${template.title}||${ts.specId}`] ?? "",

      })),

    }));



    productCounter++;

    const refID = `PROD-SPF-${productCounter.toString().padStart(5, "0")}`;

    const commercialDetails = buildCommercialDetails(row);



    const newDocRef = await addDoc(collection(db, "products"), {

      productReferenceID: refID,

      productName: row.productName,

      productClass: row.productClass,

      pricePoint: row.pricePoint,

      brandOrigin: row.brandOrigin,

      supplier,

      mainImage: row.imageURL ? { url: row.imageURL } : null,

      dimensionalDrawing: row.dimensionalURL ? { url: row.dimensionalURL } : null,

      illuminanceDrawing: row.illuminanceURL ? { url: row.illuminanceURL } : null,

      categoryTypes: categories.map((category) => ({
        productUsageId: category.id,
        categoryTypeName: category.name,
      })),
      productFamilies: families.map(({ category, family }) => ({
        productFamilyId: family.id,
        productFamilyName: family.name,
        productUsageId: category.id,
      })),
      productTypes: [{
        productTypeId: productType.id,
        productTypeName: productType.name,
        productFamilyId: typeParent.family.id,
        productUsageId: typeParent.category.id,
      }],
      technicalSpecifications: productSpecs,

      commercialDetails,

      countries: row.countries ? row.countries.split("|").map((c) => c.trim()).filter(Boolean) : [],

      isActive: true,

      createdAt: serverTimestamp(),

      createdBy: userId,

      referenceID,

      whatHappened: "Product Added",

      date_updated: serverTimestamp(),

    });



    await logProductEvent({

      whatHappened: "Product Added",

      productId: newDocRef.id,

      productReferenceID: refID,

      productClass: row.productClass,

      pricePoint: row.pricePoint,

      brandOrigin: row.brandOrigin,

      supplier: supplier ?? null,

      categoryTypes: categories.map((category) => ({
        productUsageId: category.id,
        categoryTypeName: category.name,
      })),
      productFamilies: families.map(({ category, family }) => ({
        productFamilyId: family.id,
        productFamilyName: family.name,
        productUsageId: category.id,
      })),
      productTypes: [{
        productTypeId: productType.id,
        productTypeName: productType.name,
      }],
      mainImage: row.imageURL ? { url: row.imageURL } : null,

      dimensionalDrawing: row.dimensionalURL ? { url: row.dimensionalURL } : null,

      illuminanceDrawing: row.illuminanceURL ? { url: row.illuminanceURL } : null,

      technicalSpecifications: productSpecs,

      referenceID, userId,

      extra: { source: "excel_upload_for_approval", filename },

    });



    totalInserted++;

  }



  await logProductEvent({

    whatHappened: "Product Bulk Upload",

    inserted: totalInserted,

    referenceID, userId,

    extra: { source: "excel_upload_for_approval", filename },

  });



  return { inserted: totalInserted };

}