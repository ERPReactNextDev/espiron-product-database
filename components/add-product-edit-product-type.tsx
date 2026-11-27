"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";

import { db } from "@/lib/firebase";
import { renameProductTypeInProducts } from "@/lib/product-classification-sync";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProductTypeItem = {
  id: string;
  name: string;
  productFamilyId: string;
  productUsageId: string;
};

type Props = {
  item: ProductTypeItem;
};

export default function AddProductEditProductType({ item }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(item.name);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const name = value.trim();
    if (!name) {
      toast.error("Product type name cannot be empty");
      return;
    }
    if (name === item.name) {
      setOpen(false);
      return;
    }

    try {
      setSaving(true);
      await updateDoc(doc(db, "productTypes", item.id), {
        name,
        whatHappened: "Product Type Edited",
        date_updated: serverTimestamp(),
      });
      await renameProductTypeInProducts(item.id, name);
      toast.success("Product type updated");
      setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to update product type");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" aria-label={`Edit ${item.name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Edit Product Type</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Product Type Name</Label>
          <Input value={value} onChange={(event) => setValue(event.target.value)} disabled={saving} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
