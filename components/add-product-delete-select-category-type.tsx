"use client";

import { useState } from "react";
import { Minus } from "lucide-react";

import {
  doc,
  updateDoc,
  serverTimestamp,
  getDocs,
  collection,
  writeBatch,
  query,
  where,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { removeProductClassification } from "@/lib/product-classification-sync";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { logProductUsageEvent } from "@/lib/auditlogger"; // ✅ AUDIT

type ProductType = {
  id: string;
  name: string;
};

type Props = {
  item: ProductType;
  referenceID: string;
  onDeleted?: () => void;
};

export default function AddProductDeleteProductType({ item, referenceID, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);

      const [familiesSnapshot, productTypesSnapshot] = await Promise.all([
        getDocs(query(collection(db, "productFamilies"), where("categoryTypeId", "==", item.id))),
        getDocs(query(collection(db, "productTypes"), where("categoryTypeId", "==", item.id))),
      ]);
      const dependentDocs = [
        ...familiesSnapshot.docs.map((family) => ({ ref: family.ref, whatHappened: "Product Family Deleted" })),
        ...productTypesSnapshot.docs.map((productType) => ({ ref: productType.ref, whatHappened: "Product Type Deleted" })),
      ];

      for (let index = 0; index < dependentDocs.length; index += 400) {
        const batch = writeBatch(db);
        dependentDocs.slice(index, index + 400).forEach(({ ref, whatHappened }) => {
          batch.update(ref, {
            isActive: false,
            deletedBy: referenceID,
            deletedAt: serverTimestamp(),
            whatHappened,
            date_updated: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      await updateDoc(doc(db, "categoryTypes", item.id), {
        isActive: false,
        deletedBy: referenceID,
        deletedAt: serverTimestamp(),
        whatHappened: "Product Usage Deleted",
        date_updated: serverTimestamp(),
      });
      await removeProductClassification({ productUsageId: item.id });

      // ✅ AUDIT LOG
      await logProductUsageEvent({
        whatHappened    : "Product Usage Deleted",
        productUsageId  : item.id,
        productUsageName: item.name,
        referenceID,
      });

      toast.success("Product usage and all dependent product families and types deleted");
      onDeleted?.();
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete product usage");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline">
          <Minus className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product Usage</DialogTitle>
        </DialogHeader>

        <p>
          Delete <b>{item.name}</b> and all its Product Families and Product Types?
        </p>

        <DialogFooter>
          <Button onClick={() => setOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
