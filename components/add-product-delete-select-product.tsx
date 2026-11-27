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
import { toast } from "sonner";
import { removeProductClassification } from "@/lib/product-classification-sync";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { logProductFamilyEvent } from "@/lib/auditlogger"; // ✅ AUDIT

type ProductFamilyItem = {
  id: string;
  productName: string;
  productUsageId: string;
};

type Props = {
  item: ProductFamilyItem;
  referenceID: string;
  onDeleted?: () => void;
};

export default function AddProductDeleteProduct({ item, referenceID, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);

      const productTypes = await getDocs(
        query(collection(db, "productTypes"), where("productFamilyId", "==", item.id)),
      );
      for (let index = 0; index < productTypes.docs.length; index += 400) {
        const batch = writeBatch(db);
        productTypes.docs.slice(index, index + 400).forEach((productType) => {
          batch.update(productType.ref, {
            isActive: false,
            deletedBy: referenceID,
            deletedAt: serverTimestamp(),
            whatHappened: "Product Type Deleted",
            date_updated: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      await updateDoc(doc(db, "productFamilies", item.id), {
        isActive: false,
        deletedBy: referenceID,
        deletedAt: serverTimestamp(),
        whatHappened: "Product Family Deleted",
        date_updated: serverTimestamp(),
      });

      await removeProductClassification({ productFamilyId: item.id });

      // ✅ AUDIT LOG
      await logProductFamilyEvent({
        whatHappened     : "Product Family Deleted",
        productFamilyId  : item.id,
        productFamilyName: item.productName,
        productUsageId   : item.productUsageId,
        referenceID,
      });

      toast.success("Product family deleted");
      onDeleted?.();
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete product family");
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

      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Delete Product Family</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete
          <span className="font-semibold"> {item.productName}</span>?
        </p>

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={deleting}>
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
