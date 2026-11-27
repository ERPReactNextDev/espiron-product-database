"use client";

import { useState } from "react";
import { Minus } from "lucide-react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { removeProductClassification } from "@/lib/product-classification-sync";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ProductTypeItem = {
  id: string;
  name: string;
  productFamilyId: string;
  productUsageId: string;
};

type Props = {
  item: ProductTypeItem;
  referenceID: string;
  onDeleted?: () => void;
};

export default function AddProductDeleteProductTypeItem({
  item,
  referenceID,
  onDeleted,
}: Props) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await updateDoc(doc(db, "productTypes", item.id), {
        isActive: false,
        deletedBy: referenceID,
        deletedAt: serverTimestamp(),
        whatHappened: "Product Type Deleted",
        date_updated: serverTimestamp(),
      });
      await removeProductClassification({ productTypeId: item.id });
      toast.success("Product type deleted");
      onDeleted?.();
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete product type");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" aria-label={`Delete ${item.name}`}>
          <Minus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Delete Product Type</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Delete <span className="font-semibold">{item.name}</span> and remove it from associated products?
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
