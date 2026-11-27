"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ProductFamilyOption = { id: string; name: string; productUsageId: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  families: ProductFamilyOption[];
  initialFamilyId?: string;
  onConfirm: (family: ProductFamilyOption) => void;
};

export default function ProductTypeFamilyPickerDialog({
  open,
  onOpenChange,
  families,
  initialFamilyId,
  onConfirm,
}: Props) {
  const [selectedFamilyId, setSelectedFamilyId] = React.useState(initialFamilyId || families[0]?.id || "");

  React.useEffect(() => {
    if (open) setSelectedFamilyId(initialFamilyId || families[0]?.id || "");
  }, [open, initialFamilyId, families]);

  const handleConfirm = () => {
    const family = families.find((item) => item.id === selectedFamilyId);
    if (family) onConfirm(family);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Choose Product Family</DialogTitle>
          <DialogDescription>
            Choose which selected family this Product Type belongs to.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {families.map((family) => (
            <label key={family.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3">
              <input
                type="radio"
                name="productTypeParentFamily"
                checked={selectedFamilyId === family.id}
                onChange={() => setSelectedFamilyId(family.id)}
              />
              <span>{family.name}</span>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!selectedFamilyId}>
            Add Product Type
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
