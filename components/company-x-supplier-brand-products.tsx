"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Package,
  ChevronDown,
  ChevronUp,
  Search,
  Factory,
  Anchor,
  Box,
  Tag,
  DollarSign,
  Layers,
} from "lucide-react";

/* ---------------- Types ---------------- */
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  company: string;
  supplierBrand: string;
};

type Product = {
  id: string;
  productName?: string;
  productClass?: string;
  pricePoint?: string;
  brandOrigin?: string;
  mainImage?: { url: string } | null;
  categoryTypes?: { productUsageId: string; categoryTypeName: string }[];
  productFamilies?: {
    productFamilyId: string;
    productFamilyName: string;
    productUsageId: string;
  }[];
  technicalSpecifications?: {
    title: string;
    specs: { specId: string; value: string }[];
  }[];
  commercialDetails?: {
    unitCost?: number | null;
    pcsPerCarton?: number | null;
    packaging?: {
      length?: string | null;
      width?: string | null;
      height?: string | null;
    };
    factoryAddress?: string;
    portOfDischarge?: string;
  };
  supplier?: {
    supplierId: string;
    company: string;
    supplierBrand?: string;
  };
};

export default function SupplierProducts({
  open,
  onOpenChange,
  supplierId,
  company,
  supplierBrand,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* ---------------- Fetch Products ---------------- */
  useEffect(() => {
    if (!open) return;

    const fetchProducts = async () => {
      setLoading(true);
      setProducts([]);
      setSearch("");
      setExpandedId(null);

      try {
        const q = query(
          collection(db, "products"),
          where("isActive", "==", true),
          where("supplier.supplierId", "==", supplierId),
        );
        const snap = await getDocs(q);

        let fallbackSnap: typeof snap | null = null;
        if (supplierBrand) {
          const qBrand = query(
            collection(db, "products"),
            where("isActive", "==", true),
            where("supplier.supplierBrand", "==", supplierBrand),
          );
          fallbackSnap = await getDocs(qBrand);
        }

        const merged = new Map<string, Product>();
        snap.docs.forEach((doc) => {
          merged.set(doc.id, { id: doc.id, ...doc.data() } as Product);
        });
        fallbackSnap?.docs.forEach((doc) => {
          if (!merged.has(doc.id)) {
            merged.set(doc.id, { id: doc.id, ...doc.data() } as Product);
          }
        });

        setProducts(Array.from(merged.values()));
      } catch (err) {
        console.error("Error fetching supplier products:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [open, supplierId, supplierBrand]);

  /* ---------------- Filtered Products ---------------- */
  const filtered = React.useMemo(() => {
    const kw = search.toLowerCase();
    if (!kw) return products;
    return products.filter(
      (p) =>
        p.productName?.toLowerCase().includes(kw) ||
        p.productClass?.toLowerCase().includes(kw) ||
        p.pricePoint?.toLowerCase().includes(kw) ||
        p.brandOrigin?.toLowerCase().includes(kw) ||
        p.categoryTypes?.some((c) =>
          c.categoryTypeName.toLowerCase().includes(kw),
        ) ||
        p.productFamilies?.some((f) =>
          f.productFamilyName.toLowerCase().includes(kw),
        ) ||
        p.technicalSpecifications?.some(
          (s) =>
            s.title.toLowerCase().includes(kw) ||
            s.specs.some(
              (r) =>
                r.specId.toLowerCase().includes(kw) ||
                r.value.toLowerCase().includes(kw),
            ),
        ),
    );
  }, [products, search]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-full max-h-[88vh] flex flex-col p-0 overflow-hidden rounded-2xl shadow-2xl border-0">

        {/* ── HEADER ── */}
        <DialogHeader className="shrink-0 px-6 pt-6 pb-5 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-t-2xl">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 border border-white/20 shrink-0">
              <Package className="w-5 h-5 text-white" />
            </div>

            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white text-lg font-bold leading-snug tracking-tight">
                {company}
                {supplierBrand && (
                  <span className="ml-2 text-sm font-normal text-slate-300">
                    · {supplierBrand}
                  </span>
                )}
              </DialogTitle>
              <p className="text-slate-400 text-[11px] mt-0.5 uppercase tracking-widest font-medium">
                Product Catalog
              </p>
            </div>

            {/* Count pill */}
            {!loading && (
              <div className="shrink-0 flex items-center gap-1.5 bg-white/10 border border-white/20 rounded-full px-3 py-1">
                <Layers className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-sm font-bold text-white">{filtered.length}</span>
                <span className="text-xs text-slate-400">
                  {filtered.length === 1 ? "product" : "products"}
                </span>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Search by ID, class, category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg"
            />
          </div>
        </DialogHeader>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5 bg-slate-50">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-9 h-9 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin mb-4" />
              <p className="text-sm font-medium">Loading products…</p>
            </div>
          )}

          {/* Empty */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-sm font-semibold text-slate-500">
                {search
                  ? "No products match your search."
                  : "No products found for this supplier."}
              </p>
              {search && (
                <p className="text-xs text-slate-400 mt-1">Try a different keyword.</p>
              )}
            </div>
          )}

          {/* Cards */}
          {!loading &&
            filtered.map((product) => {
              const isExpanded = expandedId === product.id;
              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm transition-all duration-200 hover:shadow-md hover:border-slate-300"
                >
                  {/* Card row */}
                  <button
                    className="w-full text-left px-4 py-3.5 flex items-center gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => toggleExpand(product.id)}
                  >
                    {/* Thumbnail */}
                    <div className="w-14 h-14 rounded-lg border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {product.mainImage?.url ? (
                        <img
                          src={product.mainImage.url}
                          alt={product.productName}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-300" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        <span className="font-bold text-sm text-slate-800 tracking-tight">
                          {product.productName || "—"}
                        </span>
                        {product.productClass && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                            <Tag className="w-2.5 h-2.5" />
                            {product.productClass}
                          </span>
                        )}
                        {product.pricePoint && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                            <DollarSign className="w-2.5 h-2.5" />
                            {product.pricePoint}
                          </span>
                        )}
                        {product.brandOrigin && (
                          <span className="inline-flex items-center rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                            {product.brandOrigin}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 truncate leading-relaxed">
                        {product.categoryTypes
                          ?.map((c) => c.categoryTypeName)
                          .join(", ") || "—"}
                        {product.productFamilies?.length ? (
                          <span className="text-slate-300 mx-1">›</span>
                        ) : null}
                        {product.productFamilies
                          ?.map((f) => f.productFamilyName)
                          .join(", ")}
                      </p>
                    </div>

                    {/* Expand indicator */}
                    <div
                      className={`shrink-0 flex items-center justify-center w-7 h-7 rounded-full border transition-colors ${
                        isExpanded
                          ? "bg-slate-800 border-slate-800 text-white"
                          : "bg-white border-slate-200 text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>

                  {/* ── Expanded details ── */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-5 space-y-5 text-sm">

                      {/* Large image */}
                      {product.mainImage?.url && (
                        <div className="flex justify-center">
                          <img
                            src={product.mainImage.url}
                            alt="main"
                            className="h-40 object-contain rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
                          />
                        </div>
                      )}

                      {/* Commercial Details */}
                      {product.commercialDetails && (
                        <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-5 h-5 rounded-md bg-orange-100 flex items-center justify-center">
                              <DollarSign className="w-3 h-3 text-orange-600" />
                            </div>
                            <p className="text-[11px] font-bold uppercase tracking-widest text-orange-600">
                              Commercial Details
                            </p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                            {product.commercialDetails.unitCost != null && (
                              <DetailItem
                                icon={<DollarSign className="w-3 h-3" />}
                                label="Unit Cost"
                                value={`USD ${product.commercialDetails.unitCost}`}
                              />
                            )}
                            {product.commercialDetails.pcsPerCarton != null && (
                              <DetailItem
                                icon={<Box className="w-3 h-3" />}
                                label="pcs / carton"
                                value={String(product.commercialDetails.pcsPerCarton)}
                              />
                            )}
                            {product.commercialDetails.packaging && (
                              <DetailItem
                                icon={<Box className="w-3 h-3" />}
                                label="Packaging"
                                value={[
                                  product.commercialDetails.packaging.length,
                                  product.commercialDetails.packaging.width,
                                  product.commercialDetails.packaging.height,
                                ]
                                  .filter(Boolean)
                                  .join(" × ")}
                              />
                            )}
                            {product.commercialDetails.factoryAddress && (
                              <div className="col-span-2">
                                <DetailItem
                                  icon={<Factory className="w-3 h-3" />}
                                  label="Factory"
                                  value={product.commercialDetails.factoryAddress}
                                />
                              </div>
                            )}
                            {product.commercialDetails.portOfDischarge && (
                              <DetailItem
                                icon={<Anchor className="w-3 h-3" />}
                                label="Port"
                                value={product.commercialDetails.portOfDischarge}
                              />
                            )}
                          </div>
                        </div>
                      )}

                      {/* Technical Specifications */}
                      {product.technicalSpecifications &&
                        product.technicalSpecifications.length > 0 && (
                          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <div className="w-5 h-5 rounded-md bg-blue-100 flex items-center justify-center">
                                <Layers className="w-3 h-3 text-blue-700" />
                              </div>
                              <p className="text-[11px] font-bold uppercase tracking-widest text-blue-700">
                                Technical Specifications
                              </p>
                            </div>
                            <div className="space-y-4">
                              {product.technicalSpecifications.map((group, gi) => {
                                const filledSpecs = group.specs.filter((r) =>
                                  r.value?.trim(),
                                );
                                if (!filledSpecs.length) return null;
                                return (
                                  <div key={gi}>
                                    <p className="text-[11px] font-semibold text-blue-500 uppercase tracking-wider mb-2">
                                      {group.title}
                                    </p>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                                      {filledSpecs.map((spec, si) => (
                                        <DetailItem
                                          key={si}
                                          label={spec.specId}
                                          value={spec.value}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Detail key-value helper ── */
function DetailItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="text-slate-700 font-medium leading-snug">{value}</span>
    </div>
  );
}
