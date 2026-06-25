/**
 * lib/auditlogger.ts
 *
 * Centralised audit-trail writer.
 *
 * Collections (one per domain, kept separate for clean querying):
 *   auditLogs_suppliers       — every create / edit / delete on a supplier
 *   auditLogs_products        — every create / edit / delete on a product
 *   auditLogs_productFamilies — every create / edit / delete on a product family
 *   auditLogs_productUsages   — every create / edit / delete on a category type
 */

import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/* ─────────────────────────────────────────────
   Supplier event
───────────────────────────────────────────── */
export type SupplierEventPayload = {
  whatHappened:
    | "Supplier Added"
    | "Supplier Edited"
    | "Supplier Deleted"
    | "Supplier Reactivated"
    | "Supplier Bulk Upload"
    | "Supplier For Approval Requested"
    | "Supplier For Approval Approved"
    | "Supplier For Approval Rejected";

  supplierId?     : string;
  supplierbrandId?: string;
  company?        : string;
  supplierBrand?  : string;

  referenceID?    : string;
  userId?         : string;

  inserted?       : number;
  reactivated?    : number;
  skipped?        : number;
  overwritten?    : number;

  extra?          : Record<string, any>;
};

export async function logSupplierEvent(payload: SupplierEventPayload): Promise<void> {
  try {
    await addDoc(collection(db, "auditLogs_suppliers"), {
      ...payload.extra,
      whatHappened   : payload.whatHappened,
      supplierId     : payload.supplierId      ?? null,
      supplierbrandId: payload.supplierbrandId ?? payload.supplierId ?? null,
      company        : payload.company         ?? null,
      supplierBrand  : payload.supplierBrand   ?? null,
      referenceID    : payload.referenceID     ?? null,
      userId         : payload.userId          ?? null,
      inserted       : payload.inserted        ?? null,
      reactivated    : payload.reactivated     ?? null,
      skipped        : payload.skipped         ?? null,
      overwritten    : payload.overwritten     ?? null,
      date_updated   : serverTimestamp(),
      createdAt      : serverTimestamp(),
    });
  } catch (err) {
    console.warn("[auditLogger] Failed to log supplier event:", err);
  }
}

/* ─────────────────────────────────────────────
   Product event
───────────────────────────────────────────── */
export type ProductEventPayload = {
  whatHappened:
    | "Product Added"
    | "Product Edited"
    | "Product Deleted"
    | "Product Duplicated"
    | "Product Bulk Upload"
    | "Product For Approval Requested"
    | "Product For Approval Approved"
    | "Product For Approval Rejected";

  productId?          : string;
  productReferenceID? : string;
  productClass?       : string;
  pricePoint?         : string;
  brandOrigin?        : string;
  countries?          : string[];
  supplier?           : { supplierId?: string; company?: string; supplierBrand?: string } | null;

  categoryTypes?      : { productUsageId: string; categoryTypeName: string }[];
  productFamilies?    : { productFamilyId: string; productFamilyName: string }[];

  // ── Media ──
  mainImage?          : { url?: string; publicId?: string | null } | null;
  dimensionalDrawing? : { url?: string; publicId?: string | null } | null;
  illuminanceDrawing? : { url?: string; publicId?: string | null } | null;

  // ── Technical specs snapshot ──
  technicalSpecifications?: {
    technicalSpecificationId?: string;
    title: string;
    specs: { specId: string; value: string }[];
  }[];

  // Who did it
  referenceID?        : string;
  userId?             : string;

  // Bulk upload extras
  inserted?           : number;
  skipped?            : number;

  extra?              : Record<string, any>;
};

