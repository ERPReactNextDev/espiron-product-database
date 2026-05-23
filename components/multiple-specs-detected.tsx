"use client";

import { useState, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onClose: () => void;
  product: any;
  onConfirm: (filteredProduct: any) => void;
};

export default function MultipleSpecsDetected({
  open,
  onClose,
  product,
  onConfirm,
}: Props) {
  const [selectedSpecs, setSelectedSpecs] = useState<Record<string, string>>(
    {}
  );

  // Pre-populate selectedSpecs from product's current spec values when dialog opens
  // Only for specs with multiple values (pipe specs)
  useEffect(() => {
    if (open && product?.technicalSpecifications) {
      const currentSpecs: Record<string, string> = {};
      product.technicalSpecifications.forEach((group: any) => {
        group.specs?.forEach((spec: any) => {
          const values = (spec.value || "")
            .split("|")
            .map((v: string) => v.trim())
            .filter(Boolean);
          // Only pre-populate if this spec has multiple values (pipe spec)
          // Single values don't need selection
          if (values.length > 1) {
            currentSpecs[spec.specId] = values[0];
          }
        });
      });
      setSelectedSpecs(currentSpecs);
    }
  }, [open, product]);

  if (!product) return null;

  /* ================= PIPE SPECS ================= */
  const pipeSpecs =
    product.technicalSpecifications?.flatMap((group: any) =>
      group.specs
        ?.map((spec: any) => {
          const values = (spec.value || "")
            .split("|")
            .map((v: string) => v.trim())
            .filter(Boolean);

          if (values.length > 1) {
            return { specId: spec.specId, values };
          }
          return null;
        })
        .filter(Boolean)
    ) || [];

  /* ================= SELECT ================= */
  const handleSelect = (specId: string, value: string) => {
    setSelectedSpecs((prev) => ({
      ...prev,
      [specId]: value,
    }));
  };

  /* ================= VALIDATION ================= */
  const isComplete = pipeSpecs.every(
    (spec: any) => selectedSpecs[spec.specId]
  );

  /* ================= SUBMIT ================= */
  const handleSubmit = () => {
    const updated = {
      ...product,
      technicalSpecifications: product.technicalSpecifications.map(
        (group: any) => ({
          ...group,
          specs: group.specs.map((spec: any) => {
            if (selectedSpecs[spec.specId]) {
              const selectedValue = selectedSpecs[spec.specId];
              
              // If Cutout is selected, filter out "Ceiling Recessed" from the value
              if (selectedValue.toLowerCase().includes("cutout") || 
                  selectedValue.toLowerCase().includes("cut-out")) {
                const values = (spec.value || "")
                  .split("|")
                  .map((v: string) => v.trim())
                  .filter(Boolean);
                
                // Filter out "Ceiling Recessed" and keep only the selected cutout value
                const filteredValues = values.filter((v: string) => 
                  !v.toLowerCase().includes("ceiling recessed")
                );
                
                return {
                  ...spec,
                  value: selectedValue,
                };
              }
              
              return {
                ...spec,
                value: selectedValue,
              };
            }
            return spec;
          }),
        })
      ),
    };

    onConfirm(updated);
    onClose();
    setSelectedSpecs({});
  };

  /* ================= MOBILE BOTTOM SHEET ================= */
  /* Render as a fixed bottom sheet on mobile to avoid
     triggering the parent Dialog's onOpenChange */
  return (
    <>
      {/* ── DESKTOP: normal Dialog ── */}
      <div className="hidden md:block">
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Multiple Specs Detected</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 max-h-[400px] overflow-auto">
              {product.technicalSpecifications
                ?.filter((group: any) =>
                  group.specs?.some((spec: any) => {
                    const values = (spec.value || "")
                      .split("|")
                      .map((v: string) => v.trim())
                      .filter(Boolean);
                    return values.length > 1;
                  })
                )
                .map((group: any, gi: number) => (
                  <div key={gi}>
                    <p className="font-semibold">{group.title}</p>
                    {group.specs?.map((spec: any, si: number) => {
                      const values = (spec.value || "")
                        .split("|")
                        .map((v: string) => v.trim())
                        .filter(Boolean);
                      if (values.length <= 1) return null;
                      return (
                        <div key={si} className="mt-2">
                          <p className="text-sm">{spec.specId}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {values.map((v: string, i: number) => {
                              const isSelected = selectedSpecs[spec.specId] === v;
                              return (
                                <Button
                                  key={i}
                                  size="sm"
                                  variant={isSelected ? "default" : "outline"}
                                  onClick={() => handleSelect(spec.specId, v)}
                                >
                                  {v}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {Object.keys(selectedSpecs).length} / {pipeSpecs.length} selected
            </p>

            <DialogFooter>
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button disabled={!isComplete} onClick={handleSubmit}>
                Submit
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── MOBILE: fixed bottom sheet (avoids Dialog-within-Dialog issue) ── */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[200] flex flex-col">
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/50"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          />

          {/* Sheet */}
          <div
            className="bg-background rounded-t-2xl shadow-xl px-5 pt-5 pb-8 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              <h2 className="text-base font-semibold">Multiple Specs Detected</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Select one value for each spec
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-5 pr-1">
              {product.technicalSpecifications
                ?.filter((group: any) =>
                  group.specs?.some((spec: any) => {
                    const values = (spec.value || "")
                      .split("|")
                      .map((v: string) => v.trim())
                      .filter(Boolean);
                    return values.length > 1;
                  })
                )
                .map((group: any, gi: number) => (
                  <div key={gi}>
                    <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">
                      {group.title}
                    </p>
                    {group.specs?.map((spec: any, si: number) => {
                      const values = (spec.value || "")
                        .split("|")
                        .map((v: string) => v.trim())
                        .filter(Boolean);
                      if (values.length <= 1) return null;
                      return (
                        <div key={si} className="mb-3">
                          <p className="text-sm font-medium mb-1.5">{spec.specId}</p>
                          <div className="flex flex-wrap gap-2">
                            {values.map((v: string, i: number) => {
                              const isSelected = selectedSpecs[spec.specId] === v;
                              return (
                                <button
                                  key={i}
                                  onClick={() => handleSelect(spec.specId, v)}
                                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                                    isSelected
                                      ? "bg-primary text-primary-foreground border-primary"
                                      : "bg-background text-foreground border-border"
                                  }`}
                                >
                                  {v}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>

            <p className="text-xs text-muted-foreground mt-3 mb-4">
              {Object.keys(selectedSpecs).length} / {pipeSpecs.length} selected
            </p>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSpecs({});
                  onClose();
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={!isComplete}
                className="flex-1 rounded-xl"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSubmit();
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
