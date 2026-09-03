/**

 * Server/client Firestore bulk insert used when a product CSV upload is approved.

 * Auditing uses the original requester's referenceID / userId.

 */

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

  logProductEvent,

  logProductUsageEvent,

  logProductFamilyEvent,

} from "@/lib/auditlogger";



export type ParsedProductRow = {

  usage: string;

  productName: string;

  family: string;

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



export type CSVColumnsMap = { title: string; specId: string; col: number }[];



type CategoryType = { id: string; name: string };

type ProductFamily = { id: string; name: string; categoryTypeId: string };

type Supplier = { supplierId: string; company: string; supplierBrand?: string };

type TemplateSpec = { id: string; title: string; specs: { specId: string }[]; sortOrder?: number };



const cleanVal = (val: unknown): string => {

  if (val === null || val === undefined) return "";

  if (typeof val === "number") return val.toString();

  const s = val.toString().trim();

  return s === "-" ? "" : s;

};



/* ─────────────────────────────────────────────────────────────────

 * Parse CSV text into rows

 * ───────────────────────────────────────────────────────────────── */

export function parseCSVRows(csvText: string): ParsedProductRow[] {
  const result: ParsedProductRow[] = [];
  
  // Parse CSV
  const rows = parseCSV(csvText);
  if (rows.length < 2) return result; // Need header + at least one data row
  
  const headers = rows[0];
  const dataRows = rows.slice(1);
  
  // Build column index map
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    colMap[h] = i;
  });
  
  const getCol = (row: string[], colName: string): string => {
    const idx = colMap[colName];
    return idx !== undefined && idx < row.length ? cleanVal(row[idx]) : "";
  };
  
  const convertDrive = (url?: string): string => {
    if (!url) return "";
    if (!url.includes("drive.google.com")) return url;
    const m1 = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = m1?.[1] || m2?.[1] || "";
    return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000` : url;
  };
  
  const cleanCM = (v: string) => v.replace(/[^0-9.]/g, "");
  
  let lastUsage = "", lastFamily = "", lastClass = "", lastPP = "";
  let lastBO = "", lastSB = "", lastImg = "";
  
  for (const row of dataRows) {
    const usage = getCol(row, "Product Usage") || lastUsage;
    const productName = getCol(row, "Product Name") || "";
    const family = getCol(row, "Product Family") || lastFamily;
    const productClass = getCol(row, "Product Class") || lastClass;
    const pricePoint = getCol(row, "Price Point") || lastPP;
    const brandOrigin = getCol(row, "Brand Origin") || lastBO;
    const supplierBrand = getCol(row, "Supplier Brand") || lastSB;
    const imageURL = convertDrive(getCol(row, "Image URL")) || lastImg;
    const supplierModelCode = getCol(row, "Supplier Model Code");
    
    lastUsage = usage; lastFamily = family; lastClass = productClass;
    lastPP = pricePoint; lastBO = brandOrigin; lastSB = supplierBrand; lastImg = imageURL;
    
    if (!usage || !family) continue;
    if (!productClass && !pricePoint && !brandOrigin && !supplierBrand) continue;
    
    // Build spec values from columns that aren't predefined
    const specValues: Record<string, string> = {};
    const SKIP_COLS = [
      "Product Usage", "Product Name", "Product Family", "Product Class", "Price Point",
      "Brand Origin", "Supplier Brand", "Image URL", "Supplier Model Code",
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
      "LIGHT (Multiple) - Total Unit Cost", "LIGHT (Multiple) - Total Landed Cost", "LIGHT (Multiple) - Total SRP",
    ];
    
    headers.forEach((h, i) => {
      if (!SKIP_COLS.includes(h) && i < row.length) {
        // For CSV, we use the header as both title and specId since we don't have group structure
        specValues[`${h}||${h}`] = cleanVal(row[i]);
      }
    });
    
    result.push({
      usage, productName, family, productClass, pricePoint, brandOrigin, supplierBrand, imageURL,
      dimensionalURL: convertDrive(getCol(row, "Dimensional Drawing")),
      illuminanceURL: convertDrive(getCol(row, "Illuminance Level")),
      unitCost: getCol(row, "Unit Cost"),
      length: cleanCM(getCol(row, "Length")),
      width: cleanCM(getCol(row, "Width")),
      height: cleanCM(getCol(row, "Height")),
      pcsPerCarton: getCol(row, "pcs/carton"),
      factoryAddress: getCol(row, "Factory Address"),
      portOfDischarge: getCol(row, "Port of Discharge"),
      supplierModelCode: supplierModelCode,
      countries: getCol(row, "Available Countries"),
      moq: getCol(row, "MOQ"),
      warrantyNumber: getCol(row, "Warranty Number"),
      warrantyPeriod: getCol(row, "Warranty Period"),
      commercialType: getCol(row, "Commercial Type") || "BASIC",
      poleQtyPerContainer: getCol(row, "POLE - Qty Per Container"),
      poleLandedCost: getCol(row, "POLE - Landed Cost"),
      poleSrp: getCol(row, "POLE - SRP"),
      lightSingleUnitCost: getCol(row, "LIGHT (Single) - Unit Cost"),
      lightSingleLength: cleanCM(getCol(row, "LIGHT (Single) - Length")),
      lightSingleWidth: cleanCM(getCol(row, "LIGHT (Single) - Width")),
      lightSingleHeight: cleanCM(getCol(row, "LIGHT (Single) - Height")),
      lightSingleQtyPerBox: getCol(row, "LIGHT (Single) - Qty/Box"),
      lightSingleLandedCost: getCol(row, "LIGHT (Single) - Landed Cost"),
      lightSingleSrp: getCol(row, "LIGHT (Single) - SRP"),
      lightMultiItemNames: getCol(row, "LIGHT (Multiple) - Item Names"),
      lightMultiUnitCosts: getCol(row, "LIGHT (Multiple) - Unit Costs"),
      lightMultiLengths: getCol(row, "LIGHT (Multiple) - Lengths"),
      lightMultiWidths: getCol(row, "LIGHT (Multiple) - Widths"),
      lightMultiHeights: getCol(row, "LIGHT (Multiple) - Heights"),
      lightMultiQtyPerBoxes: getCol(row, "LIGHT (Multiple) - Qty/Boxes"),
      lightMultiLandedCosts: getCol(row, "LIGHT (Multiple) - Landed Costs"),
      lightMultiSrps: getCol(row, "LIGHT (Multiple) - SRPs"),
      lightMultiTotalUnitCost: getCol(row, "LIGHT (Multiple) - Total Unit Cost"),
      lightMultiTotalLandedCost: getCol(row, "LIGHT (Multiple) - Total Landed Cost"),
      lightMultiTotalSrp: getCol(row, "LIGHT (Multiple) - Total SRP"),
      wsIndex: 0, rowIndex: 0, specValues,
    });
  }
  
  return result;
}

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = "";
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = "";
        if (char === '\r') i++; // Skip \n after \r
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
  }
  
  // Add last cell and row
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }
  
  return rows;
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

  categoryTypeId: string, productFamilyId: string,

  csvColumns: { title: string; specId: string }[],

) {

  const templateSnap = await getDocs(query(

    collection(db, "technicalSpecifications"),

    where("categoryTypeId", "==", categoryTypeId),

    where("productFamilyId", "==", productFamilyId),

    where("isActive", "==", true),

  ));

  const existingTitles = templateSnap.docs.map((d) => d.data().title);

  const groups = new Map<string, { specId: string }[]>();

  for (const col of csvColumns) {

    if (!groups.has(col.title)) groups.set(col.title, []);

    groups.get(col.title)!.push({ specId: col.specId });

  }

  let sortOrder = 0;

  for (const [title, specs] of groups) {

    sortOrder++;

    if (!existingTitles.includes(title)) {

      await addDoc(collection(db, "technicalSpecifications"), {

        categoryTypeId, productFamilyId, title, specs, sortOrder,

        isActive: true, createdAt: serverTimestamp(),

        whatHappened: "Product Added", date_updated: serverTimestamp(),

      });

    } else {

      const existing = templateSnap.docs.find((d) => d.data().title === title);

      if (existing) await updateDoc(existing.ref, { sortOrder, date_updated: serverTimestamp() });

    }

  }

}



async function findTemplateSpecs(categoryTypeId: string, productFamilyId: string): Promise<TemplateSpec[]> {

  const snap = await getDocs(query(

    collection(db, "technicalSpecifications"),

    where("categoryTypeId", "==", categoryTypeId),

    where("productFamilyId", "==", productFamilyId),

    where("isActive", "==", true),

  ));

  return snap.docs

    .map((d) => {

      const data = d.data() as DocumentData;

      return { id: d.id, title: data.title, specs: data.specs || [], sortOrder: data.sortOrder ?? 999 };

    })

    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

}



async function syncExistingProductsToTemplate(categoryTypeId: string, productFamilyId: string) {

  const templateSnap = await getDocs(query(

    collection(db, "technicalSpecifications"),

    where("categoryTypeId", "==", categoryTypeId),

    where("productFamilyId", "==", productFamilyId),

    where("isActive", "==", true),

  ));

  const templates = templateSnap.docs

    .map((d) => ({ id: d.id, title: d.data().title, specs: d.data().specs || [], sortOrder: d.data().sortOrder ?? 999 }))

    .sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));



  const productSnap = await getDocs(collection(db, "products"));

  for (const productDoc of productSnap.docs) {

    const data = productDoc.data();

    const family = data.productFamilies?.[0];

    if (!family) continue;

    if (family.productFamilyId !== productFamilyId || family.productUsageId !== categoryTypeId) continue;

    const existingSpecs = data.technicalSpecifications || [];

    const mergedSpecs = templates.map((template) => {

      const existingGroup = existingSpecs.find((g: any) => g.title === template.title);

      return {

        technicalSpecificationId: template.id,

        title: template.title,

        specs: template.specs.map((spec: any) => {

          const existingRow = existingGroup?.specs?.find((r: any) => r.specId === spec.specId);

          return { specId: spec.specId, value: existingRow?.value || "" };

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

  referenceID: string;

  userId: string;

  filename: string;

}): Promise<{ inserted: number }> {

  const { rows, referenceID, userId, filename } = params;



  const existingSnap = await getDocs(collection(db, "products"));

  let productCounter = existingSnap.size;

  const syncedFamilies = new Set<string>();

  let totalInserted = 0;



  for (const row of rows) {

    const category = await findCategoryType(row.usage, referenceID, userId);

    if (!category) continue;

    const productFamily = await findProductFamily(category.id, row.family, referenceID, userId);

    if (!productFamily) continue;

    const supplier = await findSupplier(row.supplierBrand);



    // CSV doesn't have worksheet structure, so we use empty columns array
    const csvColumns: { title: string; specId: string }[] = [];

    const syncKey = `${category.id}_${productFamily.id}`;

    if (!syncedFamilies.has(syncKey)) {

      await createMissingTemplateSpecs(category.id, productFamily.id, csvColumns);

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

      categoryTypes: [{ productUsageId: category.id, categoryTypeName: category.name }],

      productFamilies: [{ productFamilyId: productFamily.id, productFamilyName: productFamily.name, productUsageId: category.id }],

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

      categoryTypes: [{ productUsageId: category.id, categoryTypeName: category.name }],

      productFamilies: [{ productFamilyId: productFamily.id, productFamilyName: productFamily.name }],

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