export async function logProductEvent(payload: ProductEventPayload): Promise<void> {
  try {
    await addDoc(collection(db, "auditLogs_products"), {
      ...payload.extra,
      whatHappened           : payload.whatHappened,
      productId              : payload.productId               ?? null,
      productReferenceID     : payload.productReferenceID      ?? null,
      productClass           : payload.productClass            ?? null,
      pricePoint             : payload.pricePoint              ?? null,
      brandOrigin            : payload.brandOrigin             ?? null,
      supplier               : payload.supplier                ?? null,
      categoryTypes          : payload.categoryTypes           ?? null,
      productFamilies        : payload.productFamilies         ?? null,
      mainImage              : payload.mainImage               ?? null,
      dimensionalDrawing     : payload.dimensionalDrawing      ?? null,
      illuminanceDrawing     : payload.illuminanceDrawing      ?? null,
      technicalSpecifications: payload.technicalSpecifications ?? null,
      referenceID            : payload.referenceID             ?? null,
      userId                 : payload.userId                  ?? null,
      inserted               : payload.inserted                ?? null,
      skipped                : payload.skipped                 ?? null,
      date_updated           : serverTimestamp(),
      createdAt              : serverTimestamp(),
    });
  } catch (err) {
    console.warn("[auditLogger] Failed to log product event:", err);
  }
}

/* ─────────────────────────────────────────────
   Product Family event
───────────────────────────────────────────── */
export type ProductFamilyEventPayload = {
  whatHappened:
    | "Product Family Added"
    | "Product Family Edited"
    | "Product Family Deleted";

  productFamilyId?  : string;
  productFamilyName?: string;
  productUsageId?   : string;

  referenceID?      : string;
  userId?           : string;

  extra?            : Record<string, any>;
};

export async function logProductFamilyEvent(payload: ProductFamilyEventPayload): Promise<void> {
  try {
    await addDoc(collection(db, "auditLogs_productFamilies"), {
      ...payload.extra,
      whatHappened     : payload.whatHappened,
      productFamilyId  : payload.productFamilyId   ?? null,
      productFamilyName: payload.productFamilyName ?? null,
      productUsageId   : payload.productUsageId    ?? null,
      referenceID      : payload.referenceID       ?? null,
      userId           : payload.userId            ?? null,
      date_updated     : serverTimestamp(),
      createdAt        : serverTimestamp(),
    });
  } catch (err) {
    console.warn("[auditLogger] Failed to log product family event:", err);
  }
}

/* ─────────────────────────────────────────────
   Category Type event
───────────────────────────────────────────── */
export type ProductUsageEventPayload = {
  whatHappened:
    | "Product Usage Added"
    | "Product Usage Edited"
    | "Product Usage Deleted";

  productUsageId?  : string;
  productUsageName?: string;

  referenceID?     : string;
  userId?          : string;

  extra?           : Record<string, any>;
};

/* ─────────────────────────────────────────────
   SPF Version History event
───────────────────────────────────────────── */
export type SPFVersionEventPayload = {
  whatHappened:
    | "SPF Created"
    | "SPF Updated"
    | "SPF Version Created";

  spf_number?: string;
  version_label?: string;
  version_number?: number;

  referenceID?: string;
  userId?: string;

  extra?: Record<string, any>;
};

export async function logSPFVersionEvent(
  payload: SPFVersionEventPayload
): Promise<void> {
  try {
    await addDoc(collection(db, "auditLogs_spfVersions"), {
      ...payload.extra,
      whatHappened : payload.whatHappened,
      spf_number   : payload.spf_number ?? null,
      version_label: payload.version_label ?? null,
      version_number: payload.version_number ?? null,
      referenceID  : payload.referenceID ?? null,
      userId       : payload.userId ?? null,
      date_updated : serverTimestamp(),
      createdAt    : serverTimestamp(),
    });
  } catch (err) {
    console.warn("[auditLogger] Failed to log SPF version event:", err);
  }
}

export async function logProductUsageEvent(payload: ProductUsageEventPayload): Promise<void> {
  try {
    await addDoc(collection(db, "auditLogs_productUsages"), {
      ...payload.extra,
      whatHappened    : payload.whatHappened,
      productUsageId  : payload.productUsageId   ?? null,
      productUsageName: payload.productUsageName ?? null,
      referenceID     : payload.referenceID      ?? null,
      userId          : payload.userId           ?? null,
      date_updated    : serverTimestamp(),
      createdAt       : serverTimestamp(),
    });
  } catch (err) {
    console.warn("[auditLogger] Failed to log category type event:", err);
  }
}
