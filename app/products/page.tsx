"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { AccessGuard } from "@/components/AccessGuard";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AddProductDeleteProductItem from "@/components/add-product-delete-product-item";
import FilteringComponentV2 from "@/components/filtering-component-v2";
import UploadProductModal from "@/components/upload-product";
import DownloadProduct from "@/components/download-product";
import ViewProduct from "@/components/view-product";
import { Pencil, Trash2, Eye, SlidersHorizontal, X, Plus, Search, ChevronLeft, ChevronRight } from "lucide-react";

const convertDriveToThumbnail = (url: string) => {
  if (!url) return url;
  if (!url.includes("drive.google.com")) return url;
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1000`;
  }
  return url;
};

export default function ProductsPage() {
  const router = useRouter();
  const { userId } = useUser();
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isEngineer = theme === "engineer";

  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [viewTarget, setViewTarget] = useState<string | null>(null);

  const [cardScale, setCardScale] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("productCardScale");
      return saved ? parseFloat(saved) : 1;
    }
    return 1;
  });

  const gridRef = useRef<HTMLDivElement | null>(null);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [columns, setColumns] = useState(6);

  useEffect(() => {
    const saved = localStorage.getItem("productCardScale");
    if (saved) setCardScale(parseFloat(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("productCardScale", cardScale.toString());
  }, [cardScale]);

  useEffect(() => {
    const updateGridPagination = () => {
      if (!gridRef.current) return;

      const containerWidth = gridRef.current.offsetWidth;

      // 
      if (!containerWidth) return;

      const cardMinWidth = 220 * cardScale;
      const cols = Math.max(1, Math.floor(containerWidth / cardMinWidth));

      setColumns(cols);
      setItemsPerPage(cols * 4);
    };

  // 
  updateGridPagination();

  // 
  const timeout = setTimeout(updateGridPagination, 50);

  window.addEventListener("resize", updateGridPagination);

  return () => {
    window.removeEventListener("resize", updateGridPagination);
    clearTimeout(timeout);
  };
}, [cardScale]);

  useEffect(() => {
    const handleFocus = () => {
      if (!gridRef.current) return;

      const containerWidth = gridRef.current.offsetWidth;
      if (!containerWidth) return;

      const cardMinWidth = 220 * cardScale;
      const cols = Math.max(1, Math.floor(containerWidth / cardMinWidth));

      setColumns(cols);
      setItemsPerPage(cols * 4);
    };

    window.addEventListener("focus", handleFocus);

    return () => window.removeEventListener("focus", handleFocus);
  }, [cardScale]);

  useEffect(() => {
    if (!userId) { router.push("/login"); return; }
    const q = query(collection(db, "products"), where("isActive", "==", true));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(list);
      setFilteredProducts(list);
      setLoading(false);
    });
    return () => unsub();
  }, [userId, router]);

  const searchedProducts = useMemo(() => {
    if (!searchTerm.trim()) return filteredProducts;
    const lower = searchTerm.toLowerCase();
    return filteredProducts.filter((p) =>
      p.productName?.toLowerCase().includes(lower) ||
      p.supplier?.supplierBrand?.toLowerCase().includes(lower) ||
      p.categoryTypes?.[0]?.categoryTypeName?.toLowerCase().includes(lower) ||
      p.productTypes?.[0]?.productTypeName?.toLowerCase().includes(lower)
    );
  }, [searchTerm, filteredProducts]);

  const totalPages = Math.max(1, Math.ceil(searchedProducts.length / itemsPerPage));

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return searchedProducts.slice(start, start + itemsPerPage);
  }, [searchedProducts, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, filteredProducts]);

  const isFiltered = filteredProducts.length !== products.length;

  return (
    <AccessGuard accessKey="page:products">
      <div className="h-dvh flex flex-col overflow-hidden">

      {/* ── DESKTOP HEADER ── */}
      <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
        <SidebarTrigger />
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Products</h1>
          <div className="flex gap-2">
            <UploadProductModal />
            <DownloadProduct products={products} />
            <Button onClick={() => router.push("/add-product")}>+ Add Product</Button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search product..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md bg-white/70"
          />
          <div className="flex items-center gap-2 ml-auto text-sm text-gray-500">
            <button onClick={() => setCardScale(p => Math.max(p - 0.1, 0.6))} className="text-lg font-bold px-1">−</button>
            <span className="w-10 text-center text-xs">{(cardScale * 100).toFixed(0)}%</span>
            <button onClick={() => setCardScale(p => Math.min(p + 0.1, 1.6))} className="text-lg font-bold px-1">+</button>
          </div>
        </div>
      </div>

      {/* ── MOBILE HEADER ── */}
      <div className="md:hidden shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Products</h1>
          <div className="flex items-center gap-2">
            <UploadProductModal iconOnly />
            <DownloadProduct products={products} iconOnly />
            <button
              onClick={() => router.push("/add-product")}
              className="h-8 w-8 rounded-full bg-gray-900 text-white flex items-center justify-center"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-white/70 border-gray-200 rounded-xl text-sm"
            />
          </div>
          <button
            onClick={() => setMobileFilterOpen(true)}
            className="relative h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {isFiltered && (
              <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-white" />
            )}
          </button>
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{searchedProducts.length} products</span>
          <div className="flex items-center gap-2 bg-white/60 rounded-lg px-2.5 py-1">
            <button onClick={() => setCardScale(p => Math.max(p - 0.1, 0.6))} className="text-gray-600 font-bold text-sm">−</button>
            <span className="text-xs text-gray-500 w-7 text-center">{(cardScale * 100).toFixed(0)}%</span>
            <button onClick={() => setCardScale(p => Math.min(p + 0.1, 1.6))} className="text-gray-600 font-bold text-sm">+</button>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      {/*
        On mobile: relative container so the drawer can be positioned absolute within it.
        The products grid stays fully rendered and visible behind the drawer.
      */}
      <div className={`flex flex-1 min-h-0 w-full overflow-hidden relative ${
        isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
      }`}>

        {/* ── PRODUCT GRID AREA ── */}
        <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="h-7 w-7 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
            </div>
          ) : (
            <>
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-3 py-3 border-t bg-white/70 backdrop-blur-sm shrink-0 px-4">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="h-8 w-8 rounded-lg border flex items-center justify-center disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm font-medium text-gray-600">{currentPage} / {totalPages}</span>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="h-8 w-8 rounded-lg border flex items-center justify-center disabled:opacity-40"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-3 md:px-6 pt-3 pb-24 md:pb-4">
                {paginatedProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-14 w-14 rounded-full bg-white/60 flex items-center justify-center mb-3">
                      <Search className="h-6 w-6 text-gray-300" />
                    </div>
                    <p className="text-sm font-medium text-gray-600">No products found</p>
                    <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  <div
                    ref={gridRef}
                    className="grid gap-3 md:gap-4 w-full"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
                  >
                    {paginatedProducts.map((p) => (
                      <div
                        key={p.id}
                        className="group border border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md flex flex-col overflow-hidden transition-shadow duration-200"
                      >
                        <div className="relative bg-white/60 flex items-center justify-center overflow-hidden rounded-t-2xl" style={{ height: 160 }}>
                          {p.mainImage?.url ? (
                            <img
                              src={convertDriveToThumbnail(p.mainImage.url)}
                              className="w-full h-full object-contain p-2 md:group-hover:brightness-75 transition-all duration-200"
                            />
                          ) : (
                            <span className="text-xs text-gray-400">No Image</span>
                          )}

                          {/* Desktop hover actions */}
                          <div className="absolute top-2 right-2 flex-col gap-1.5 hidden md:flex opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            {[
                              { icon: <Eye className="w-3.5 h-3.5 text-gray-700" />, label: "View", action: () => setViewTarget(p.id) },
                              { icon: <Pencil className="w-3.5 h-3.5 text-blue-600" />, label: "Edit", action: () => router.push(`/edit-product?id=${p.id}`) },
                              { icon: <Trash2 className="w-3.5 h-3.5 text-red-500" />, label: "Delete", action: () => setDeleteTarget({ id: p.id, name: p.productName }) },
                            ].map(({ icon, label, action }) => (
                              <div key={label} className="relative group/btn flex items-center justify-end">
                                <span className="mr-2 text-[10px] font-medium text-white bg-black/70 rounded px-1.5 py-0.5 opacity-0 group-hover/btn:opacity-100 transition-opacity pointer-events-none">
                                  {label}
                                </span>
                                <button
                                  className="w-7 h-7 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center"
                                  onClick={(e) => { e.stopPropagation(); action(); }}
                                >
                                  {icon}
                                </button>
                              </div>
                            ))}
                          </div>

                          {/* Mobile always-visible actions */}
                          <div className="absolute bottom-2 right-2 flex gap-1.5 md:hidden">
                            <button className="w-7 h-7 rounded-full bg-white/95 shadow flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setViewTarget(p.id); }}>
                              <Eye className="w-3.5 h-3.5 text-gray-700" />
                            </button>
                            <button className="w-7 h-7 rounded-full bg-white/95 shadow flex items-center justify-center" onClick={(e) => { e.stopPropagation(); router.push(`/edit-product?id=${p.id}`); }}>
                              <Pencil className="w-3.5 h-3.5 text-blue-600" />
                            </button>
                            <button className="w-7 h-7 rounded-full bg-white/95 shadow flex items-center justify-center" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: p.id, name: p.productName }); }}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </div>
                        </div>

                        <div className="p-3">
                          <h2 className="text-sm font-semibold line-clamp-2 text-gray-900 leading-snug">{p.productName}</h2>
                          <p className="text-xs font-medium text-blue-600 mt-0.5 line-clamp-1">{p.supplier?.supplierBrand || "—"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── DESKTOP FILTER SIDEBAR ── */}
        <div className="hidden md:block w-[320px] shrink-0 border-l bg-white/80 backdrop-blur-sm overflow-y-auto p-4">
          {!loading && products.length > 0 && (
            <FilteringComponentV2 products={products} onFilter={setFilteredProducts} />
          )}
        </div>

        {/* ── MOBILE FILTER — RIGHT SIDE DRAWER ── */}
        {/*
          Dim overlay: covers full content area, tap to close.
          Positioned absolute so products grid remains visible behind the drawer.
        */}
        <div
          className={`
            md:hidden absolute inset-0 z-30
            bg-black/30 backdrop-blur-[1px]
            transition-opacity duration-300
            ${mobileFilterOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}
          `}
          onClick={() => setMobileFilterOpen(false)}
        />

        {/*
          Drawer: slides in from the right.
          w-[82%] → ~18% of products grid still visible on the left.
          Products are still rendered and visible — user can see filtered results updating live.
        */}
        <div
          className={`
            md:hidden absolute top-0 right-0 bottom-0 z-40
            w-[82%] flex flex-col
            bg-white shadow-2xl
            transition-transform duration-300 ease-in-out
            ${mobileFilterOpen ? "translate-x-0" : "translate-x-full"}
          `}
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-gray-600" />
              <h2 className="font-bold text-sm">Filters</h2>
              {isFiltered && (
                <span className="text-[10px] font-semibold bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                  ON
                </span>
              )}
            </div>
            <button
              onClick={() => setMobileFilterOpen(false)}
              className="h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Scrollable filter body */}
          <div className="flex-1 overflow-y-auto">
            {!loading && products.length > 0 && (
              <FilteringComponentV2 products={products} onFilter={setFilteredProducts} />
            )}
          </div>

          {/* Footer: results count + close */}
          <div
            className="px-3 py-3 border-t bg-white shrink-0"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
          >
            <button
              onClick={() => setMobileFilterOpen(false)}
              className="w-full h-10 rounded-xl bg-gray-900 text-white text-sm font-semibold"
            >
              Show {filteredProducts.length} Product{filteredProducts.length !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      </div>

      {/* DELETE MODAL */}
      {deleteTarget && (
        <AddProductDeleteProductItem
          key={`delete-${deleteTarget.id}`}
          productId={deleteTarget.id}
          productName={deleteTarget.name}
          referenceID={userId ?? ""}
          defaultOpen={true}
          onDeleted={(id) => { setProducts(prev => prev.filter(p => p.id !== id)); setDeleteTarget(null); }}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* VIEW MODAL */}
      {viewTarget && (
        <ViewProduct
          key={`view-${viewTarget}`}
          productId={viewTarget}
          referenceID={userId ?? ""}
          defaultOpen={true}
          onClose={() => setViewTarget(null)}
        />
      )}
    </div>
  </AccessGuard>
);
}