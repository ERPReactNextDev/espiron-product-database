import {
  collection,
  getDocs,
  writeBatch,
  type DocumentData,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

type ClassificationRemoval = {
  productUsageId?: string;
  productFamilyId?: string;
  productTypeId?: string;
};

type ProductUpdate = {
  ref: DocumentReference<DocumentData>;
  data: DocumentData;
};

const CHUNK_SIZE = 400;

const matchesRemoval = (value: unknown, removal: ClassificationRemoval) => {
  if (typeof value !== "object" || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    (removal.productUsageId !== undefined && entry.productUsageId === removal.productUsageId) ||
    (removal.productFamilyId !== undefined && entry.productFamilyId === removal.productFamilyId) ||
    (removal.productTypeId !== undefined && entry.productTypeId === removal.productTypeId)
  );
};

async function commitProductUpdates(updates: ProductUpdate[]) {
  for (let index = 0; index < updates.length; index += CHUNK_SIZE) {
    const batch = writeBatch(db);
    updates.slice(index, index + CHUNK_SIZE).forEach(({ ref, data }) => batch.update(ref, data));
    await batch.commit();
  }
}

export async function removeProductClassification(removal: ClassificationRemoval) {
  const snapshot = await getDocs(collection(db, "products"));
  const updates: ProductUpdate[] = [];

  snapshot.docs.forEach((product) => {
    const productData = product.data();
    const update: DocumentData = {};

    for (const field of ["categoryTypes", "productFamilies", "productTypes"] as const) {
      const entries = productData[field];
      if (!Array.isArray(entries)) continue;
      const filtered = entries.filter((entry) => !matchesRemoval(entry, removal));
      if (filtered.length !== entries.length) update[field] = filtered;
    }

    if (Object.keys(update).length > 0) {
      updates.push({ ref: product.ref, data: update });
    }
  });

  await commitProductUpdates(updates);
}

export async function renameProductTypeInProducts(productTypeId: string, name: string) {
  const snapshot = await getDocs(collection(db, "products"));
  const updates: ProductUpdate[] = [];

  snapshot.docs.forEach((product) => {
    const entries = product.data().productTypes;
    if (!Array.isArray(entries)) return;

    let changed = false;
    const productTypes = entries.map((entry) => {
      if (
        typeof entry !== "object" ||
        entry === null ||
        (entry as Record<string, unknown>).productTypeId !== productTypeId
      ) {
        return entry;
      }

      changed = true;
      return { ...(entry as Record<string, unknown>), productTypeName: name };
    });

    if (changed) {
      updates.push({ ref: product.ref, data: { productTypes } });
    }
  });

  await commitProductUpdates(updates);
}
