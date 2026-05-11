"use client";
import { useUser } from "@/contexts/UserContext";
import React, { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Funnel, Plus, Trash2, ChevronDown, ChevronUp, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import FilteringComponent from "@/components/filtering-component-v2";
import AddProductComponent from "@/components/add-product-component";
import EditProductComponent from "@/components/edit-product-component";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CardDetails from "@/components/spf/dialog/card-details";
import SPFTimer from "@/components/spf-timer";
import MultipleSpecsDetected from "@/components/multiple-specs-detected";
import { useRoleAccess } from "@/contexts/RoleAccessContext";
import { useNotificationTriggers } from "@/hooks/use-notification-triggers";
import { generateTDSPdf } from "@/lib/generateTDSPdf";
import SPFGenerateTDSDialog from "@/components/spf-generate-tds-dialog";

/* ─────────────────────────────────────────────────────────────── */
/* TYPES                                                           */
/* ─────────────────────────────────────────────────────────────── */
export type SPFRequest = {
  id: string;
  spf_number: string;
  customer_name: string;
  contact_person?: string;
  contact_number?: string;
  registered_address?: string;
  delivery_address?: string;
  billing_address?: string;
  collection_address?: string;
  payment_terms?: string;
  warranty?: string;
  delivery_date?: string;
  prepared_by?: string;
  approved_by?: string;
  sales_person?: string;
  start_date?: string;
  end_date?: string;
  special_instructions?: string;
  item_description?: string[];
  item_photo?: string[];
  item_code?: string;
  item_qty?: string;
  status?: string;
  date_created?: string;
  date_updated?: string;
  process_by?: string;
  tin_no?: string;
  manager?: string;
  date_approved_sales_head?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowData: SPFRequest;
  processBy: string;
  isMobile: boolean;
  onSuccess: () => void;
};

/* ─────────────────────────────────────────────────────────────── */
/* PIPE DETECTION HELPER                                           */
/* ─────────────────────────────────────────────────────────────── */
function hasMultipleSpecValues(product: any): boolean {
  if (!product?.technicalSpecifications) return false;
  return product.technicalSpecifications.some((group: any) =>
    group.specs?.some((spec: any) => {
      const values = (spec.value || "")
        .split("|")
        .map((v: string) => v.trim())
        .filter(Boolean);
      return values.length > 1;
    }),
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* MOBILE-ONLY HELPERS                                             */
/* ─────────────────────────────────────────────────────────────── */
function InlineSpecs({ specs }: { specs: any[] }) {
  const [open, setOpen] = useState(false);
  const filtered =
    specs?.filter((g: any) => g.specs?.some((s: any) => s.value?.trim())) ?? [];
  if (!filtered.length) return null;
  return (
    <div className="mt-1">
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            setOpen((p) => !p);
          }
        }}
        className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none"
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        View specs
      </div>
      {open && (
        <div className="text-[10px] space-y-1 mt-1 pb-1">
          {filtered.map((g: any, gi: number) => (
            <div key={gi}>
              <p className="font-semibold">{g.title}</p>
              {g.specs
                ?.filter((s: any) => s.value?.trim())
                .map((s: any, si: number) => (
                  <p key={si} className="text-muted-foreground">
                    {s.specId}: {s.value}
                  </p>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InlineProductSpecs({ specs }: { specs: any[] }) {
  const [open, setOpen] = useState(false);
  const filtered =
    specs?.filter((g: any) => g.title !== "COMMERCIAL DETAILS") ?? [];
  if (!filtered.length) return null;
  return (
    <div className="mt-1" onClick={(e) => e.stopPropagation()}>
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((p) => !p);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            setOpen((p) => !p);
          }
        }}
        className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none"
      >
        {open ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        Specs
      </div>
      {open && (
        <div className="text-[10px] space-y-1 mt-1 pb-1">
          {filtered.map((group: any, i: number) => (
            <div key={i}>
              <p className="font-semibold">{group.title}</p>
              {group.specs?.map((spec: any, s: number) => (
                <p key={s} className="text-muted-foreground">
                  {spec.specId}: {spec.value || "-"}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* MAIN COMPONENT                                                  */
/* ─────────────────────────────────────────────────────────────── */
export default function SPFRequestCreate({
  open,
  onOpenChange,
  rowData,
  processBy,
  isMobile,
  onSuccess,
}: Props) {
  /* ── Form ── */
  const [formData, setFormData] = useState<SPFRequest>({
    id: "",
    spf_number: "",
    customer_name: "",
    contact_person: "",
    contact_number: "",
    registered_address: "",
    delivery_address: "",
    billing_address: "",
    collection_address: "",
    payment_terms: "",
    warranty: "",
    delivery_date: "",
    prepared_by: "",
    approved_by: "",
    sales_person: "",
    start_date: "",
    end_date: "",
    special_instructions: "",
    status: "Pending",
    process_by: "",
    tin_no: "",
    manager: "",
    item_code: "",
    item_description: [],
    item_photo: [],
  });
  const { userId } = useUser();
  const { onSPFCreated } = useNotificationTriggers();
  // ── ACCESS CONTROL ──
// ── ACCESS CONTROL ──
const { hasAccess, subscribeToUserAccess } = useRoleAccess();
const [canAddProduct, setCanAddProduct] = useState<boolean>(true);
const [canEditProduct, setCanEditProduct] = useState<boolean>(true);

// Initial check
useEffect(() => {
  hasAccess("page:add-product").then(setCanAddProduct);
  hasAccess("page:edit-product").then(setCanEditProduct);
}, [hasAccess]);

// Real-time subscription — re-check whenever access changes
useEffect(() => {
  if (!userId) return;
  const unsub = subscribeToUserAccess(userId, () => {
    hasAccess("page:add-product").then(setCanAddProduct);
    hasAccess("page:edit-product").then(setCanEditProduct);
  });
  return () => unsub();
}, [userId, subscribeToUserAccess, hasAccess]);

  /* ── Products ── */
  const [productOffers, setProductOffers] = useState<Record<number, any[]>>({});
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  /* ── Pagination state ── */
  const [productPage, setProductPage] = useState(1);
  const PRODUCTS_PER_PAGE = 20;

  /* ── UI state ── */
  const [viewMode, setViewMode] = useState(false);
  const [openAddProduct, setOpenAddProduct] = useState(false);
  const [openEditProduct, setOpenEditProduct] = useState(false);
const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [openFilter, setOpenFilter] = useState(false);

  /* ── Timer state ── */
  const [spfCreationStartTime, setSpfCreationStartTime] = useState<
    string | null
  >(null);
  const [spfCreationEndTime, setSpfCreationEndTime] = useState<string | null>(
    null,
  );
  const [timerActive, setTimerActive] = useState(false);

  /* ── Image Preview modal ── */
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  /* ── Desktop drag ── */
  const [draggedProduct, setDraggedProduct] = useState<any | null>(null);
  const [showTrash, setShowTrash] = useState(false);

  /* ── Open image preview dialog ── */
  const openImagePreview = (url: string | null | undefined) => {
    if (!url || url === "-") return;
    setPreviewImageUrl(url);
    setImagePreviewOpen(true);
  };

  /* ── Mobile ── */
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null);
  const [pickerStep, setPickerStep] = useState<"list" | "confirm">("list");
  const [pendingProduct, setPendingProduct] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "items" | "products">(
    "items",
  );

  /* ── MultipleSpecsDetected modal ── */
  const [showPipeModal, setShowPipeModal] = useState(false);
  const [pendingPipeProduct, setPendingPipeProduct] = useState<any | null>(
    null,
  );
  // For desktop drag: we need to remember which row to drop into
  const [pendingPipeRowIndex, setPendingPipeRowIndex] = useState<number | null>(
    null,
  );
  // For editing specs of existing products in product offers
  const [pendingPipeOptionIndex, setPendingPipeOptionIndex] = useState<number | null>(null);
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);

  /* ── Row Selection modal ── */
  const [showRowSelectModal, setShowRowSelectModal] = useState(false);
  const [pendingRowSelectProduct, setPendingRowSelectProduct] = useState<any | null>(null);

  /* ── Submit loading state ── */
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ── Draft state ── */
  const [hasDraft, setHasDraft] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  /* ── TDS Dialog state ── */
  const [tdsDialogOpen, setTdsDialogOpen] = useState(false);
  const [selectedProductForTDS, setSelectedProductForTDS] = useState<any | null>(null);
  const [selectedRowIndexForTDS, setSelectedRowIndexForTDS] = useState<number | null>(null);
  const [selectedOptionIndexForTDS, setSelectedOptionIndexForTDS] = useState<number | null>(null);

  /* ── Sync formData when rowData changes ── */
  useEffect(() => {
    if (!open) return;
    const normalizeArray = (value: string | string[] | undefined) => {
      if (Array.isArray(value)) return value;
      if (typeof value === "string")
        return value.split(",").map((v) => v.trim());
      return [];
    };
    setFormData({
      ...rowData,
      prepared_by: processBy,
      process_by: processBy,
      item_description: normalizeArray(rowData.item_description),
      item_photo: normalizeArray(rowData.item_photo),
      item_code: rowData.item_code ?? "",
    });
    setProductOffers({});
    setViewMode(false);
    setDraggedProduct(null);
    setShowTrash(false);
    setActiveRowIndex(null);
    setPickerStep("list");
    setPendingProduct(null);
    setActiveTab("items");
    setProductSearch("");
    setShowPipeModal(false);
    setPendingPipeProduct(null);
    setPendingPipeRowIndex(null);

    // Only initialize a new timer if no draft exists yet
    // The draft loading useEffect will override this if a draft with saved time is found
    const start = new Date().toISOString();
    setSpfCreationStartTime(start);
    setSpfCreationEndTime(null);
    setTimerActive(true);

    fetchProducts(rowData.customer_name || "");
  }, [open, rowData, processBy]);

  /* ── Check for existing draft and load it ── */
  useEffect(() => {
    if (!open || !formData.spf_number) return;

    const loadDraft = async () => {
      try {
        const res = await fetch(`/api/request/spf-request-get-draft-api?spf_number=${formData.spf_number}`);
        const data = await res.json();

        if (data?.success && data?.hasDraft) {
          setHasDraft(true);
          // Load the draft product offers
          if (data.productOffers) {
            setProductOffers(data.productOffers);
            setDraftLoaded(true);
            toast.info("Draft loaded. You can continue where you left off.");
          }
          // Restore the saved timer start time from draft - timer continues running
          if (data.draft?.spf_creation_start_time) {
            setSpfCreationStartTime(data.draft.spf_creation_start_time);
            setTimerActive(true);
          }
        } else {
          setHasDraft(false);
          setDraftLoaded(false);
        }
      } catch (err) {
        console.error("Error loading draft:", err);
      }
    };

    loadDraft();
  }, [open, formData.spf_number]);

  /* ── Product search filter ── */
  useEffect(() => {
    if (!productSearch) {
      setFilteredProducts(products);
      return;
    }
    const term = productSearch.toLowerCase();
    setFilteredProducts(
      products.filter(
        (p: any) =>
          (p.productName?.toLowerCase() || "").includes(term) ||
          (p.supplier?.supplierBrand?.toLowerCase() || "").includes(term) ||
          (p.supplier?.company?.toLowerCase() || "").includes(term) ||
          JSON.stringify(p.commercialDetails || "")
            .toLowerCase()
            .includes(term),
      ),
    );
  }, [productSearch, products]);

  /* ── Reset pagination when filters change ── */
  useEffect(() => {
    setProductPage(1);
  }, [filteredProducts, productSearch]);

  /* ── Fetch products ── */
  const fetchProducts = useCallback((_customerName: string) => {
    setLoadingProducts(true);
    const q = query(collection(db, "products"), where("isActive", "==", true));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort(
          (a: any, b: any) =>
            (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0),
        );
      setProducts(list);
      setFilteredProducts(list);
      setLoadingProducts(false);
    });
    return unsubscribe;
  }, []);

  /* ── Helpers ── */
  const freezeSpecs = (product: any) => {
    const activeFilters = (window as any).__ACTIVE_FILTERS__ || [];
    if (!product.technicalSpecifications) return product;
    const frozenSpecs = product.technicalSpecifications.map((group: any) => ({
      ...group,
      specs: group.specs?.map((spec: any) => {
        const raw = spec.value || "";
        const values = raw
          .split("|")
          .map((v: string) => v.trim())
          .filter(Boolean);
        const unique = Array.from(new Set(values)) as string[];
        if (!activeFilters.length)
          return { ...spec, value: unique.join(" | ") };
        const filtered = unique.filter((v) => activeFilters.includes(v));
        return {
          ...spec,
          value: filtered.length ? filtered.join(" | ") : unique.join(" | "),
        };
      }),
    }));
    // Preserve __originalTechnicalSpecifications if it exists
    const originalSpecs = product.__originalTechnicalSpecifications || product.technicalSpecifications;
    return { 
      ...product, 
      technicalSpecifications: frozenSpecs,
      __originalTechnicalSpecifications: originalSpecs,
    };
  };

  /* ── Add product to a row (shared logic after pipe check) ── */
  const addProductToRow = (rowIndex: number, product: any) => {
    setProductOffers((prev) => {
      const copy = { ...prev };
      copy[rowIndex] = [
        ...(copy[rowIndex] || []),
        { 
          ...product, 
          qty: product.qty ?? 1,
          // Store original specs for editing later
          __originalTechnicalSpecifications: product.__originalTechnicalSpecifications || product.technicalSpecifications,
        },
      ];
      return copy;
    });
  };

  /* ── Intercept product before adding — check for pipes ── */
  const tryAddProduct = (rowIndex: number, product: any) => {
    const frozen = freezeSpecs(product);
    if (hasMultipleSpecValues(frozen)) {
      setPendingPipeProduct(frozen);
      setPendingPipeRowIndex(rowIndex);
      setShowPipeModal(true);
    } else {
      addProductToRow(rowIndex, frozen);
    }
  };

  const removeProduct = (rowIndex: number, productIndex: number) => {
    setProductOffers((prev) => {
      const copy = { ...prev };
      const arr = [...(copy[rowIndex] || [])];
      arr.splice(productIndex, 1);
      copy[rowIndex] = arr;
      return copy;
    });
  };

  /* ── Mobile: tap-to-add ── */
  const handleProductTap = (product: any) => {
    if (activeRowIndex === null) {
      toast.error("Select a row first before adding a product.");
      setActiveTab("items");
      return;
    }
    // Store original specs before freezing
    const productWithOriginalSpecs = {
      ...product,
      __originalTechnicalSpecifications: product.technicalSpecifications,
    };
    // Check pipe before showing confirm sheet
    const frozen = freezeSpecs(productWithOriginalSpecs);
    if (hasMultipleSpecValues(frozen)) {
      // Store row index in a local var so pipe modal has it
      setPendingPipeProduct(frozen);
      setPendingPipeRowIndex(activeRowIndex);
      setShowPipeModal(true);
      // Don't navigate away — pipe modal will handle adding
    } else {
      setPendingProduct(frozen);
      setPickerStep("confirm");
    }
  };

  const confirmAddProduct = () => {
    if (activeRowIndex === null || !pendingProduct) return;
    addProductToRow(activeRowIndex, pendingProduct);
    setPendingProduct(null);
    setPickerStep("list");
    toast.success("Product added!");
  };

  const cancelConfirm = () => {
    setPendingProduct(null);
    setPickerStep("list");
  };

  /* ── MultipleSpecsDetected confirm ── */
  const handlePipeConfirm = (filteredProduct: any) => {
    if (pendingPipeRowIndex === null) return;
    // For mobile flow: after pipe modal, we skip the confirm sheet and add directly
    addProductToRow(pendingPipeRowIndex, { ...filteredProduct, qty: 1 });
    toast.success("Product added!");
    setPendingPipeProduct(null);
    setPendingPipeRowIndex(null);
    setShowPipeModal(false);
    // Also clear mobile confirm state just in case
    setPendingProduct(null);
    setPickerStep("list");
  };

  /* ── Open specs revision modal for a product in product offers ── */
  const openSpecsRevision = (rowIndex: number, optionIndex: number) => {
    const product = productOffers[rowIndex]?.[optionIndex];
    if (!product) return;

    // Use original specs if available, otherwise current specs
    const specsToUse = product.__originalTechnicalSpecifications || product.technicalSpecifications;
    const productWithOriginalSpecs = {
      ...product,
      technicalSpecifications: specsToUse,
    };

    // Create a frozen copy of the product specs for revision
    const frozen = freezeSpecs(productWithOriginalSpecs);
    if (hasMultipleSpecValues(frozen)) {
      setPendingPipeProduct(frozen);
      setPendingPipeRowIndex(rowIndex);
      setPendingPipeOptionIndex(optionIndex);
      setIsEditingSpecs(true);
      setShowPipeModal(true);
    } else {
      toast.info("No multiple specification values detected for this product.");
    }
  };

  /* ── Handle specs revision confirmation ── */
  const handleSpecsRevisionConfirm = (filteredProduct: any) => {
    if (pendingPipeRowIndex === null || pendingPipeOptionIndex === null) return;

    // Update the product with revised specs
    setProductOffers((prev) => {
      const copy = { ...prev };
      const row = [...(copy[pendingPipeRowIndex] || [])];
      row[pendingPipeOptionIndex] = {
        ...row[pendingPipeOptionIndex],
        technicalSpecifications: filteredProduct.technicalSpecifications,
        __specsRevised: true,
      };
      copy[pendingPipeRowIndex] = row;
      return copy;
    });

    toast.success("Product specifications updated!");
    setPendingPipeProduct(null);
    setPendingPipeRowIndex(null);
    setPendingPipeOptionIndex(null);
    setIsEditingSpecs(false);
    setShowPipeModal(false);
  };

  const handlePipeClose = () => {
    setPendingPipeProduct(null);
    setPendingPipeRowIndex(null);
    setPendingPipeOptionIndex(null);
    setIsEditingSpecs(false);
    setShowPipeModal(false);
    setDraggedProduct(null);
    setShowTrash(false);
  };

  /* ── Add Button Click Handler ── */
  const handleAddButtonClick = (product: any) => {
    const itemCount = formData.item_description?.length || 0;
    
    if (itemCount === 0) {
      toast.error("No items available. Please add items first.");
      return;
    }
    
    if (itemCount === 1) {
      // If only 1 item, add directly to row 0
      const productWithOriginalSpecs = {
        ...product,
        __originalTechnicalSpecifications: product.technicalSpecifications,
      };
      tryAddProduct(0, productWithOriginalSpecs);
    } else {
      // If multiple items, show row selection dialog
      const productWithOriginalSpecs = {
        ...product,
        __originalTechnicalSpecifications: product.technicalSpecifications,
      };
      setPendingRowSelectProduct(productWithOriginalSpecs);
      setShowRowSelectModal(true);
    }
  };

  /* ── Row Selection Confirm ── */
  const handleRowSelectConfirm = (selectedRowIndex: number) => {
    if (pendingRowSelectProduct === null) return;
    tryAddProduct(selectedRowIndex, pendingRowSelectProduct);
    toast.success(`Product added to row ${selectedRowIndex + 1}!`);
    setShowRowSelectModal(false);
    setPendingRowSelectProduct(null);
  };

  /* ── Row Selection Cancel ── */
  const handleRowSelectCancel = () => {
    setShowRowSelectModal(false);
    setPendingRowSelectProduct(null);
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (isSubmitting) return; // Prevent double submission
    
    // ✅ VALIDATION: check if every row has at least 1 product
    const totalRows = formData.item_description?.length || 0;

    for (let i = 0; i < totalRows; i++) {
      if (!productOffers[i] || productOffers[i].length === 0) {
        toast.error(`Item row ${i + 1} has no product selected`);
        return;
      }
      for (let j = 0; j < productOffers[i].length; j++) {
        const prod = productOffers[i][j];
        if (!prod.__priceValidity || prod.__priceValidity.trim() === "") {
          toast.error(`Row ${i + 1}, Option ${j + 1}: Price Validity is required`);
          return;
        }

        // Validate branch selection for products with multiple countries
        const availableCountries = prod.countries || [];
        if (availableCountries.length > 1) {
          const selectedBranch = prod.__selectedBranch;
          if (!selectedBranch || selectedBranch.trim() === "") {
            toast.error(`Row ${i + 1}, Option ${j + 1}: Branch selection is required (multiple countries available)`);
            return;
          }
        }
        if (!prod.__tdsBrand || prod.__tdsBrand.trim() === "") {
          toast.error(`Row ${i + 1}, Option ${j + 1}: TDS Brand is required`);
          return;
        }
      }
    }

    setIsSubmitting(true);
    const end = new Date().toISOString();
    setSpfCreationEndTime(end);
    setTimerActive(false);

    try {
      const allProducts = Object.entries(productOffers).flatMap(
        ([rowIndex, prods]) =>
          prods.map((p) => ({ 
            ...p, 
            __rowIndex: Number(rowIndex),
            price_validity: p.__priceValidity ?? p.price_validity,
            // Include original specs for later editing
            __originalTechnicalSpecifications: p.__originalTechnicalSpecifications || p.technicalSpecifications,
            // Include product reference ID for syncing changes from Firebase
            productReferenceID: p.productReferenceID || p.id || null,
          })),
      );

      const res = await fetch("/api/request/spf-request-create-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          selectedProducts: allProducts,
          totalItemRows: formData.item_description?.length ?? 1,
          spf_creation_start_time: spfCreationStartTime,
          spf_creation_end_time: end,
          userId,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("API ERROR:", errText);
        toast.error("Failed to create SPF request");
        throw new Error("Failed to create SPF request");
      }

      const data = await res.json();
      if (data?.success) {
        toast.success("SPF created successfully");
        
        // Trigger notification for SPF creation
        if (userId) {
          onSPFCreated({
            userId,
            spfNumber: formData.spf_number || "Unknown SPF",
            spfId: data.spfId || formData.id,
            url: "/spf-requests",
          });
        }
      }
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("Something went wrong while creating SPF");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ── Save Draft ── */
  const handleSaveDraft = async () => {
    if (isSavingDraft) return;

    setIsSavingDraft(true);
    try {
      const allProducts = Object.entries(productOffers).flatMap(
        ([rowIndex, prods]) =>
          prods.map((p) => ({
            ...p,
            __rowIndex: Number(rowIndex),
            price_validity: p.__priceValidity ?? p.price_validity,
            __originalTechnicalSpecifications: p.__originalTechnicalSpecifications || p.technicalSpecifications,
            productReferenceID: p.productReferenceID || p.id || null,
          })),
      );

      const res = await fetch("/api/request/spf-request-save-draft-api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spf_number: formData.spf_number,
          item_code: formData.item_code,
          selectedProducts: allProducts,
          totalItemRows: formData.item_description?.length ?? 1,
          spf_creation_start_time: spfCreationStartTime,
          is_edit_mode: false,
          original_spf_number: null,
          userId,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Draft save error:", errText);
        toast.error("Failed to save draft");
        return;
      }

      const data = await res.json();
      if (data?.success) {
        setHasDraft(true);
        toast.success("Draft saved successfully");
      }
    } catch (err: any) {
      console.error("Draft save error:", err);
      toast.error("Failed to save draft");
    } finally {
      setIsSavingDraft(false);
    }
  };

  /* ════════════════════════════════════════════════════════════ */
  /* MOBILE LAYOUT                                               */
  /* ════════════════════════════════════════════════════════════ */
  const renderMobile = () => (
    <>
      <DialogHeader className="px-4 pt-4 pb-2 border-b shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-sm font-semibold truncate">
              {formData.spf_number || "Create SPF"}
            </DialogTitle>
            {draftLoaded && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                Draft Loaded
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <input
              type="text"
              placeholder="Search..."
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              className="border px-2 py-1 text-xs w-32.5 rounded"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8 rounded"
              onClick={() => setOpenFilter((p) => !p)}
            >
              <Funnel size={14} />
            </Button>
              {canAddProduct && (
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs rounded"
                  onClick={() => setOpenAddProduct(true)}
                >
                  + Add
                </Button>
              )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex mt-2 border rounded overflow-hidden text-xs font-medium">
          {(["details", "items", "products"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-1.5 capitalize transition-colors ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "products" && (
          <div
            className={`mt-1 text-[11px] px-2 py-1 rounded ${
              activeRowIndex !== null
                ? "bg-green-50 text-green-700"
                : "bg-yellow-50 text-yellow-700"
            }`}
          >
            {activeRowIndex !== null
              ? `Adding to: ${formData.spf_number}-${String(activeRowIndex + 1).padStart(3, "0")}`
              : "⚠ Tap a row in Items tab to select it first"}
          </div>
        )}
      </DialogHeader>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* TAB: DETAILS */}
        {activeTab === "details" && (
          <div className="p-4 space-y-4">
            <CardDetails
              title="Company Details"
              fields={[
                { label: "Customer Name", value: formData.customer_name },
                { label: "Contact Person", value: formData.contact_person },
                { label: "Contact Number", value: formData.contact_number },
                {
                  label: "Registered Address",
                  value: formData.registered_address,
                  pre: true,
                },
                { label: "Delivery Address", value: formData.delivery_address },
                { label: "Billing Address", value: formData.billing_address },
                {
                  label: "Collection Address",
                  value: formData.collection_address,
                },
                { label: "TIN", value: formData.tin_no },
              ]}
            />
            <CardDetails
              title="SPF Details"
              fields={[
                { label: "Item Qty", value: formData.item_qty },
                { label: "Payment Terms", value: formData.payment_terms },
                { label: "Warranty", value: formData.warranty },
                { label: "Delivery Date", value: formData.delivery_date },
                { label: "Prepared By", value: formData.prepared_by },
                { label: "Approved By", value: formData.approved_by },
                { label: "Process By", value: formData.process_by },
                { label: "Manager", value: formData.manager },
              ]}
            />
          </div>
        )}

        {/* TAB: ITEMS */}
        {activeTab === "items" && (
          <div className="p-3 space-y-3">
            {!formData.item_description?.length ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No items added yet.
              </p>
            ) : (
              formData.item_description.map((desc, index) => {
                const isActive = activeRowIndex === index;
                const offers = productOffers[index] || [];
                return (
                  <div
                    key={index}
                    className={`border rounded-lg overflow-hidden transition-all ${
                      isActive ? "border-red-500 shadow-md" : "border-border"
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setActiveRowIndex(isActive ? null : index);
                        if (!isActive) setActiveTab("products");
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setActiveRowIndex(isActive ? null : index);
                          if (!isActive) setActiveTab("products");
                        }
                      }}
                      className={`w-full flex items-center gap-3 p-3 cursor-pointer select-none ${
                        isActive ? "bg-red-50" : "bg-muted/30"
                      }`}
                    >
                      <span
                        className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                          isActive
                            ? "bg-red-600 text-white"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {index + 1}
                      </span>
                      {formData.item_photo?.[index] ? (
                        <img
                          src={formData.item_photo[index]}
                          className="w-10 h-10 object-contain shrink-0 rounded"
                          alt=""
                        />
                      ) : (
                        <div className="w-10 h-10 bg-muted rounded shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                          No img
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium line-clamp-2">
                          {desc.replace(/\|/g, " · ")}
                        </p>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {(() => {
                            const qtys = (formData.item_qty || "").split(",").map((q: string) => q.trim());
                            return qtys[index] ? `Qty: ${qtys[index]}` : null;
                          })()}
                        </p>
                        <p
                          className={`text-[10px] mt-0.5 ${isActive ? "text-red-600" : "text-muted-foreground"}`}
                        >
                          {isActive
                            ? "Selected — tap Products to add"
                            : `${offers.length} product${offers.length !== 1 ? "s" : ""} added`}
                        </p>
                      </div>
                      {isActive ? (
                        <ChevronUp
                          size={14}
                          className="text-red-500 shrink-0"
                        />
                      ) : (
                        <ChevronDown
                          size={14}
                          className="text-muted-foreground shrink-0"
                        />
                      )}
                    </div>

                    {offers.length > 0 && (
                      <div className="border-t divide-y">
                        {offers.map((prod: any, i: number) => {
                          const unitCost =
                            prod?.commercialDetails?.unitCost || "-";
                          const qty = prod.qty ?? 1;
                          const cost = Number(
                            prod?.commercialDetails?.unitCost || 0,
                          );
                          const subtotal = qty * cost;
                          const packagingData = prod?.commercialDetails?.packaging;
                          let packagingDisplay: React.ReactNode = "-";
                          if (packagingData) {
                            const length = packagingData.length || "-";
                            const width = packagingData.width || "-";
                            const height = packagingData.height || "-";
                            packagingDisplay = `${length} × ${width} × ${height}`;
                          }
                          const factory =
                            prod?.commercialDetails?.factoryAddress || "-";
                          const warranty =
                            prod?.commercialDetails?.warranty || "-";
                          const port =
                            prod?.commercialDetails?.portOfDischarge || "-";
                          const supplierBrand =
                            prod?.supplier?.supplierBrand ||
                            prod?.supplier?.supplierBrandName ||
                            "";

                          return (
                            <div key={i} className="p-3 flex gap-3 items-start">
                              {prod.mainImage?.url ? (
                                <img
                                  src={prod.mainImage.url}
                                  className="w-14 h-14 object-contain rounded shrink-0"
                                  alt=""
                                />
                              ) : (
                                <div className="w-14 h-14 bg-muted rounded shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                                  No img
                                </div>
                              )}
                              <div className="flex-1 min-w-0 space-y-1">
                                <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  Option {i + 1}
                                  {supplierBrand && ` · ${supplierBrand}`}
                                </span>
                                <p className="text-xs font-medium line-clamp-1">
                                  {prod.productName}
                                </p>
                                {(prod?.supplier?.company || supplierBrand) && (
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    {[prod?.supplier?.company, supplierBrand]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                )}
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-muted-foreground">
                                    Qty
                                  </span>
                                  <input
                                    type="number"
                                    min={1}
                                    className="border rounded px-2 py-0.5 text-xs w-16"
                                    placeholder="0"
                                    value={prod.qty || 1}
                                    onChange={(e) => {
                                      let qty = Number(e.target.value);
                                      if (qty < 1) qty = 1;
                                      setProductOffers((prev) => {
                                        const copy = { ...prev };
                                        const row = [...(copy[index] || [])];
                                        row[i] = { ...row[i], qty };
                                        copy[index] = row;
                                        return copy;
                                      });
                                    }}
                                  />
                                  <span className="text-[10px] text-muted-foreground ml-auto">
                                    Unit: {unitCost}
                                  </span>
                                </div>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-muted-foreground shrink-0">Price Validity</span>
                                    <input
                                      type="datetime-local"
                                      className="border rounded px-2 py-0.5 text-xs flex-1"
                                      value={prod.__priceValidity ?? ""}
                                      onChange={(e) => {
                                        setProductOffers((prev) => {
                                          const copy = { ...prev };
                                          const row = [...(copy[index] || [])];
                                          row[i] = { ...row[i], __priceValidity: e.target.value, price_validity: e.target.value };
                                          copy[index] = row;
                                          return copy;
                                        });
                                      }}
                                    />
                                  </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] text-muted-foreground shrink-0">TDS Brand</span>
                                  <select
                                    className="border rounded px-2 py-0.5 text-xs flex-1"
                                    value={prod.__tdsBrand ?? ""}
                                    onChange={(e) => {
                                      const brand = e.target.value;
                                      setProductOffers((prev) => {
                                        const copy = { ...prev };
                                        const row = [...(copy[index] || [])];
                                        row[i] = { ...row[i], __tdsBrand: brand };
                                        copy[index] = row;
                                        return copy;
                                      });
                                    }}
                                  >
                                    <option value="">-- Brand --</option>
                                    {["Lit", "Lumera", "Ecoshift"].map((b) => (
                                      <option key={b} value={b}>{b}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  <p>Pack: {packagingDisplay}</p>
                                  <p>Warranty: {warranty}</p>
                                </div>
                                {factory !== "-" && (
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    Factory: {factory}
                                  </p>
                                )}
                                {port !== "-" && (
                                  <p className="text-[10px] text-muted-foreground truncate">
                                    Port: {port}
                                  </p>
                                )}
                                {qty > 0 && (
                                  <p className="text-xs font-semibold text-right">
                                    $
                                    {subtotal.toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </p>
                                )}
                                <InlineSpecs
                                  specs={prod.technicalSpecifications ?? []}
                                />
                                {/* Edit Specs Button for mobile */}
                                {hasMultipleSpecValues({ 
                                  technicalSpecifications: prod.__originalTechnicalSpecifications || prod.technicalSpecifications 
                                }) && (
                                  <button
                                    type="button"
                                    onClick={() => openSpecsRevision(index, i)}
                                    className="mt-2 px-2 py-1 text-[10px] bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 w-full"
                                  >
                                    Edit Specs
                                  </button>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeProduct(index, i)}
                                className="text-destructive/60 hover:text-destructive mt-0.5 shrink-0"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB: PRODUCTS */}
        {activeTab === "products" && (
          <div className="p-3">
            {/* Confirm bottom sheet */}
            {pickerStep === "confirm" && pendingProduct && (
              <div className="fixed inset-0 z-50 bg-black/40 flex items-end">
                <div className="bg-background w-full rounded-t-2xl p-5 space-y-4 shadow-xl">
                  <p className="text-sm font-semibold">Add this product?</p>
                  <div className="flex gap-3 items-center">
                    {pendingProduct.mainImage?.url ? (
                      <img
                        src={pendingProduct.mainImage.url}
                        className="w-16 h-16 object-contain rounded shrink-0"
                        alt=""
                      />
                    ) : (
                      <div className="w-16 h-16 bg-muted rounded shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium line-clamp-2">
                        {pendingProduct.productName}
                      </p>
                      {(pendingProduct?.supplier?.supplierBrand ||
                        pendingProduct?.supplier?.supplierBrandName) && (
                        <p className="text-xs text-blue-600 font-medium mt-0.5">
                          {pendingProduct.supplier.supplierBrand ||
                            pendingProduct.supplier.supplierBrandName}
                        </p>
                      )}
                      {activeRowIndex !== null && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          → {formData.spf_number}-
                          {String(activeRowIndex + 1).padStart(3, "0")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 rounded"
                      onClick={cancelConfirm}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 rounded"
                      onClick={confirmAddProduct}
                    >
                      Confirm Add
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {openFilter && (
              <div className="mb-3 border rounded-lg overflow-hidden h-[50vh]">
                <FilteringComponent
                  products={products}
                  onFilter={(filtered) => setFilteredProducts(filtered)}
                />
              </div>
            )}

            {loadingProducts ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Loading products...
              </p>
            ) : filteredProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No products found.
              </p>
            ) : (
              <div className="space-y-2">
                {/* Pagination controls */}
                {filteredProducts.length > PRODUCTS_PER_PAGE && (
                  <div className="flex justify-between items-center mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProductPage(prev => Math.max(1, prev - 1))}
                      disabled={productPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {productPage} of {Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setProductPage(prev => Math.min(Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE), prev + 1))}
                      disabled={productPage === Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)}
                    >
                      Next
                    </Button>
                  </div>
                )}

                {/* Paginated products */}
                {filteredProducts
                  .slice((productPage - 1) * PRODUCTS_PER_PAGE, productPage * PRODUCTS_PER_PAGE)
                  .map((p) => {
                  const supplierBrand =
                    p?.supplier?.supplierBrand ||
                    p?.supplier?.supplierBrandName ||
                    "";
                  const supplierCo = p?.supplier?.company || "";
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleProductTap(p)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          handleProductTap(p);
                      }}
                      className="w-full text-left border rounded-lg overflow-hidden flex gap-3 p-3 hover:bg-muted/40 active:bg-muted transition-colors cursor-pointer select-none"
                    >
                      {p.mainImage?.url ? (
                        <img
                          src={p.mainImage.url}
                          className="w-14 h-14 object-contain rounded shrink-0"
                          alt={p.productName}
                        />
                      ) : (
                        <div className="w-14 h-14 bg-muted rounded shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">
                          No img
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-2">
                          {p.productName}
                        </p>
                        {supplierBrand && (
                          <p className="text-xs font-semibold text-blue-600 mt-0.5 truncate">
                            {supplierBrand}
                          </p>
                        )}
                        {supplierCo && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {supplierCo}
                          </p>
                        )}
                        {p.commercialDetails?.unitCost && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Unit cost: {p.commercialDetails.unitCost}
                          </p>
                        )}
                        {(() => {
                          const details = p.commercialDetails;
                          if (!details) return null;
                          if (details.pcsPerCarton) {
                            return (
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Qty/Per Carton: {details.pcsPerCarton}
                              </p>
                            );
                          }
                          return null;
                        })()}
                        <InlineProductSpecs
                          specs={p.technicalSpecifications ?? []}
                        />
                      </div>
                      <div className="shrink-0 flex items-center">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            activeRowIndex !== null
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Plus size={16} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <DialogFooter className="px-4 py-3 border-t shrink-0 flex-col gap-2">
        <div className="w-full mb-2">
          <SPFTimer
            isActive={timerActive}
            startTime={spfCreationStartTime}
            label="Create SPF Timer"
            onStart={(v) => setSpfCreationStartTime(v)}
            onStop={(v) => setSpfCreationEndTime(v)}
            onTick={() => {}}
          />
        </div>
        <div className="w-full flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 rounded"
            onClick={() => {
              setViewMode((p) => !p);
              if (!viewMode) setActiveTab("items");
            }}
          >
            {viewMode ? "Edit" : "Preview"}
          </Button>
          {viewMode && (
            <Button
              type="button"
              className="flex-1 rounded"
              onClick={handleSubmit}
              disabled={
                isSubmitting ||
                (formData.item_description?.length || 0) === 0 ||
                formData.item_description?.some(
                  (_, i) => !productOffers[i] || productOffers[i].length === 0,
                ) ||
                Object.values(productOffers).flat().some(
                  (p: any) => !p.__priceValidity?.trim() || !p.__tdsBrand?.trim() ||
                    (p.countries?.length > 1 && !p.__selectedBranch?.trim())
                )
              }
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          )}
        </div>
        <div className="w-full">
          <Button
            type="button"
            variant="secondary"
            className="w-full rounded"
            onClick={handleSaveDraft}
            disabled={isSavingDraft || (formData.item_description?.length || 0) === 0}
          >
            <Save size={16} className="mr-2" />
            {isSavingDraft ? "Saving..." : hasDraft ? "Update Draft" : "Save Draft"}
          </Button>
        </div>
      </DialogFooter>

      {/* ── MultipleSpecsDetected — rendered OUTSIDE Dialog scroll area to avoid close ── */}
      <MultipleSpecsDetected
        open={showPipeModal}
        onClose={handlePipeClose}
        product={pendingPipeProduct}
        onConfirm={isEditingSpecs ? handleSpecsRevisionConfirm : handlePipeConfirm}
      />
    </>
  );

  /* ════════════════════════════════════════════════════════════ */
  /* DESKTOP LAYOUT                                              */
  /* ════════════════════════════════════════════════════════════ */
  const renderDesktop = () => (
    <>
      <DialogHeader className="w-full mb-4 relative">
        <div className="flex items-center justify-center gap-2">
          <DialogTitle className="text-center">
            Create SPF Request
          </DialogTitle>
          {draftLoaded && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
              Draft Loaded
            </span>
          )}
        </div>
        <div className="absolute right-0 top-0 flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search product..."
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            className="border px-3 py-2 text-sm w-55"
          />
          <Button
            size="icon"
            variant="outline"
            className="rounded-none p-6"
            onClick={() => setOpenFilter((prev) => !prev)}
          >
            <Funnel size={16} />
          </Button>
          {canAddProduct && (
            <Button
              className="rounded-none p-6"
              onClick={() => setOpenAddProduct(true)}
            >
              + Add Product
            </Button>
          )}
        </div>

        {showTrash && (
          <div className="flex justify-center mt-3">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (viewMode || !draggedProduct) return;
                if (draggedProduct.__fromRow !== undefined) {
                  setProductOffers((prev) => {
                    const copy = { ...prev };
                    const arr = [...(copy[draggedProduct.__fromRow] || [])];
                    arr.splice(draggedProduct.__fromIndex, 1);
                    copy[draggedProduct.__fromRow] = arr;
                    return copy;
                  });
                }
                setDraggedProduct(null);
                setShowTrash(false);
              }}
              className="flex items-center gap-2 border border-dashed border-destructive/40 text-destructive text-xs px-4 py-2 rounded-md bg-muted/40 hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              🗑 <span className="font-medium">Drag here to delete</span>
            </div>
          </div>
        )}
      </DialogHeader>

      <div className="flex gap-4 overflow-hidden">
        {/* LEFT: Details + Items table */}
        <Card
          className={`${viewMode ? "w-full" : "w-[70%]"} transition-all duration-500 ease-in-out p-4 flex flex-col gap-4 overflow-y-auto max-h-[70vh] overscroll-contain`}
        >
          <div className="grid grid-cols-1 gap-4">
            <CardDetails
              title="Company Details"
              fields={[
                { label: "Customer Name", value: formData.customer_name },
                { label: "Contact Person", value: formData.contact_person },
                { label: "Contact Number", value: formData.contact_number },
                {
                  label: "Registered Address",
                  value: formData.registered_address,
                  pre: true,
                },
                { label: "Delivery Address", value: formData.delivery_address },
                { label: "Billing Address", value: formData.billing_address },
                {
                  label: "Collection Address",
                  value: formData.collection_address,
                },
                { label: "TIN", value: formData.tin_no },
              ]}
            />
            <CardDetails
              title="SPF Details"
              fields={[
                { label: "Item Qty", value: formData.item_qty },
                { label: "Payment Terms", value: formData.payment_terms },
                { label: "Warranty", value: formData.warranty },
                { label: "Delivery Date", value: formData.delivery_date },
                { label: "Prepared By", value: formData.prepared_by },
                { label: "Approved By", value: formData.approved_by },
                { label: "Process By", value: formData.process_by },
                { label: "Manager", value: formData.manager },
              ]}
            />
          </div>

          <div className="mb-3 border-b pb-2">
            <h3 className="text-sm font-bold">{formData.spf_number || "-"}</h3>
          </div>

          <div className="mt-4 overflow-y-auto relative">
            {formData.item_description?.length ? (
              <table className="w-full table-fixed border text-[10px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border px-1 py-1 text-center w-15">#</th>
                    <th className="border px-1 py-1 text-center w-28">Image</th>
                    <th className="border px-1 py-1 text-center w-24">Item Qty</th>
                    <th className="border px-1 py-1 text-center w-30">
                      Item Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(formData.item_description || []).map((desc, index) => (
                    <React.Fragment key={`row-${index}`}>
                      <tr
                        className="text-[10px]"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (viewMode || !draggedProduct) return;
                          const frozen =
                            draggedProduct.__fromRow !== undefined
                              ? draggedProduct
                              : freezeSpecs(draggedProduct);
                          if (hasMultipleSpecValues(frozen)) {
                            if (draggedProduct.__fromRow !== undefined) {
                              setProductOffers((prev) => {
                                const copy = { ...prev };
                                const original = [
                                  ...(copy[draggedProduct.__fromRow] || []),
                                ];
                                original.splice(draggedProduct.__fromIndex, 1);
                                copy[draggedProduct.__fromRow] = original;
                                return copy;
                              });
                            }
                            setPendingPipeProduct(frozen);
                            setPendingPipeRowIndex(index);
                            setShowPipeModal(true);
                            setDraggedProduct(null);
                            setShowTrash(false);
                          } else {
                            setProductOffers((prev) => {
                              const copy = { ...prev };
                              if (draggedProduct.__fromRow !== undefined) {
                                const original = [
                                  ...(copy[draggedProduct.__fromRow] || []),
                                ];
                                original.splice(draggedProduct.__fromIndex, 1);
                                copy[draggedProduct.__fromRow] = original;
                              }
                              copy[index] = [
                                ...(copy[index] || []),
                                { ...frozen, qty: frozen.qty ?? 1 },
                              ];
                              return copy;
                            });
                            setDraggedProduct(null);
                          }
                        }}
                      >
                        <td className="border px-1 py-1 font-medium text-center align-middle text-[10px]">
                          {formData.spf_number
                            ? `${formData.spf_number}-${String(index + 1).padStart(3, "0")}`
                            : "-"}
                        </td>
                        <td className="border px-1 py-1 align-middle">
                          <div className="flex justify-center items-center">
                            {formData.item_photo?.[index] ? (
                              <img
                                src={formData.item_photo[index]}
                                alt={desc}
                                className="w-12 h-12 object-contain cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => openImagePreview(formData.item_photo?.[index])}
                              />
                            ) : (
                              <span className="text-[10px]">-</span>
                            )}
                          </div>
                        </td>
                        <td className="border px-1 py-1 text-center align-middle text-[10px]">
                          {(() => {
                            const qtys = (formData.item_qty || "").split(",").map((q: string) => q.trim());
                            return qtys[index] || "-";
                          })()}
                        </td>
                        <td className="border px-1 py-1 whitespace-pre-wrap text-center align-middle text-[10px] leading-tight select-none">
                          {desc.replace(/\|/g, "\n")}
                        </td>
                      </tr>
                      <tr
                        className="text-[10px]"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          if (viewMode || !draggedProduct) return;
                          const frozen =
                            draggedProduct.__fromRow !== undefined
                              ? draggedProduct
                              : freezeSpecs(draggedProduct);
                          if (hasMultipleSpecValues(frozen)) {
                            if (draggedProduct.__fromRow !== undefined) {
                              setProductOffers((prev) => {
                                const copy = { ...prev };
                                const original = [
                                  ...(copy[draggedProduct.__fromRow] || []),
                                ];
                                original.splice(draggedProduct.__fromIndex, 1);
                                copy[draggedProduct.__fromRow] = original;
                                return copy;
                              });
                            }
                            setPendingPipeProduct(frozen);
                            setPendingPipeRowIndex(index);
                            setShowPipeModal(true);
                            setDraggedProduct(null);
                            setShowTrash(false);
                          } else {
                            setProductOffers((prev) => {
                              const copy = { ...prev };
                              if (draggedProduct.__fromRow !== undefined) {
                                const original = [
                                  ...(copy[draggedProduct.__fromRow] || []),
                                ];
                                original.splice(draggedProduct.__fromIndex, 1);
                                copy[draggedProduct.__fromRow] = original;
                              }
                              copy[index] = [
                                ...(copy[index] || []),
                                { ...frozen, qty: frozen.qty ?? 1 },
                              ];
                              return copy;
                            });
                            setDraggedProduct(null);
                          }
                        }}
                      >
                        <td colSpan={4} className="border px-2 py-1 text-center align-middle">
                          {(productOffers[index] || []).length > 0 && (
                            <div className="border rounded mb-2 overflow-hidden">
                              <div className="max-h-64 overflow-y-auto">
                              <table className="w-full table-fixed text-[9px]">
                              <thead className="bg-muted sticky top-0 z-10">
                                <tr>
                                  <th colSpan={16} className="border px-0.5 py-0.5 text-center text-[9px] font-bold bg-orange-100 text-orange-700">
                                    Product Offer
                                  </th>
                                </tr>
                                <tr>
                                  <th className="border px-0.5 py-0.5 text-center w-6 text-[9px]">
                                    Actions
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-10">
                                    Opt
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-12.5">
                                    Brand
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-12.5">
                                    Branch
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-20">
                                    Image
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-7.5">
                                    Qty
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-16.25">
                                    Price Validity
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-8.75">
                                    TDS
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-22.5">
                                    Technical Specs
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-10">
                                    Unit Cost
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-7.5">
                                    Qty/Ctn
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-8">
                                    Commercial Type
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-11.25">
                                    Packaging
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-11.25">
                                    Warranty
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-11.25">
                                    Factory
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-8.75">
                                    Port
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-10">
                                    Subtotal
                                  </th>
                                  <th className="border px-0.5 py-0.5 text-center w-20">
                                    PD Remarks
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {(productOffers[index] || []).map(
                                  (prod: any, i: number) => {
                                    const unitCost =
                                      prod?.commercialDetails?.unitCost || "-";
                                    const commercialType = prod?.commercialDetails?.commercialType || "BASIC";
                                    const useArrayInput = prod?.commercialDetails?.useArrayInput || false;
                                    const totalUnitCost = prod?.commercialDetails?.totalUnitCost || 0;
                                    const multiRows = prod?.commercialDetails?.multiRows || [];
                                    
                                    const packagingData = prod?.commercialDetails?.packaging;
                                    let packagingDisplay: React.ReactNode = "-";
                                    let qtyCtnDisplay: React.ReactNode = "-";
                                    let commercialTypeDisplay: React.ReactNode = "-";
                                    
                                    // Determine commercial type display and packaging display based on type
                                    if (commercialType === "BASIC") {
                                      commercialTypeDisplay = "Basic";
                                      if (packagingData) {
                                        const length = packagingData.length || "-";
                                        const width = packagingData.width || "-";
                                        const height = packagingData.height || "-";
                                        packagingDisplay = `${length} × ${width} × ${height}`;
                                        qtyCtnDisplay = prod?.commercialDetails?.pcsPerCarton || "-";
                                      }
                                    } else if (commercialType === "LIGHT") {
                                      if (useArrayInput) {
                                        // Light Multiple Dimension
                                        commercialTypeDisplay = "Light (Multiple)";
                                        // Packaging: Show item name, dimensions, and cost per row for each array row
                                        packagingDisplay = (
                                          <div className="space-y-1">
                                            {multiRows.map((row: any, idx: number) => (
                                              <div key={idx} className="text-[8px] leading-tight">
                                                <div className="font-medium">{row.itemName || `Item ${idx + 1}`}</div>
                                                <div>{row.length || "-"} × {row.width || "-"} × {row.height || "-"}</div>
                                                <div className="text-gray-500">{row.unitCost?.toFixed(2) || "0.00"} USD</div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                        // Qty/Ctn: Show item name and qty/box for each row
                                        qtyCtnDisplay = (
                                          <div className="space-y-1">
                                            {multiRows.map((row: any, idx: number) => (
                                              <div key={idx} className="text-[8px] leading-tight">
                                                <div className="font-medium">{row.itemName || `Item ${idx + 1}`}</div>
                                                <div>Qty: {row.qtyPerCarton || "-"}</div>
                                              </div>
                                            ))}
                                          </div>
                                        );
                                      } else {
                                        // Light Single Dimension
                                        commercialTypeDisplay = "Light (Single)";
                                        // Packaging: Show length, width, height
                                        if (packagingData) {
                                          const length = packagingData.length || "-";
                                          const width = packagingData.width || "-";
                                          const height = packagingData.height || "-";
                                          packagingDisplay = `${length} × ${width} × ${height}`;
                                        }
                                        // Qty/Ctn: Show qty/box
                                        qtyCtnDisplay = prod?.commercialDetails?.pcsPerCarton || "-";
                                      }
                                    } else if (commercialType === "POLE") {
                                      commercialTypeDisplay = "Pole";
                                      // Pole: No packaging
                                      packagingDisplay = "-";
                                      qtyCtnDisplay = "-";
                                    }
                                    const factory =
                                      prod?.commercialDetails?.factoryAddress ||
                                      "-";
                                    const warranty =
                                      prod?.commercialDetails?.warranty || "-";
                                    const port =
                                      prod?.commercialDetails
                                        ?.portOfDischarge || "-";
                                    const brand =
                                      prod?.supplier?.supplierBrand ||
                                      prod?.supplier?.supplierBrandName ||
                                      "-";

                                    return (
                                      <tr
                                        key={i}
                                        draggable={!viewMode}
                                        className={`bg-orange-50 ${
                                          viewMode
                                            ? "cursor-default"
                                            : "cursor-grab active:cursor-grabbing"
                                        }`}

                                        onDragStart={(e) => {
                                          if (viewMode) return;
                                          e.dataTransfer.setData(
                                            "text/plain",
                                            "dragging",
                                          );
                                          setDraggedProduct({
                                            ...prod,
                                            __fromRow: index,
                                            __fromIndex: i,
                                          });
                                          setShowTrash(true);
                                        }}
                                        onDragEnd={() => {
                                          if (viewMode) return;
                                          setDraggedProduct(null);
                                          setShowTrash(false);
                                        }}
                                      >
                                        <td className="border px-0.5 py-0.5 text-center align-middle">
                                          <button
                                            type="button"
                                            onClick={() => removeProduct(index, i)}
                                            className="text-destructive/60 hover:text-destructive transition-colors"
                                            title="Delete this option"
                                          >
                                            <Trash2 size={14} />
                                          </button>
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle">
                                          <span className="inline-flex items-center text-[9px] font-semibold px-1 py-0 rounded-full bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
                                            {i + 1}
                                          </span>
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle font-medium text-[9px]">
                                          {brand}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px]">
                                          {(() => {
                                            const availableCountries = prod.countries || [];
                                            const selectedBranch = prod.__selectedBranch || (availableCountries.length === 1 ? availableCountries[0] : "");
                                            
                                            if (availableCountries.length === 0) {
                                              return <span>-</span>;
                                            }
                                            
                                            if (availableCountries.length === 1) {
                                              return <span className="font-medium">{availableCountries[0]}</span>;
                                            }
                                            
                                            // Multiple countries - show dropdown
                                            return (
                                              <select
                                                className="border rounded px-0.5 py-0.5 text-[8px] w-full"
                                                value={selectedBranch}
                                                onChange={(e) => {
                                                  const branch = e.target.value;
                                                  setProductOffers((prev) => {
                                                    const copy = { ...prev };
                                                    const row = [...(copy[index] || [])];
                                                    row[i] = { ...row[i], __selectedBranch: branch };
                                                    copy[index] = row;
                                                    return copy;
                                                  });
                                                }}
                                              >
                                                <option value="">-- Select --</option>
                                                {availableCountries.map((country: string) => (
                                                  <option key={country} value={country}>{country}</option>
                                                ))}
                                              </select>
                                            );
                                          })()}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle">
                                          {prod.mainImage?.url ? (
                                            <img
                                              src={prod.mainImage.url}
                                              className="w-16 h-16 object-contain mx-auto cursor-pointer hover:opacity-80 transition-opacity"
                                              alt=""
                                              onClick={() => openImagePreview(prod.mainImage?.url)}
                                            />
                                          ) : (
                                            <span className="text-[9px]">-</span>
                                          )}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle">
                                          <input
                                            type="number"
                                            min={1}
                                            className="w-full border px-0.5 text-[9px]"
                                            placeholder="Qty"
                                            value={prod.qty ?? 1}
                                            onChange={(e) => {
                                              let qty = Number(e.target.value);
                                              if (qty < 1) qty = 1;
                                              setProductOffers((prev) => {
                                                const copy = { ...prev };
                                                const row = [...(copy[index] || [])];
                                                row[i] = { ...row[i], qty };
                                                copy[index] = row;
                                                return copy;
                                              });
                                            }}
                                          />
                                        </td>
                                          <td className="border px-0.5 py-0.5 text-center align-middle">
                                            <input
                                              type="datetime-local"
                                              className="border px-0.5 py-0.5 text-[8px] w-full"
                                              value={prod.__priceValidity ?? ""}
                                              onChange={(e) => {
                                                setProductOffers((prev) => {
                                                  const copy = { ...prev };
                                                  const row = [...(copy[index] || [])];
                                                  row[i] = { ...row[i], __priceValidity: e.target.value, price_validity: e.target.value };
                                                  copy[index] = row;
                                                  return copy;
                                                });
                                              }}
                                            />
                                          </td>
                                          <td className="border px-0.5 py-0.5 text-center align-middle text-[9px]">
                                            <select
                                              className="border rounded px-0.5 py-0.5 text-[8px] w-full"
                                              value={prod.__tdsBrand ?? ""}
                                              onChange={(e) => {
                                                const brand = e.target.value;
                                                setProductOffers((prev) => {
                                                  const copy = { ...prev };
                                                  const row = [...(copy[index] || [])];
                                                  row[i] = { ...row[i], __tdsBrand: brand };
                                                  copy[index] = row;
                                                  return copy;
                                                });
                                              }}
                                            >
                                              <option value="">--</option>
                                              {["Lit", "Lumera", "Ecoshift"].map((b) => (
                                                <option key={b} value={b}>{b}</option>
                                              ))}
                                            </select>
                                            {prod.__tdsBrand && (
                                              <button
                                                type="button"
                                                className="mt-0.5 text-[8px] text-green-600 underline block"
                                                onClick={() => {
                                                  const rowBase = `${formData.spf_number}-${String(index + 1).padStart(3, "0")}`;
                                                  const optionIndexToLetters = (idx: number) => {
                                                    let n = idx;
                                                    let s = "";
                                                    while (n >= 0) {
                                                      s = String.fromCharCode(65 + (n % 26)) + s;
                                                      n = Math.floor(n / 26) - 1;
                                                    }
                                                    return s;
                                                  };
                                                  const rowOffers = productOffers[index] || [];
                                                  const itemCode =
                                                    rowOffers.length > 1
                                                      ? `${rowBase}-${optionIndexToLetters(i)}`
                                                      : rowBase;
                                                  setSelectedRowIndexForTDS(index);
                                                  setSelectedOptionIndexForTDS(i);
                                                  setSelectedProductForTDS({
                                                    ...prod,
                                                    productName: prod.__tdsProductName ?? prod.productName,
                                                    __tdsBrand: prod.__tdsBrand ?? "",
                                                    dimensionalDrawing: prod.dimensionalDrawing ?? null,
                                                    illuminanceDrawing: prod.illuminanceDrawing ?? null,
                                                    itemCode,
                                                  });
                                                  setTdsDialogOpen(true);
                                                }}
                                              >
                                                Generate TDS
                                              </button>
                                            )}
                                            {prod.__tdsPdfUrl && (
                                              <a
                                                href={prod.__tdsPdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="mt-0.5 text-[8px] text-blue-600 underline block"
                                              >
                                                View TDS
                                              </a>
                                            )}
                                          </td>
                                          <td className="border px-0.5 py-0.5 text-center align-middle text-[9px] leading-tight">
                                            {prod.technicalSpecifications
                                              ?.map((g: any) => ({
                                              ...g,
                                              specs: g.specs?.filter(
                                                (s: any) =>
                                                  s.value &&
                                                  s.value.trim() !== "",
                                              ),
                                            }))
                                            .filter(
                                              (g: any) =>
                                                g.specs && g.specs.length > 0,
                                            )
                                            .map((g: any, gi: number) => (
                                              <div key={gi} className="mb-1">
                                                <b className="text-[8px]">{g.title}</b>
                                                <div className="text-[9px]">
                                                  {g.specs.map(
                                                    (s: any, si: number) => (
                                                      <div key={si}>
                                                        {s.specId}: {s.value}
                                                      </div>
                                                    ),
                                                  )}
                                                </div>
                                              </div>
                                            ))}
                                            {hasMultipleSpecValues({ 
                                              technicalSpecifications: prod.__originalTechnicalSpecifications || prod.technicalSpecifications 
                                            }) && (
                                              <button
                                                type="button"
                                                onClick={() => openSpecsRevision(index, i)}
                                                className="mt-1 px-1 py-0.5 text-[8px] bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100"
                                              >
                                                Edit Specs
                                              </button>
                                            )}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px]">
                                          {commercialType === "LIGHT" && useArrayInput ? totalUnitCost : unitCost}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px] leading-tight">
                                          {qtyCtnDisplay}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px] leading-tight">
                                          {commercialTypeDisplay}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px] leading-tight">
                                          {packagingDisplay}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px] leading-tight">
                                          {warranty}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px] leading-tight">
                                          {factory}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px]">
                                          {port}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle text-[9px] font-semibold">
                                          ${(() => {
                                            const qty = prod.qty ?? 1;
                                            const cost = Number(prod?.commercialDetails?.unitCost || 0);
                                            return (qty * cost).toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2});
                                          })()}
                                        </td>
                                        <td className="border px-0.5 py-0.5 text-center align-middle">
                                          <textarea
                                            className="w-full border px-0.5 py-0.5 text-[8px] resize-none"
                                            rows={2}
                                            placeholder="Remarks..."
                                            value={prod.__spfRemarksPD || ""}
                                            onChange={(e) => {
                                              setProductOffers((prev) => {
                                                const copy = { ...prev };
                                                const row = [...(copy[index] || [])];
                                                row[i] = { ...row[i], __spfRemarksPD: e.target.value };
                                                copy[index] = row;
                                                return copy;
                                              });
                                            }}
                                          />
                                        </td>
                                      </tr>
                                    );
                                  },
                                )}
                              </tbody>
                            </table>
                          </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted-foreground">
                No items added yet.
              </p>
            )}
          </div>
        </Card>

        {/* RIGHT: Draggable product cards */}
        <div
          className={`transition-all duration-500 ease-in-out ${
            viewMode
              ? "opacity-0 w-0 overflow-hidden pointer-events-none"
              : "opacity-100 w-[30%]"
          } max-h-[70vh] overflow-y-auto overscroll-contain`}
        >
          {/* Pagination controls for desktop */}
          {filteredProducts.length > PRODUCTS_PER_PAGE && (
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-background z-10 p-2 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductPage(prev => Math.max(1, prev - 1))}
                disabled={productPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {productPage} of {Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProductPage(prev => Math.min(Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE), prev + 1))}
                disabled={productPage === Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)}
              >
                Next
              </Button>
            </div>
          )}

          <div className="columns-2 gap-3">
            {filteredProducts
              .slice((productPage - 1) * PRODUCTS_PER_PAGE, productPage * PRODUCTS_PER_PAGE)
              .map((p) => (
<Card
  key={p.id}
  draggable
  onDragStart={() => {
    setDraggedProduct({ 
      ...p, 
      __fromRow: undefined,
      __originalTechnicalSpecifications: p.technicalSpecifications,
    });
    setShowTrash(true);
  }}
  onDragEnd={() => {
    setDraggedProduct(null);
    setShowTrash(false);
  }}
  className="relative flex flex-col p-2 border shadow hover:shadow-md break-inside-avoid mb-3 cursor-grab"
>
  {/* 🔥 ADD BUTTON - Top Left */}
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      handleAddButtonClick(p);
    }}
    className="absolute top-2 left-2 z-10 bg-white border rounded-full p-1 hover:bg-gray-100 shadow"
    title="Add to row"
  >
    <Plus size={14} className="text-green-600" />
  </button>

  {/* 🔥 EDIT BUTTON */}
{canEditProduct && (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      setSelectedProduct(p);
      setOpenEditProduct(true);
    }}
    className="absolute top-2 right-2 z-10 bg-white border rounded-full p-1 hover:bg-gray-100 shadow"
  >
    <Pencil size={14} className="text-orange-500" />
  </button>
)}
                <div className="h-25 w-full bg-gray-100 flex items-center justify-center overflow-hidden rounded">
                  {p.mainImage?.url ? (
                    <img
                      src={p.mainImage.url}
                      className="w-full h-full object-contain"
                      alt={p.productName}
                    />
                  ) : (
                    <div className="text-xs text-gray-400">No Image</div>
                  )}
                </div>
                <div className="mt-2 flex-1">
                  <p className="text-sm font-semibold line-clamp-2">
                    {p.productName}
                  </p>
                  {(p?.supplier?.supplierBrand ||
                    p?.supplier?.supplierBrandName) && (
                    <p className="text-xs font-semibold text-blue-600 mt-0.5 truncate">
                      {p.supplier.supplierBrand || p.supplier.supplierBrandName}
                    </p>
                  )}
                </div>
                <Accordion
                  type="single"
                  collapsible
                  className="mt-2 border rounded"
                >
                  <AccordionItem value="commercial">
                    <AccordionTrigger className="px-3 text-xs">
                      Commercial Details
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 text-xs space-y-2">
                      {(() => {
                        const details = p.commercialDetails;
                        if (!details) return <p>-</p>;
                        const packaging = details.packaging || {};
                        return (
                          <>
                            {details.factoryAddress && (
                              <p>
                                <span className="font-medium">Factory:</span>{" "}
                                {details.factoryAddress}
                              </p>
                            )}
                            {details.portOfDischarge && (
                              <p>
                                <span className="font-medium">Port:</span>{" "}
                                {details.portOfDischarge}
                              </p>
                            )}
                            {details.unitCost && (
                              <p>
                                <span className="font-medium">Unit Cost:</span>{" "}
                                {details.unitCost}
                              </p>
                            )}
                            {(() => {
                              return (
                                <>
                                  {details.pcsPerCarton && (
                                    <p>
                                      <span className="font-medium">Qty/Per Carton:</span>{" "}
                                      {details.pcsPerCarton}
                                    </p>
                                  )}
                                  {(packaging.height || packaging.length || packaging.width || details.pcsPerCarton) && (
                                    <div>
                                      <p className="font-medium">Packaging</p>
                                      <ul className="ml-3 list-disc">
                                        {packaging.height && <li>Height: {packaging.height}</li>}
                                        {packaging.length && <li>Length: {packaging.length}</li>}
                                        {packaging.width && <li>Width: {packaging.width}</li>}
                                        {details.pcsPerCarton && <li>PCS/Carton: {details.pcsPerCarton}</li>}
                                      </ul>
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </>
                        );
                      })()}
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="technical">
                    <AccordionTrigger className="px-3 text-xs">
                      Technical Specifications
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3 text-xs space-y-2">
                      {p.technicalSpecifications?.length ? (
                        p.technicalSpecifications
                          .filter((g: any) => g.title !== "COMMERCIAL DETAILS")
                          .map((group: any, i: number) => (
                            <div key={i} className="mb-3">
                              <p className="font-semibold">{group.title}</p>
                              <ul className="ml-3 list-disc">
                                {group.specs?.map((spec: any, s: number) => (
                                  <li key={s}>
                                    <span className="font-medium">
                                      {spec.specId}
                                    </span>{" "}
                                    : {spec.value || "-"}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))
                      ) : (
                        <p>-</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Card>
            ))}
          </div>
        </div>

        {/* Filter panel */}
        <div
          className={`transition-all duration-500 ease-in-out ${
            viewMode || !openFilter
              ? "opacity-0 w-0 overflow-hidden pointer-events-none"
              : "opacity-100 w-[320px]"
          } shrink-0 self-start sticky top-0 h-[calc(80vh-200px)] overflow-hidden border-l pl-2`}
        >
          <FilteringComponent
            products={products}
            onFilter={(filtered) => setFilteredProducts(filtered)}
          />
        </div>
      </div>

      <DialogFooter className="mt-4 flex flex-col gap-3">
        <div className="w-full">
          <SPFTimer
            isActive={timerActive}
            startTime={spfCreationStartTime}
            label="Create SPF Timer"
            onStart={(v) => setSpfCreationStartTime(v)}
            onStop={(v) => setSpfCreationEndTime(v)}
            onTick={() => {}}
          />
        </div>
        <div className="w-full flex justify-between items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="rounded-none p-6"
            onClick={handleSaveDraft}
            disabled={isSavingDraft || (formData.item_description?.length || 0) === 0}
          >
            <Save size={18} className="mr-2" />
            {isSavingDraft ? "Saving..." : hasDraft ? "Update Draft" : "Save Draft"}
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-none p-6"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="rounded-none p-6"
              onClick={() => setViewMode((prev) => !prev)}
            >
              {viewMode ? "Back" : "View"}
            </Button>
            {viewMode && (
              <Button
                className="rounded-none p-6"
                onClick={handleSubmit}
                disabled={
                  isSubmitting ||
                  (formData.item_description?.length || 0) === 0 ||
                  formData.item_description?.some(
                    (_, i) => !productOffers[i] || productOffers[i].length === 0,
                  ) ||
                  Object.values(productOffers).flat().some(
                    (p: any) => !p.__priceValidity?.trim() || !p.__tdsBrand?.trim() ||
                      (p.countries?.length > 1 && !p.__selectedBranch?.trim())
                  )
                }
              >
                {isSubmitting ? "Submitting..." : "Submit"}
              </Button>
            )}
          </div>
        </div>
      </DialogFooter>
    </>
  );

  /* ════════════════════════════════════════════════════════════ */
  /* DIALOG WRAPPER                                              */
  /* ════════════════════════════════════════════════════════════ */
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={
            isMobile
              ? "w-full max-w-full h-dvh rounded-none p-0 flex flex-col overflow-hidden"
              : "sm:max-w-8xl rounded-none p-6 max-h-[90vh] overflow-hidden flex flex-col"
          }
        >
          {isMobile ? renderMobile() : renderDesktop()}
        </DialogContent>
      </Dialog>

      {/* Desktop MultipleSpecsDetected — outside Dialog to avoid stacking issues */}
      {!isMobile && (
        <MultipleSpecsDetected
          open={showPipeModal}
          onClose={handlePipeClose}
          product={pendingPipeProduct}
          onConfirm={isEditingSpecs ? handleSpecsRevisionConfirm : handlePipeConfirm}
        />
      )}

      {/* Add Product sub-dialog */}
      <Dialog open={openAddProduct && canAddProduct} onOpenChange={setOpenAddProduct}>
        <DialogContent
          className={
            isMobile
              ? "w-full max-w-full h-dvh rounded-none p-0 flex flex-col overflow-hidden"
              : "!max-w-none w-[95vw] max-h-[95vh] overflow-y-auto"
          }
          style={{ maxWidth: "95vw" }}
        >
          <DialogHeader
            className={isMobile ? "px-4 pt-4 pb-2 border-b shrink-0" : ""}
          >
            <DialogTitle>Add Product</DialogTitle>
          </DialogHeader>
          <div className={isMobile ? "flex-1 overflow-y-auto p-4" : ""}>
            <AddProductComponent onClose={() => setOpenAddProduct(false)} />
          </div>
          <DialogFooter
            className={isMobile ? "px-4 py-3 border-t shrink-0" : ""}
          >
            <Button
              variant="outline"
              className={isMobile ? "w-full rounded-none" : "rounded-none"}
              onClick={() => setOpenAddProduct(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔥 EDIT PRODUCT MODAL */}
<Dialog open={openEditProduct && canEditProduct} onOpenChange={setOpenEditProduct}>
  <DialogContent className="!max-w-none w-[95vw] max-h-[95vh] overflow-y-auto" style={{ maxWidth: "95vw" }}>
    <DialogHeader>
      <DialogTitle>Edit Product</DialogTitle>
    </DialogHeader>

    {selectedProduct && (
<EditProductComponent
  productId={selectedProduct?.id}
  onClose={() => setOpenEditProduct(false)}
/>
    )}

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => setOpenEditProduct(false)}
      >
        Close
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

      {/* 🔥 ROW SELECTION DIALOG */}
      <Dialog open={showRowSelectModal} onOpenChange={setShowRowSelectModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Row to Add Product</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Choose which item row to add the product to:
            </p>
            <div className="space-y-2 max-h-75 overflow-y-auto">
              {formData.item_description?.map((desc, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleRowSelectConfirm(index)}
                  className="w-full flex items-center gap-3 p-3 border rounded-lg hover:bg-accent hover:border-primary transition-colors text-left"
                >
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {formData.spf_number}-{String(index + 1).padStart(3, "0")}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {desc?.replace(/\|/g, " · ") || "No description"}
                    </p>
                  </div>
                  <Plus size={16} className="text-green-600 shrink-0" />
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleRowSelectCancel}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Image Preview Dialog ── */}
      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] rounded-none p-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <DialogTitle className="text-sm">Image Preview</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-6 bg-gray-50 min-h-75">
            {previewImageUrl ? (
              <img
                src={previewImageUrl}
                className="max-w-full max-h-[70vh] object-contain"
                alt="Preview"
              />
            ) : (
              <span className="text-muted-foreground">No image</span>
            )}
          </div>
          <DialogFooter className="px-4 py-3 border-t shrink-0">
            <Button variant="outline" onClick={() => setImagePreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Generate TDS Dialog ── */}
      <SPFGenerateTDSDialog
        open={tdsDialogOpen}
        onClose={() => {
          setTdsDialogOpen(false);
          setSelectedProductForTDS(null);
          setSelectedRowIndexForTDS(null);
          setSelectedOptionIndexForTDS(null);
        }}
        product={selectedProductForTDS}
        onTDSGenerated={(payload) => {
          if (selectedRowIndexForTDS === null || selectedOptionIndexForTDS === null) return;
          setProductOffers((prev) => {
            const copy = { ...prev };
            const row = [...(copy[selectedRowIndexForTDS] || [])];
            const product = row[selectedOptionIndexForTDS];
            if (!product) return prev;

            row[selectedOptionIndexForTDS] = {
              ...product,
              __tdsPdfUrl: payload.tdsUrl,
              __tdsBrand: payload.tdsBrand,
              __tdsProductName: payload.productName,
              dimensionalDrawing: payload.dimensionalDrawingUrl
                ? { url: payload.dimensionalDrawingUrl }
                : null,
              illuminanceDrawing: payload.illuminanceDrawingUrl
                ? { url: payload.illuminanceDrawingUrl }
                : null,
            };
            copy[selectedRowIndexForTDS] = row;
            return copy;
          });
        }}
      />
    </>
  );
}
