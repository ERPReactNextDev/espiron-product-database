"use client";

import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { logProductEvent, logSupplierEvent } from "@/lib/auditlogger";
import { insertParsedProductBulk, type ParsedProductRow } from "@/lib/product-bulk-insert-runner";
import { executeSupplierBulkFromRows } from "@/lib/supplier-bulk-insert-runner";

export type ApprovalActionType =
  | "product_add"
  | "product_edit"
  | "product_delete"
  | "supplier_add"
  | "supplier_edit"
  | "supplier_delete"
  | "product_upload"
  | "supplier_upload";

export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export type ApprovalUserProfile = {
  userId: string;
  referenceID: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string;
  bypassApproval: boolean;
};

type RawUser = {
  Firstname?: string;
  Lastname?: string;
  Role?: string;
  Department?: string;
  ReferenceID?: string;
};

export type CreateApprovalRequestPayload = {
  actionType: ApprovalActionType;
  entityLabel: string;
  requester: ApprovalUserProfile;
  message: string;
  summary: string;
  payload: Record<string, any>;
};

export async function getApprovalUserProfile(
  userId: string,
): Promise<ApprovalUserProfile | null> {
  try {
    const res = await fetch(`/api/users?id=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const raw: RawUser = await res.json();

    const accessDoc = await getDoc(doc(db, "roleAccess", userId));
    const access = accessDoc.exists() ? accessDoc.data()?.access ?? {} : {};
    const bypassApproval = Boolean(access?.["feature:approval-bypass"]);

    return {
      userId,
      referenceID: raw.ReferenceID ?? "",
      firstName: raw.Firstname ?? "",
      lastName: raw.Lastname ?? "",
      role: raw.Role ?? "",
      department: raw.Department ?? "",
      bypassApproval,
    };
  } catch {
    return null;
  }
}

export function canReviewApprovals(profile: ApprovalUserProfile | null): boolean {
  if (!profile) return false;
  const isEngineeringManager =
    profile.department === "Engineering" && profile.role === "Manager";
  const isIT = profile.department === "IT";
  return isEngineeringManager || isIT;
}

export function shouldRequireApproval(profile: ApprovalUserProfile | null): boolean {
  if (!profile) return false;
  if (profile.bypassApproval) return false;
  const isEngineeringManager =
    profile.department === "Engineering" && profile.role === "Manager";
  const isIT = profile.department === "IT";
  if (isEngineeringManager || isIT) return false;
  const isEngineeringNonManager =
    profile.department === "Engineering" && profile.role !== "Manager";
  return isEngineeringNonManager;
}

export async function createApprovalRequest(
  input: CreateApprovalRequestPayload,
): Promise<string> {

  // Auto-fetch "before" snapshot for edit/delete actions
  let beforeSnapshot: Record<string, any> | null = null;

  if (
    ["supplier_edit", "supplier_delete"].includes(input.actionType) &&
    input.payload.supplierId
  ) {
    try {
      const snap = await getDoc(doc(db, "suppliers", input.payload.supplierId as string));
      if (snap.exists()) beforeSnapshot = snap.data();
    } catch {}
  }

  if (
    ["product_edit", "product_delete"].includes(input.actionType) &&
    input.payload.productId
  ) {
    try {
      const snap = await getDoc(doc(db, "products", input.payload.productId as string));
      if (snap.exists()) beforeSnapshot = snap.data();
    } catch {}
  }

  const docRef = await addDoc(collection(db, "forApprovals"), {
    actionType: input.actionType,
    entityLabel: input.entityLabel,
    requesterUserId: input.requester.userId,
    requesterReferenceID: input.requester.referenceID || null,
    requesterName: `${input.requester.firstName} ${input.requester.lastName}`.trim(),
    requesterRole: input.requester.role || null,
    requesterDepartment: input.requester.department || null,
    message: input.message.trim(),
    summary: input.summary.trim(),
    payload: {
      ...input.payload,
      ...(beforeSnapshot ? { before: beforeSnapshot } : {}),
    },
    status: "Pending" as ApprovalStatus,
    reviewedByUserId: null,
    reviewedByReferenceID: null,
    reviewedByName: null,
    reviewedAt: null,
    reviewRemarks: null,
    resultNotifiedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function performApprovedAction(requestId: string): Promise<void> {
  const snap = await getDoc(doc(db, "forApprovals", requestId));
  if (!snap.exists()) throw new Error("Approval request not found");

  const data = snap.data() as any;
  if (data.status !== "Approved") throw new Error("Request is not approved");
  if (data.executedAt) return;

  const payload = data.payload ?? {};
  let shouldMarkExecuted = false;

  switch (data.actionType as ApprovalActionType) {
    case "supplier_add": {
      shouldMarkExecuted = true;
      const supplierRef = await addDoc(collection(db, "suppliers"), {
        company: payload.company ?? "",
        supplierBrand: payload.supplierBrand ?? "",
        addresses: payload.addresses ?? [],
        emails: payload.emails ?? [],
        website: payload.website ?? [],
        contacts: payload.contacts ?? [],
        forteProducts: payload.forteProducts ?? [],
        products: payload.products ?? [],
        certificates: payload.certificates ?? [],
        createdBy: data.requesterUserId ?? null,
        referenceID: data.requesterReferenceID ?? null,
        isActive: true,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "suppliers", supplierRef.id), {
        supplierId: supplierRef.id,
        supplierbrandId: supplierRef.id,
        whatHappened: "Supplier Added",
        date_updated: serverTimestamp(),
      });
      await logSupplierEvent({
        whatHappened: "Supplier For Approval Approved",
        supplierId: supplierRef.id,
        supplierbrandId: supplierRef.id,
        company: payload.company ?? "",
        supplierBrand: payload.supplierBrand ?? "",
        referenceID: data.requesterReferenceID ?? undefined,
        userId: data.requesterUserId ?? undefined,
      });
      break;
    }
    case "supplier_edit": {
      shouldMarkExecuted = true;
      const supplierId = payload.supplierId;
      if (!supplierId) throw new Error("Missing supplierId");
      await updateDoc(doc(db, "suppliers", supplierId), {
        supplierId,
        supplierbrandId: supplierId,
        company: payload.company ?? "",
        supplierBrand: payload.supplierBrand ?? "",
        addresses: payload.addresses ?? [],
        emails: payload.emails ?? [],
        website: payload.website ?? [],
        contacts: payload.contacts ?? [],
        forteProducts: payload.forteProducts ?? [],
        products: payload.products ?? [],
        certificates: payload.certificates ?? [],
        referenceID: data.requesterReferenceID ?? null,
        whatHappened: "Supplier Edited",
        date_updated: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const productsWithSupplier = await getDocs(
        query(collection(db, "products"), where("supplier.supplierId", "==", supplierId)),
      );
      await Promise.all(
        productsWithSupplier.docs.map((p) => {
          const pdata = p.data();
          if (!pdata.supplier) return Promise.resolve();
          return updateDoc(p.ref, {
            supplier: {
              ...pdata.supplier,
              company: payload.company ?? "",
              supplierBrand: payload.supplierBrand ?? "",
            },
          });
        }),
      );
      await logSupplierEvent({
        whatHappened: "Supplier For Approval Approved",
        supplierId,
        supplierbrandId: supplierId,
        company: payload.company ?? "",
        supplierBrand: payload.supplierBrand ?? "",
        referenceID: data.requesterReferenceID ?? undefined,
        userId: data.requesterUserId ?? undefined,
      });
      break;
    }
    case "supplier_delete": {
      shouldMarkExecuted = true;
      const supplierId = payload.supplierId;
      if (!supplierId) throw new Error("Missing supplierId");
      await updateDoc(doc(db, "suppliers", supplierId), {
        isActive: false,
        deletedBy: data.requesterReferenceID ?? null,
        deletedAt: serverTimestamp(),
        whatHappened: "Supplier Deleted",
        date_updated: serverTimestamp(),
      });
      const snapshot = await getDocs(collection(db, "products"));
      await Promise.all(
        snapshot.docs.map((productDoc) => {
          const pdata = productDoc.data();
          if (!pdata.supplier || pdata.supplier?.supplierId !== supplierId) return Promise.resolve();
          return updateDoc(productDoc.ref, {
            supplier: null,
            pricePoint: "Economy",
            brandOrigin: "China",
            whatHappened: "Supplier Deleted - Defaults Applied",
            date_updated: serverTimestamp(),
          });
        }),
      );
      await logSupplierEvent({
        whatHappened: "Supplier For Approval Approved",
        supplierId,
        company: payload.company ?? "",
        supplierBrand: payload.supplierBrand ?? "",
        referenceID: data.requesterReferenceID ?? undefined,
        userId: data.requesterUserId ?? undefined,
      });
      break;
    }
    case "product_add": {
      shouldMarkExecuted = true;
      const nextRef = await getDocs(query(collection(db, "products"), where("isActive", "==", true)));
      const referenceNumber = `PROD-SPF-${(nextRef.size + 1).toString().padStart(5, "0")}`;
      const productRef = await addDoc(collection(db, "products"), {
        productReferenceID: referenceNumber,
        pricePoint: payload.pricePoint ?? "ECONOMY",
        brandOrigin: payload.brandOrigin ?? "CHINA",
        productClass: payload.productClass ?? "",
        supplier: payload.supplier ?? null,
        productFamilies: payload.productFamilies
          ?? (payload.productFamily ? [{ ...payload.productFamily, productUsageId: payload.categoryTypes?.[0]?.productUsageId || "" }] : []),
        productTypes: payload.productTypes ?? [],
        categoryTypes: payload.categoryTypes ?? [],
        commercialDetails: payload.commercialDetails ?? {},
        technicalSpecifications: payload.technicalSpecifications ?? [],
        mainImage: payload.mainImage ? { name: "external-image", url: payload.mainImage, publicId: null } : null,
        dimensionalDrawing: payload.dimensionalDrawing ? { name: "external-image", url: payload.dimensionalDrawing, publicId: null } : null,
        illuminanceDrawing: payload.illuminanceDrawing ? { name: "external-image", url: payload.illuminanceDrawing, publicId: null } : null,
        mediaStatus: "done",
        createdBy: data.requesterUserId ?? null,
        referenceID: data.requesterReferenceID ?? null,
        isActive: true,
        createdAt: serverTimestamp(),
        whatHappened: "Product Added",
        date_updated: serverTimestamp(),
      });
      await logProductEvent({
        whatHappened: "Product For Approval Approved",
        productId: productRef.id,
        productReferenceID: referenceNumber,
        productClass: payload.productClass ?? "",
        pricePoint: payload.pricePoint ?? "ECONOMY",
        brandOrigin: payload.brandOrigin ?? "CHINA",
        productTypes: payload.productTypes ?? [],
        referenceID: data.requesterReferenceID ?? undefined,
        userId: data.requesterUserId ?? undefined,
      });
      break;
    }
    case "product_edit": {
      shouldMarkExecuted = true;
      const productId = payload.productId;
      if (!productId) throw new Error("Missing productId");
      await updateDoc(doc(db, "products", productId), {
        mainImage: payload.mainImage ? { name: "external-image", url: payload.mainImage, publicId: null } : undefined,
        dimensionalDrawing: payload.dimensionalDrawing ? { name: "external-image", url: payload.dimensionalDrawing, publicId: null } : undefined,
        illuminanceDrawing: payload.illuminanceDrawing ? { name: "external-image", url: payload.illuminanceDrawing, publicId: null } : undefined,
        pricePoint: payload.pricePoint ?? "ECONOMY",
        brandOrigin: payload.brandOrigin ?? "CHINA",
        productClass: payload.productClass ?? "",
        supplier: payload.supplier ?? null,
        productFamilies: payload.productFamilies ?? [],
        productTypes: payload.productTypes ?? [],
        categoryTypes: payload.categoryTypes ?? [],
        commercialDetails: payload.commercialDetails ?? {},
        technicalSpecifications: payload.technicalSpecifications ?? [],
        updatedAt: serverTimestamp(),
        whatHappened: "Product Edited",
        date_updated: serverTimestamp(),
      });
      await logProductEvent({
        whatHappened: "Product For Approval Approved",
        productId,
        productClass: payload.productClass ?? "",
        pricePoint: payload.pricePoint ?? "ECONOMY",
        brandOrigin: payload.brandOrigin ?? "CHINA",
        productTypes: payload.productTypes ?? [],
        referenceID: data.requesterReferenceID ?? undefined,
        userId: data.requesterUserId ?? undefined,
      });
      break;
    }
    case "product_delete": {
      shouldMarkExecuted = true;
      const productId = payload.productId;
      if (!productId) throw new Error("Missing productId");
      await updateDoc(doc(db, "products", productId), {
        isActive: false,
        deletedAt: serverTimestamp(),
        deletedBy: data.requesterReferenceID ?? null,
        whatHappened: "Product Deleted",
        date_updated: serverTimestamp(),
      });
      await logProductEvent({
        whatHappened: "Product For Approval Approved",
        productId,
        referenceID: data.requesterReferenceID ?? undefined,
        userId: data.requesterUserId ?? undefined,
      });
      break;
    }
    case "product_upload": {
      shouldMarkExecuted = true;
      const rows = payload.rows as ParsedProductRow[];
      const excelColumnsByWsIndex = payload.excelColumnsByWsIndex as Record<
        string,
        { title: string; specId: string; col: number }[]
      >;
      if (!rows?.length) throw new Error("No product rows in approval payload");
      await insertParsedProductBulk({
        rows,
        excelColumnsByWsIndex: excelColumnsByWsIndex ?? {},
        referenceID: data.requesterReferenceID ?? "",
        userId: data.requesterUserId ?? "",
        filename: String(payload.filename ?? "products.xlsx"),
      });
      break;
    }
    case "supplier_upload": {
      shouldMarkExecuted = true;
      const uploadRows = payload.rows as Record<string, unknown>[];
      if (!uploadRows?.length) throw new Error("No supplier rows in approval payload");
      await executeSupplierBulkFromRows({
        uploadRows,
        referenceID: data.requesterReferenceID ?? "",
        userId: data.requesterUserId ?? "",
        filename: String(payload.filename ?? "suppliers.xlsx"),
        overwriteConflicts: Boolean(payload.overwriteConflicts),
      });
      break;
    }
    default:
      break;
  }

  if (shouldMarkExecuted) {
    await updateDoc(doc(db, "forApprovals", requestId), {
      executedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

function actionTypeLabel(t: ApprovalActionType): string {
  const map: Record<ApprovalActionType, string> = {
    product_add: "Add product",
    product_edit: "Edit product",
    product_delete: "Delete product",
    supplier_add: "Add supplier",
    supplier_edit: "Edit supplier",
    supplier_delete: "Delete supplier",
    product_upload: "Upload products (Excel)",
    supplier_upload: "Upload suppliers (Excel)",
  };
  return map[t] ?? t;
}

async function logRejectionForRequester(requestId: string, data: Record<string, unknown>, remarks: string) {
  const actionType = data.actionType as ApprovalActionType;
  const payload = (data.payload ?? {}) as Record<string, unknown>;
  const refId = (data.requesterReferenceID as string) ?? undefined;
  const uid = (data.requesterUserId as string) ?? undefined;
  const extra = {
    approvalRequestId: requestId,
    reviewerRemarks: remarks || null,
    summary: data.summary ?? null,
    entityLabel: data.entityLabel ?? null,
  };

  const productish: ApprovalActionType[] = ["product_add", "product_edit", "product_delete", "product_upload"];
  if (productish.includes(actionType)) {
    await logProductEvent({
      whatHappened: "Product For Approval Rejected",
      productId: (payload.productId as string) ?? undefined,
      productClass: (payload.productClass as string) ?? undefined,
      referenceID: refId,
      userId: uid,
      extra: { ...extra, actionType, actionLabel: actionTypeLabel(actionType) },
    });
    return;
  }

  await logSupplierEvent({
    whatHappened: "Supplier For Approval Rejected",
    supplierId: (payload.supplierId as string) ?? undefined,
    company: (payload.company as string) ?? undefined,
    supplierBrand: (payload.supplierBrand as string) ?? undefined,
    referenceID: refId,
    userId: uid,
    extra: { ...extra, actionType, actionLabel: actionTypeLabel(actionType) },
  });
}

export async function approveForApprovalRequest(
  requestId: string,
  reviewer: ApprovalUserProfile,
): Promise<void> {
  const ref = doc(db, "forApprovals", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Approval request not found");
  const data = snap.data() as { status: string };
  if (data.status !== "Pending") throw new Error("This request is no longer pending");

  await updateDoc(ref, {
    status: "Approved" as ApprovalStatus,
    reviewedByUserId: reviewer.userId,
    reviewedByReferenceID: reviewer.referenceID || null,
    reviewedByName: `${reviewer.firstName} ${reviewer.lastName}`.trim(),
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await performApprovedAction(requestId);
}

export async function rejectForApprovalRequest(
  requestId: string,
  reviewer: ApprovalUserProfile,
  remarks: string,
): Promise<void> {
  const ref = doc(db, "forApprovals", requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Approval request not found");
  const data = snap.data() as { status: string };
  if (data.status !== "Pending") throw new Error("This request is no longer pending");

  await updateDoc(ref, {
    status: "Rejected" as ApprovalStatus,
    reviewedByUserId: reviewer.userId,
    reviewedByReferenceID: reviewer.referenceID || null,
    reviewedByName: `${reviewer.firstName} ${reviewer.lastName}`.trim(),
    reviewedAt: serverTimestamp(),
    reviewRemarks: remarks.trim() || null,
    updatedAt: serverTimestamp(),
  });

  await logRejectionForRequester(requestId, snap.data() as Record<string, unknown>, remarks.trim());
}
