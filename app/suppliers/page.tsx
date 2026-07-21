"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AccessGuard } from "@/components/AccessGuard";

import AddSupplier from "@/components/add-supplier";
import UploadSupplier from "@/components/upload-supplier";
import EditSupplier from "@/components/edit-supplier";
import DeleteSupplier from "@/components/delete-supplier";
import FilterSupplier, { SupplierFilterValues } from "@/components/filter-supplier";
import DownloadSupplier from "@/components/download-supplier";
import SupplierProducts from "@/components/company-x-supplier-brand-products";

import { Pencil, Trash2, Filter, Upload, Search, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { getCountryCallingCode, CountryCode } from "libphonenumber-js";
import { db } from "@/lib/firebase";
import { useNotificationTriggers } from "@/hooks/use-notification-triggers";

type Supplier = {
  id: string;
  company: string;
  supplierBrand?: string;
  addresses?: string[];
  emails?: string[];
  website?: string[];
  contacts?: { name: string; phone: string }[];
  forteProducts?: string[];
  products?: string[];
  certificates?: string[];
  createdBy?: string | null;
  referenceID?: string | null;
  isActive?: boolean;
  createdAt?: any;
  updatedAt?: any;
  // New fields for branch structure
  hasMultipleBranches?: boolean;
  address?: string;
  country?: string;
  countries?: string[];
  branches?: {
    address: string;
    country: string;
    contacts: { name: string; phone: string; type: string }[];
    emails: string[];
  }[];
};

const COL_WIDTHS = [
  "w-[100px]", "w-40", "w-[120px]", "w-[220px]",
  "w-[180px]", "w-40", "w-40", "w-[140px]", "w-[140px]", "w-[120px]",
];

const HEADERS = [
  { label: "Actions",          align: "text-left"   },
  { label: "Company Name",     align: "text-left"   },
  { label: "Supplier Brand",   align: "text-center" },
  { label: "Addresses",        align: "text-center" },
  { label: "Emails",           align: "text-center" },
  { label: "Website",          align: "text-center" },
  { label: "Contact",          align: "text-center" },
  { label: "Forte Product(s)", align: "text-center" },
  { label: "Product(s)",       align: "text-center" },
  { label: "Certificate(s)",   align: "text-center" },
];

const highlightText = (text: string, keyword: string) => {
  if (!text) return text;

  const upperText = text.toUpperCase();
  const upperKeyword = keyword.toUpperCase();

  if (!keyword) return upperText;

  const regex = new RegExp(`(${upperKeyword})`, "gi");

  return upperText.split(regex).map((part, i) =>
    part === upperKeyword ? (
      <mark key={i} className="bg-yellow-200 text-black px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const formatWebsite = (url?: string) => {
  if (!url) return undefined;
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
};

export default function Suppliers() {
  const router = useRouter();
  const { userId } = useUser();
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isEngineer = theme === "engineer";
  const { onSupplierAdded, onSupplierUpdated } = useNotificationTriggers();

  const [loading, setLoading] = useState(true);
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [uploadSupplierOpen, setUploadSupplierOpen] = useState(false);
  const [editSupplierOpen, setEditSupplierOpen] = useState(false);
  const [deleteSupplierOpen, setDeleteSupplierOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<SupplierFilterValues>({
    company: "", internalCode: "", email: "",
    hasContacts: null, sortAlpha: "", phoneCountry: "", addressCountry: "",
  });
  const [supplierProductsOpen, setSupplierProductsOpen] = useState(false);
  const [supplierProductsTarget, setSupplierProductsTarget] = useState<{
    supplierId: string; company: string; supplierBrand: string;
  } | null>(null);
  const suppliersRef = useRef<Supplier[]>([]);
  const initialLoadDoneRef = useRef(false);

  const DESKTOP_ITEMS_PER_PAGE = 10;
  const MOBILE_ITEMS_PER_PAGE = 5;
  const [itemsPerPage, setItemsPerPage] = useState(DESKTOP_ITEMS_PER_PAGE);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (userId === null) return;
    if (!userId) { router.push("/login"); return; }
  }, [userId, router]);

  useEffect(() => {
    if (!userId) return;
    const q = query(collection(db, "suppliers"), where("isActive", "==", true));
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id, ...data,
          website: Array.isArray(data.website) ? data.website : data.website ? [data.website] : [],
        };
      }) as Supplier[];
      
      // Only trigger notifications after initial load
      if (initialLoadDoneRef.current) {
        // Detect changes for notifications
        const previousSuppliers = suppliersRef.current;
        const previousIds = new Set(previousSuppliers.map(s => s.id));
        const newIds = new Set(list.map(s => s.id));
        
        // Detect new suppliers
        const addedSuppliers = list.filter(s => !previousIds.has(s.id));
        // Detect updated suppliers (existing but changed)
        const updatedSuppliers = list.filter(s => {
          if (!previousIds.has(s.id)) return false;
          const previous = previousSuppliers.find(prev => prev.id === s.id);
          if (!previous) return false;
          return JSON.stringify(previous) !== JSON.stringify(s);
        });
        
        // Trigger notifications
        if (addedSuppliers.length > 0) {
          addedSuppliers.forEach(supplier => {
            if (userId) {
              onSupplierAdded({
                userId,
                supplierName: supplier.company,
                supplierId: supplier.id,
                url: "/suppliers",
              });
            }
          });
        }
        
        if (updatedSuppliers.length > 0) {
          updatedSuppliers.forEach(supplier => {
            if (userId) {
              onSupplierUpdated({
                userId,
                supplierName: supplier.company,
                supplierId: supplier.id,
                url: "/suppliers",
              });
            }
          });
        }
      }
      
      setSuppliers(list);
      suppliersRef.current = list;
      initialLoadDoneRef.current = true;
      setLoading(false);
    });
    return () => unsub();
  }, [userId, onSupplierAdded, onSupplierUpdated]);

  useEffect(() => { setCurrentPage(1); }, [search, filters]);

  useEffect(() => {
    const handleResize = () => {
      setItemsPerPage(window.innerWidth < 768 ? MOBILE_ITEMS_PER_PAGE : DESKTOP_ITEMS_PER_PAGE);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const openSupplierProducts = (s: Supplier) => {
    setSupplierProductsTarget({ supplierId: s.id, company: s.company, supplierBrand: s.supplierBrand || "" });
    setSupplierProductsOpen(true);
  };

  const filteredSuppliers = useMemo(() => {
    return suppliers
      .filter((s) => {
        const keyword = search.toLowerCase();
        const searchMatch =
          s.company?.toLowerCase().includes(keyword) ||
          s.supplierBrand?.toLowerCase().includes(keyword) ||
          s.addresses?.some((v) => v.toLowerCase().includes(keyword)) ||
          s.emails?.some((v) => v.toLowerCase().includes(keyword)) ||
          s.website?.some((v) => v.toLowerCase().includes(keyword)) ||
          s.contacts?.some((c) => c.name?.toLowerCase().includes(keyword) || c.phone?.toLowerCase().includes(keyword)) ||
          s.forteProducts?.some((v) => v.toLowerCase().includes(keyword)) ||
          s.products?.some((v) => v.toLowerCase().includes(keyword)) ||
          s.certificates?.some((v) => v.toLowerCase().includes(keyword));

        const filterMatch =
          (!filters.company || s.company.toLowerCase().includes(filters.company.toLowerCase())) &&
          (!filters.email || s.emails?.some((e) => e.toLowerCase().includes(filters.email.toLowerCase()))) &&
          (filters.hasContacts === null || (filters.hasContacts ? s.contacts && s.contacts.length > 0 : !s.contacts || s.contacts.length === 0)) &&
          (!filters.phoneCountry || s.contacts?.some((c) => {
            // phoneCountry is now a calling code like +63, +81, +86
            return c.phone?.startsWith(filters.phoneCountry);
          }) ||
            s.branches?.some((branch) =>
              branch.contacts?.some((c) => c.phone?.startsWith(filters.phoneCountry))
            )) &&
          (!filters.addressCountry || 
            // Check if the supplier's countries array includes the selected country code
            s.countries?.includes(filters.addressCountry) ||
            // Fallback: check branches for country field
            s.branches?.some((branch) => branch.country === filters.addressCountry) ||
            // Fallback: check single country field
            s.country === filters.addressCountry
          );

        return searchMatch && filterMatch;
      })
      .sort((a, b) => {
        if (!filters.sortAlpha) return 0;
        return filters.sortAlpha === "asc" ? a.company.localeCompare(b.company) : b.company.localeCompare(a.company);
      });
  }, [suppliers, search, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / itemsPerPage));

  const paginatedSuppliers = useMemo(() => {
    return filteredSuppliers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredSuppliers, currentPage, itemsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(1);
  }, [itemsPerPage, totalPages]);

  return (
    <AccessGuard accessKey="page:suppliers">
      {/* ↓ removed bg-gray-50 — transparent so wallpaper shows through */}
      <div className="h-dvh flex flex-col overflow-hidden">

      {/* ── DESKTOP HEADER — bg-white → bg-white/80 + backdrop-blur-md ── */}
      <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
        <SidebarTrigger />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold shrink-0">Suppliers</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              placeholder="Search supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-64 rounded-md border px-3 text-sm bg-white/70"
            />
            <Button onClick={() => setAddSupplierOpen(true)}>+ Add Supplier</Button>
            <Button variant="outline" className="gap-1" onClick={() => setUploadSupplierOpen(true)}>
              <Upload className="h-4 w-4" /> Upload
            </Button>
            <Button variant="outline" onClick={() => setFilterOpen(true)} className="gap-1">
              <Filter className="h-4 w-4" /> Filter
            </Button>
            <DownloadSupplier suppliers={filteredSuppliers} />
          </div>
        </div>
      </div>

      {/* ── MOBILE HEADER — bg-white → bg-white/80 + backdrop-blur-md ── */}
      <div className="md:hidden shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">Suppliers</h1>
<div className="flex items-center gap-2">
  <button
    onClick={() => setUploadSupplierOpen(true)}
    className="h-8 w-8 rounded-full border border-gray-200 bg-white/80 flex items-center justify-center"
  >
    <Upload className="h-4 w-4 text-gray-600" />
  </button>
  <DownloadSupplier suppliers={filteredSuppliers} iconOnly />
  <button
    onClick={() => setAddSupplierOpen(true)}
    className="h-8 w-8 rounded-full bg-gray-900 text-white flex items-center justify-center"
  >
    <Plus className="h-4 w-4" />
  </button>
</div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-white/70 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-300"
            />
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            className="h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center shrink-0"
          >
            <Filter className="h-4 w-4" />
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-2">{filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? "s" : ""}</p>
      </div>

      {/* ── DESKTOP PAGINATION BAR — bg-white → bg-white/70 ── */}
      <div className="hidden md:flex items-center justify-between px-6 py-2 bg-white/70 backdrop-blur-md border-b shrink-0">
        <span className="text-sm text-gray-500">
          Page {currentPage} of {totalPages} · {filteredSuppliers.length} suppliers
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
          <Button size="sm" variant="outline" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
        </div>
      </div>

      {/* ── DESKTOP TABLE — bg-white → bg-white/60 ── */}
      <div className={`hidden md:block flex-1 min-h-0 overflow-auto bg-white/60 backdrop-blur-sm ${
        isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
      }`}>
        <table className="w-full text-sm border-collapse">
          {/* thead bg-red-50 → bg-red-50/80 */}
          <thead className="bg-red-50/80 backdrop-blur-sm sticky top-0 z-10">
            <tr>
              {HEADERS.map((h, i) => (
                <th key={h.label} className={`${COL_WIDTHS[i]} ${h.align} font-bold px-3 py-3 border-b whitespace-nowrap`}>
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">Loading suppliers...</td></tr>
            ) : filteredSuppliers.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">No suppliers found.</td></tr>
            ) : (
              paginatedSuppliers.map((s) => (
                <tr key={s.id} className="border-b hover:bg-white/60 align-middle">
                  <td className={`${COL_WIDTHS[0]} px-3 py-3`}>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setSelectedSupplier(s); setEditSupplierOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="destructive" size="sm" onClick={() => { setSelectedSupplier(s); setDeleteSupplierOpen(true); }}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </td>
                  <td className={`${COL_WIDTHS[1]} px-3 py-3`}>
                    <button onClick={() => openSupplierProducts(s)} className="font-semibold text-blue-600 hover:underline text-left">
                      {highlightText(s.company, search)}
                    </button>
                  </td>
                  <td className={`${COL_WIDTHS[2]} px-3 py-3 text-center`}>
                    {s.supplierBrand ? (
                      <button onClick={() => openSupplierProducts(s)} className="font-semibold text-blue-600 hover:underline">
                        {highlightText(s.supplierBrand, search)}
                      </button>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className={`${COL_WIDTHS[3]} px-3 py-3 text-center`}>
                    {s.hasMultipleBranches && s.branches?.length ? (
                      <div className="flex flex-col gap-2">
                        {s.branches.map((b, idx) => (
                          <div key={idx}>
                            <span className="text-xs font-semibold text-blue-600">Branch {idx + 1}:</span>
                            <div>{highlightText(b.address ? `${b.address} (${b.country})` : `(${b.country})`, search)}</div>
                          </div>
                        ))}
                      </div>
                    ) : s.addresses?.length ? (
                      <div className="flex flex-col gap-2">{s.addresses.map((v, i) => <div key={i}>{highlightText(v, search)}</div>)}</div>
                    ) : s.country ? (
                      <span className="text-muted-foreground">({s.country})</span>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className={`${COL_WIDTHS[4]} px-3 py-3 text-center`}>
                    {s.hasMultipleBranches && s.branches?.length ? (
                      <div className="flex flex-col gap-2">
                        {s.branches.map((b, idx) => (
                          <div key={idx}>
                            <span className="text-xs font-semibold text-blue-600">Branch {idx + 1}:</span>
                            <div className="flex flex-col gap-1">
                              {b.emails?.map((email, emailIdx) => (
                                <div key={emailIdx} className="break-all text-xs">{highlightText(email, search)}</div>
                              )) || <span className="text-muted-foreground">-</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : s.emails?.length ? (
                      <div className="flex flex-col gap-2">{s.emails.map((v, i) => <div key={i} className="break-all">{highlightText(v, search)}</div>)}</div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className={`${COL_WIDTHS[5]} px-3 py-3 text-center`}>
                    {s.website?.length ? (
                      <div className="flex flex-col gap-2">
                        {s.website.map((site, i) => (
                          <a key={i} href={formatWebsite(site)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
                            {highlightText(site, search)}
                          </a>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className={`${COL_WIDTHS[6]} px-3 py-3 text-center`}>
                    {s.hasMultipleBranches && s.branches?.length ? (
                      <div className="flex flex-col gap-2">
                        {s.branches.map((b, idx) => (
                          <div key={idx}>
                            <span className="text-xs font-semibold text-blue-600">Branch {idx + 1}:</span>
                            <div className="flex flex-col gap-1">
                              {b.contacts?.length ? (
                                b.contacts.map((c, contactIdx) => (
                                  <div key={contactIdx}>
                                    <div className="font-medium text-xs">{highlightText(c.name, search)}</div>
                                    <div className="text-xs text-muted-foreground">{highlightText(c.phone, search)}</div>
                                  </div>
                                ))
                              ) : <span className="text-muted-foreground">-</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : s.contacts?.length ? (
                      <div className="flex flex-col gap-2">
                        {s.contacts.map((c, i) => (
                          <div key={i}>
                            <div className="font-medium">{highlightText(c.name, search)}</div>
                            <div className="text-xs text-muted-foreground">{highlightText(c.phone, search)}</div>
                          </div>
                        ))}
                      </div>
                    ) : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className={`${COL_WIDTHS[7]} px-3 py-3 text-center`}>
                    {s.forteProducts?.length ? <div className="flex flex-col gap-2">{s.forteProducts.map((v, i) => <div key={i}>{highlightText(v, search)}</div>)}</div> : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className={`${COL_WIDTHS[8]} px-3 py-3 text-center`}>
                    {s.products?.length ? <div className="flex flex-col gap-2">{s.products.map((v, i) => <div key={i}>{highlightText(v, search)}</div>)}</div> : <span className="text-muted-foreground">-</span>}
                  </td>
                  <td className={`${COL_WIDTHS[9]} px-3 py-3 text-center`}>
                    {s.certificates?.length ? <div className="flex flex-col gap-2">{s.certificates.map((v, i) => <div key={i}>{highlightText(v, search)}</div>)}</div> : <span className="text-muted-foreground">-</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE CARD LIST ── */}
      <div className="md:hidden flex-1 overflow-y-auto px-3 pt-3 pb-28 space-y-3 min-h-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-full bg-white/60 flex items-center justify-center mb-3">
              <Search className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-600">No suppliers found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          paginatedSuppliers.map((s) => (
            // bg-white → bg-white/80 + backdrop-blur-sm
            <div key={s.id} className="border border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <button onClick={() => openSupplierProducts(s)} className="text-base font-bold text-blue-600 hover:underline text-left leading-tight">
                    {highlightText(s.company, search)}
                  </button>
                  {s.supplierBrand && (
                    <button onClick={() => openSupplierProducts(s)} className="block text-xs font-semibold text-blue-500 hover:underline mt-0.5">
                      {highlightText(s.supplierBrand, search)}
                    </button>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => { setSelectedSupplier(s); setEditSupplierOpen(true); }} className="h-8 w-8 rounded-xl border border-gray-200 bg-white/80 flex items-center justify-center">
                    <Pencil className="h-3.5 w-3.5 text-blue-600" />
                  </button>
                  <button onClick={() => { setSelectedSupplier(s); setDeleteSupplierOpen(true); }} className="h-8 w-8 rounded-xl border border-red-100 bg-red-50/80 flex items-center justify-center">
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {/* Address - with branch labels */}
                {s.hasMultipleBranches && s.branches?.length ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Address</span>
                    <div className="flex flex-col gap-2 flex-1">
                      {s.branches.map((b, idx) => (
                        <div key={idx}>
                          <span className="text-xs font-semibold text-blue-600">Branch {idx + 1}:</span>
                          <span className="text-gray-700 text-xs ml-1">{highlightText(b.address ? `${b.address} (${b.country})` : `(${b.country})`, search)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : s.addresses?.length ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Address</span>
                    <div className="flex flex-col gap-1 flex-1">
                      {s.addresses.map((item, i) => <span key={i} className="text-gray-700 text-xs">{highlightText(item, search)}</span>)}
                    </div>
                  </div>
                ) : s.country ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Address</span>
                    <span className="text-gray-700 text-xs">({s.country})</span>
                  </div>
                ) : null}
                {/* Email - with branch labels */}
                {s.hasMultipleBranches && s.branches?.length ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Email</span>
                    <div className="flex flex-col gap-2 flex-1">
                      {s.branches.map((b, idx) => (
                        <div key={idx}>
                          <span className="text-xs font-semibold text-blue-600">Branch {idx + 1}:</span>
                          <div className="flex flex-col gap-1 ml-1">
                            {b.emails?.length ? (
                              b.emails.map((email, emailIdx) => (
                                <span key={emailIdx} className="text-gray-700 text-xs break-all">{highlightText(email, search)}</span>
                              ))
                            ) : <span className="text-muted-foreground text-xs">-</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : s.emails?.length ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Email</span>
                    <div className="flex flex-col gap-1 flex-1">
                      {s.emails.map((item, i) => <span key={i} className="text-gray-700 text-xs break-all">{highlightText(item, search)}</span>)}
                    </div>
                  </div>
                ) : null}
                {/* Contact - with branch labels */}
                {s.hasMultipleBranches && s.branches?.length ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Contact</span>
                    <div className="flex flex-col gap-2 flex-1">
                      {s.branches.map((b, idx) => (
                        <div key={idx}>
                          <span className="text-xs font-semibold text-blue-600">Branch {idx + 1}:</span>
                          <div className="flex flex-col gap-1 ml-1">
                            {b.contacts?.length ? (
                              b.contacts.map((c, contactIdx) => (
                                <span key={contactIdx} className="text-gray-700 text-xs">{highlightText(c.name, search)} · {highlightText(c.phone, search)}</span>
                              ))
                            ) : <span className="text-muted-foreground text-xs">-</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : s.contacts?.length ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Contact</span>
                    <div className="flex flex-col gap-1 flex-1">
                      {s.contacts.map((c, i) => (
                        <span key={i} className="text-gray-700 text-xs">{highlightText(c.name, search)} · {highlightText(c.phone, search)}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {/* Other fields */}
                {[
                  { label: "Forte Products", items: s.forteProducts },
                  { label: "Products",       items: s.products      },
                  { label: "Certificates",   items: s.certificates  },
                ].map(({ label, items }) =>
                  items?.length ? (
                    <div key={label} className="flex gap-2">
                      <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">{label}</span>
                      <div className="flex flex-col gap-1 flex-1">
                        {items.map((item, i) => <span key={i} className="text-gray-700 text-xs">{highlightText(item, search)}</span>)}
                      </div>
                    </div>
                  ) : null
                )}
                {s.website?.length ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Website</span>
                    <div className="flex flex-col gap-1 flex-1">
                      {s.website.map((site, i) => (
                        <a key={i} href={formatWebsite(site)} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs break-all">
                          {highlightText(site, search)}
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
                {s.contacts?.length ? (
                  <div className="flex gap-2">
                    <span className="text-xs font-semibold text-gray-500 w-24 shrink-0 pt-0.5">Contact</span>
                    <div className="flex flex-col gap-1 flex-1">
                      {s.contacts.map((c, i) => (
                        <span key={i} className="text-gray-700 text-xs">{highlightText(c.name, search)} · {highlightText(c.phone, search)}</span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── MOBILE PAGINATION — bg-white → bg-white/70 ── */}
      {totalPages > 1 && (
        <div className="md:hidden flex justify-center items-center gap-3 py-3 border-t bg-white/70 backdrop-blur-sm shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}>
          <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="h-8 w-8 rounded-lg border flex items-center justify-center disabled:opacity-40">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium text-gray-600">{currentPage} / {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="h-8 w-8 rounded-lg border flex items-center justify-center disabled:opacity-40">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* MODALS */}
      <AddSupplier open={addSupplierOpen} onOpenChange={setAddSupplierOpen} />
      <UploadSupplier open={uploadSupplierOpen} onOpenChange={setUploadSupplierOpen} />
      <FilterSupplier open={filterOpen} onOpenChange={setFilterOpen} onApply={setFilters} suppliers={suppliers} />
      {selectedSupplier && <EditSupplier open={editSupplierOpen} onOpenChange={setEditSupplierOpen} supplier={selectedSupplier} />}
      {selectedSupplier && <DeleteSupplier open={deleteSupplierOpen} onOpenChange={setDeleteSupplierOpen} supplier={selectedSupplier} />}
      {supplierProductsTarget && (
        <SupplierProducts
          open={supplierProductsOpen}
          onOpenChange={setSupplierProductsOpen}
          supplierId={supplierProductsTarget.supplierId}
          company={supplierProductsTarget.company}
          supplierBrand={supplierProductsTarget.supplierBrand}
        />
      )}
    </div>
  </AccessGuard>
  );
}
