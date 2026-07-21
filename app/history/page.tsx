"use client";



import React, { useEffect, useState, useCallback } from "react";

import { useRouter } from "next/navigation";

import { useUser } from "@/contexts/UserContext";

import { SidebarTrigger } from "@/components/ui/sidebar";

import { Input } from "@/components/ui/input";

import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import { Separator } from "@/components/ui/separator";

import {

  Select,

  SelectContent,

  SelectItem,

  SelectTrigger,

  SelectValue,

} from "@/components/ui/select";

import {

  Tabs,

  TabsContent,

  TabsList,

  TabsTrigger,

} from "@/components/ui/tabs";

import {

  Sheet,

  SheetContent,

  SheetHeader,

  SheetTitle,

  SheetDescription,

} from "@/components/ui/sheet";

import {

  Tooltip,

  TooltipContent,

  TooltipProvider,

  TooltipTrigger,

} from "@/components/ui/tooltip";

import {

  Search, RefreshCw, Eye, Building2, Package,

  ChevronLeft, ChevronRight, Layers, Tag, Filter,

} from "lucide-react";

import { db } from "@/lib/firebase";

import {

  collection,

  query,

  orderBy,

  limit,

  getDocs,

  startAfter,

  QueryDocumentSnapshot,

  DocumentData,

  where,

  Timestamp,

} from "firebase/firestore";

import { cn } from "@/lib/utils";

import { AccessGuard } from "@/components/AccessGuard";



/* ─────────────────────────────────────────────

   Types

───────────────────────────────────────────── */

type UserData = { Firstname: string; Lastname: string; Role: string };



type AuditLog = {

  id: string;

  whatHappened: string;

  performedBy?: string;

  performedByName?: string;

  referenceID?: string;

  supplierId?: string;

  supplierbrandId?: string;

  company?: string;

  supplierBrand?: string;

  productId?: string;

  productReferenceID?: string;

  productClass?: string;

  pricePoint?: string;

  supplier?: { company?: string; supplierBrand?: string };

  productFamilyId?: string;

  productFamilyName?: string;

  productUsageId?: string;

  productUsageName?: string;

  mainImage?: { url?: string } | null;

  dimensionalDrawing?: { url?: string } | null;

  illuminanceDrawing?: { url?: string } | null;

  technicalSpecifications?: { title: string; specs: { specId: string; value: string }[] }[];

  inserted?: number;

  reactivated?: number;

  skipped?: number;

  overwritten?: number;

  date_updated?: Timestamp;

  createdAt?: Timestamp;

  updatedAt?: Timestamp;

  _raw?: Record<string, any>;

};



type CollectionTab = "suppliers" | "products" | "productFamilies" | "productUsages" | "spfVersions"; 



const PAGE_SIZE = 20;



const COL_MAP: Record<CollectionTab, string> = {

  suppliers      : "auditLogs_suppliers",

  products       : "auditLogs_products",

  productFamilies: "auditLogs_productFamilies",

  productUsages  : "auditLogs_productUsages",



  // ADD THIS

  spfVersions    : "auditLogs_spfVersions",

};



const ACTION_COLORS: Record<string, string> = {

  "Supplier Added"         : "bg-emerald-100 text-emerald-700 border-emerald-200",

  "Supplier Edited"        : "bg-blue-100 text-blue-700 border-blue-200",

  "Supplier Deleted"       : "bg-red-100 text-red-700 border-red-200",

  "Supplier Reactivated"   : "bg-amber-100 text-amber-700 border-amber-200",

  "Supplier Bulk Upload"   : "bg-orange-100 text-orange-700 border-orange-200",

  "Product Added"          : "bg-violet-100 text-violet-700 border-violet-200",

  "Product Edited"         : "bg-sky-100 text-sky-700 border-sky-200",

  "Product Deleted"        : "bg-rose-100 text-rose-700 border-rose-200",

  "Product Bulk Upload"    : "bg-purple-100 text-purple-700 border-purple-200",

  "Product Family Added"   : "bg-teal-100 text-teal-700 border-teal-200",

  "Product Family Edited"  : "bg-cyan-100 text-cyan-700 border-cyan-200",

  "Product Family Deleted" : "bg-pink-100 text-pink-700 border-pink-200",

  "Product Usage Added"    : "bg-lime-100 text-lime-700 border-lime-200",

  "Product Usage Edited"   : "bg-yellow-100 text-yellow-700 border-yellow-200",

  "Product Usage Deleted"  : "bg-red-100 text-red-700 border-red-200",

};



const ACTION_OPTIONS: Record<CollectionTab, string[]> = {

  suppliers      : ["Supplier Added", "Supplier Edited", "Supplier Deleted", "Supplier Reactivated", "Supplier Bulk Upload"],

  products       : ["Product Added", "Product Edited", "Product Deleted", "Product Bulk Upload"],

  productFamilies: ["Product Family Added", "Product Family Edited", "Product Family Deleted"],

  productUsages  : ["Product Usage Added", "Product Usage Edited", "Product Usage Deleted"],



  // ADD THIS

  spfVersions: ["SPF Created", "SPF Version Created", "SPF Updated"],

};



/* ─────────────────────────────────────────────

   Helpers

───────────────────────────────────────────── */

const formatTimestamp = (ts?: Timestamp): string => {

  if (!ts) return "—";

  try {

    return ts.toDate().toLocaleString("en-PH", {

      year: "numeric", month: "short", day: "2-digit",

      hour: "2-digit", minute: "2-digit", second: "2-digit",

    });

  } catch { return "—"; }

};



const getDisplayTime = (log: AuditLog): Timestamp | undefined =>

  log.date_updated ?? log.updatedAt ?? log.createdAt;



/* ─────────────────────────────────────────────

   Name cache

───────────────────────────────────────────── */

const nameCache = new Map<string, string>();



async function resolveNames(referenceIDs: string[]): Promise<void> {

  const unresolved = referenceIDs.filter((id) => id && !nameCache.has(id));

  if (!unresolved.length) return;

  await Promise.allSettled(

    unresolved.map(async (refId) => {

      try {

        let user: any = null;

        const r1 = await fetch(`/api/users?referenceID=${encodeURIComponent(refId)}`);

        if (r1.ok) {

          const d1 = await r1.json();

          const c1 = Array.isArray(d1) ? d1[0] : d1;

          if (c1?.Firstname) user = c1;

        }

        if (!user) {

          const r2 = await fetch(`/api/users?ReferenceID=${encodeURIComponent(refId)}`);

          if (r2.ok) {

            const d2 = await r2.json();

            const c2 = Array.isArray(d2) ? d2[0] : d2;

            if (c2?.Firstname) user = c2;

          }

        }

        nameCache.set(refId, user?.Firstname ? `${user.Firstname} ${user.Lastname ?? ""}`.trim() : refId);

      } catch { nameCache.set(refId, refId); }

    }),

  );

}



/* ─────────────────────────────────────────────

   Detail Sheet

───────────────────────────────────────────── */

function LogDetailSheet({ log, open, onClose }: { log: AuditLog | null; open: boolean; onClose: () => void }) {

  if (!log) return null;

  const raw = log._raw ?? {};

  return (

    <Sheet open={open} onOpenChange={onClose}>

      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">

        <SheetHeader>

          <SheetTitle>Audit Log Detail</SheetTitle>

          <SheetDescription>Full snapshot of this event</SheetDescription>

        </SheetHeader>

        <Separator className="my-4" />

        <div className="space-y-3 text-sm">

          <div className="flex items-center gap-2">

            <span className="font-medium w-36 shrink-0 text-muted-foreground">Action</span>

            <Badge variant="outline" className={cn("text-xs", ACTION_COLORS[log.whatHappened] ?? "bg-gray-100 text-gray-700")}>

              {log.whatHappened}

            </Badge>

          </div>

          <div className="flex items-center gap-2">

            <span className="font-medium w-36 shrink-0 text-muted-foreground">Timestamp</span>

            <span>{formatTimestamp(getDisplayTime(log))}</span>

          </div>

          {log.performedBy && (

            <div className="flex items-center gap-2">

              <span className="font-medium w-36 shrink-0 text-muted-foreground">Performed By</span>

              <span>{log.performedByName || log.performedBy}</span>

            </div>

          )}

          <Separator />

          {Object.entries(raw)

            .filter(([k]) => k !== "_raw" && k !== "whatHappened" && k !== "date_updated" && k !== "createdAt" && k !== "updatedAt")

            .map(([k, v]) => (

              <div key={k} className="flex gap-2">

                <span className="font-medium w-36 shrink-0 text-muted-foreground capitalize">

                  {k.replace(/([A-Z])/g, " $1").trim()}

                </span>

                <span className="break-all text-xs text-gray-700">

                  {typeof v === "object" ? JSON.stringify(v, null, 2) : String(v ?? "—")}

                </span>

              </div>

            ))}

        </div>

      </SheetContent>

    </Sheet>

  );

}



/* ─────────────────────────────────────────────

   Tab state

───────────────────────────────────────────── */

type TabState = {

  logs: AuditLog[];

  cursor: QueryDocumentSnapshot<DocumentData> | null;

  hasMore: boolean;

  page: number;

  search: string;

  actionFilter: string;

};



const initTabState = (): TabState => ({

  logs: [], cursor: null, hasMore: true, page: 1, search: "", actionFilter: "all",

});



/* ─────────────────────────────────────────────

   Mobile Card

───────────────────────────────────────────── */

function MobileCard({

  log, primaryLabel, primaryValue, secondaryLabel, secondaryValue, onEye, extraRows, mediaButtons,

}: {

  log: AuditLog; primaryLabel: string; primaryValue?: string;

  secondaryLabel?: string; secondaryValue?: string; onEye: () => void;

  extraRows?: { label: string; value: React.ReactNode }[];

  mediaButtons?: React.ReactNode;

}) {

  return (

    <div className="border border-gray-200 rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm p-4 space-y-2">

      <div className="flex items-start justify-between gap-2">

        <Badge variant="outline" className={cn("text-xs whitespace-nowrap shrink-0", ACTION_COLORS[log.whatHappened] ?? "bg-gray-100 text-gray-700 border-gray-200")}>

          {log.whatHappened}

        </Badge>

        <button onClick={onEye} className="h-7 w-7 rounded-lg border border-gray-200 bg-white/80 flex items-center justify-center shrink-0">

          <Eye className="h-3.5 w-3.5 text-gray-500" />

        </button>

      </div>



      {primaryValue && (

        <div className="flex items-center gap-1.5 text-xs">

          <span className="text-gray-500 shrink-0">{primaryLabel}:</span>

          <span className="font-semibold text-gray-800 truncate">{primaryValue}</span>

        </div>

      )}

      {secondaryValue && (

        <div className="flex items-center gap-1.5 text-xs">

          <span className="text-gray-500 shrink-0">{secondaryLabel}:</span>

          <span className="text-gray-600 truncate">{secondaryValue}</span>

        </div>

      )}



      {extraRows?.map((row, i) => (

        <div key={i} className="flex items-center gap-1.5 text-xs">

          <span className="text-gray-500 shrink-0">{row.label}:</span>

          <span className="text-gray-700">{row.value}</span>

        </div>

      ))}



      {mediaButtons && (

        <div className="flex flex-wrap gap-2 pt-1">

          {mediaButtons}

        </div>

      )}



      <div className="flex items-center justify-between pt-1 border-t border-gray-100">

        <span className="text-xs text-gray-500">{log.performedByName || log.performedBy || "—"}</span>

        <span className="text-xs text-gray-400">{formatTimestamp(getDisplayTime(log))}</span>

      </div>

    </div>

  );

}



/* ─────────────────────────────────────────────

   TabLayout Component (outside HistoryPage to prevent focus loss)

───────────────────────────────────────────── */

interface TabLayoutProps {

  tab: CollectionTab;

  searchPlaceholder: string;

  mobileCards: React.ReactNode;

  tableHeaders: React.ReactNode;

  tableRows: React.ReactNode;

  tabState: TabState;

  filteredCount: number;

  fetching: boolean;

  onSearchChange: (value: string) => void;

  onActionFilterChange: (value: string) => void;

  onFirstPage: () => void;

  onNextPage: () => void;

  actionOptions: string[];

}



function TabLayout({

  tab,

  searchPlaceholder,

  mobileCards,

  tableHeaders,

  tableRows,

  tabState,

  filteredCount,

  fetching,

  onSearchChange,

  onActionFilterChange,

  onFirstPage,

  onNextPage,

  actionOptions,

}: TabLayoutProps) {

  const { search, actionFilter, page, hasMore } = tabState;

  

  return (

    <div className="h-dvh flex flex-col overflow-hidden -mx-4 md:-mx-6 -mt-4 md:-mt-6">



      {/* ── Toolbar ── */}

      <div className="shrink-0 bg-white/80 backdrop-blur-md border-b px-4 md:px-6 pt-4 pb-3 space-y-3">

        {/* search + filter row */}

        <div className="flex items-center gap-2">

          <div className="relative flex-1 max-w-xs">

            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />

            <input

              type="text"

              placeholder={searchPlaceholder}

              value={search}

              onChange={(e) => onSearchChange(e.target.value)}

              className="w-full h-9 pl-9 pr-3 bg-white/70 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-300"

            />

          </div>

          <Select value={actionFilter} onValueChange={onActionFilterChange}>

            <SelectTrigger className="h-9 w-44 bg-white/70">

              <SelectValue placeholder="All actions" />

            </SelectTrigger>

            <SelectContent>

              <SelectItem value="all">All Actions</SelectItem>

              {actionOptions.map((a) => (

                <SelectItem key={a} value={a}>{a}</SelectItem>

              ))}

            </SelectContent>

          </Select>

        </div>

        {/* pagination info */}

        <div className="flex items-center justify-between">

          <span className="text-sm text-gray-500">

            Page {page} · {filteredCount} record{filteredCount !== 1 ? "s" : ""} on page

          </span>

          <div className="flex gap-2">

            <Button size="sm" variant="outline" disabled={page === 1 || fetching}

              onClick={onFirstPage}>

              <ChevronLeft className="h-3.5 w-3.5 mr-1" /> First

            </Button>

            <Button size="sm" variant="outline" disabled={!hasMore || fetching}

              onClick={onNextPage}>

              Next <ChevronRight className="h-3.5 w-3.5 ml-1" />

            </Button>

          </div>

        </div>

      </div>



      {/* ── Desktop table — thead sticky inside this scroll container ── */}

      <div className="hidden md:block flex-1 min-h-0 overflow-auto bg-white/60 backdrop-blur-sm">

        <table className="w-full text-sm border-collapse">

          <thead className="bg-red-50/80 backdrop-blur-sm sticky top-0 z-10">

            <tr>{tableHeaders}</tr>

          </thead>

          <tbody>

            {fetching ? (

              <tr><td colSpan={99} className="text-center py-10 text-muted-foreground">Loading…</td></tr>

            ) : filteredCount === 0 ? (

              <tr><td colSpan={99} className="text-center py-10 text-muted-foreground">No audit logs found.</td></tr>

            ) : tableRows}

          </tbody>

        </table>

      </div>



      {/* ── Mobile cards ── */}

      <div className="md:hidden flex-1 overflow-y-auto px-3 pt-3 pb-28 space-y-3 min-h-0">

        {fetching ? (

          <div className="flex justify-center py-16">

            <div className="h-7 w-7 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />

          </div>

        ) : filteredCount === 0 ? (

          <div className="flex flex-col items-center justify-center py-20 text-center">

            <Search className="h-8 w-8 text-gray-300 mb-3" />

            <p className="text-sm font-medium text-gray-600">No audit logs found</p>

          </div>

        ) : mobileCards}

      </div>

    </div>

  );

}



/* ─────────────────────────────────────────────

   Main Page

───────────────────────────────────────────── */

export default function HistoryPage() {

  const router = useRouter();

  const { userId } = useUser();



  const [user, setUser] = useState<UserData | null>(null);

  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<CollectionTab>("suppliers");

  const [fetching, setFetching] = useState(false);

  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const [detailOpen, setDetailOpen] = useState(false);

  const [imageModal, setImageModal] = useState<{ url: string; label: string } | null>(null);

  const [specsModal, setSpecsModal] = useState<{ title: string; specs: { specId: string; value: string }[] }[] | null>(null);

  const [, setNameVersion] = useState(0);



  const [tabStates, setTabStates] = useState<Record<CollectionTab, TabState>>({

  suppliers: initTabState(),

  products: initTabState(),

  productFamilies: initTabState(),

  productUsages: initTabState(),



  // ✅ ADD THIS

  spfVersions: initTabState(),

});



  const updateTab = (tab: CollectionTab, patch: Partial<TabState>) =>

    setTabStates((prev) => ({ ...prev, [tab]: { ...prev[tab], ...patch } }));



  useEffect(() => {

    if (userId === null) return;

    if (!userId) { router.push("/login"); return; }

    fetch(`/api/users?id=${encodeURIComponent(userId)}`)

      .then((r) => r.json()).then((d) => setUser(d)).catch(console.error)

      .finally(() => setLoading(false));

  }, [userId, router]);



  const fetchLogs = useCallback(async (

    tab: CollectionTab,

    cursor: QueryDocumentSnapshot<DocumentData> | null,

    actionFilter: string,

  ): Promise<{ logs: AuditLog[]; lastDoc: QueryDocumentSnapshot<DocumentData> | null; hasMore: boolean }> => {

    const colName = COL_MAP[tab];

    let q = query(collection(db, colName), orderBy("date_updated", "desc"), limit(PAGE_SIZE + 1));

    if (actionFilter !== "all") {

      q = query(collection(db, colName), where("whatHappened", "==", actionFilter), orderBy("date_updated", "desc"), limit(PAGE_SIZE + 1));

    }

    if (cursor) {

      q = query(

        collection(db, colName),

        ...(actionFilter !== "all" ? [where("whatHappened", "==", actionFilter)] : []),

        orderBy("date_updated", "desc"), startAfter(cursor), limit(PAGE_SIZE + 1),

      );

    }

    const snap = await getDocs(q);

    const docs = snap.docs;

    const hasMore = docs.length > PAGE_SIZE;

    const sliced = docs.slice(0, PAGE_SIZE);

    const lastDoc = sliced[sliced.length - 1] ?? null;



    const logs: AuditLog[] = sliced.map((d) => {

      const raw = d.data() as Record<string, any>;

      const refId = raw.referenceID ?? raw.performedBy ?? raw.updatedByReferenceID ?? "";

      return {

        id: d.id, whatHappened: raw.whatHappened ?? "Unknown",

        performedBy: refId, performedByName: nameCache.get(refId) ?? "",

        referenceID: raw.referenceID ?? "", supplierId: raw.supplierId ?? "",

        supplierbrandId: raw.supplierbrandId ?? "", company: raw.company ?? "",

        supplierBrand: raw.supplierBrand ?? "", productId: raw.productId ?? "",

        productReferenceID: raw.productReferenceID ?? "", productClass: raw.productClass ?? "",

        pricePoint: raw.pricePoint ?? "", supplier: raw.supplier ?? null,

        productFamilyId: raw.productFamilyId ?? "", productFamilyName: raw.productFamilyName ?? "",

        productUsageId: raw.productUsageId ?? "", productUsageName: raw.productUsageName ?? "",

        mainImage: raw.mainImage ?? null, dimensionalDrawing: raw.dimensionalDrawing ?? null,

        illuminanceDrawing: raw.illuminanceDrawing ?? null,

        technicalSpecifications: raw.technicalSpecifications ?? null,

        inserted: raw.inserted, reactivated: raw.reactivated, skipped: raw.skipped, overwritten: raw.overwritten,

        date_updated: raw.date_updated, createdAt: raw.createdAt, updatedAt: raw.updatedAt, _raw: raw,

      };

    });



    const refIds = [...new Set(logs.map((l) => l.performedBy ?? "").filter(Boolean))];

    await resolveNames(refIds);

    logs.forEach((log) => {

      if (log.performedBy) log.performedByName = nameCache.get(log.performedBy) ?? log.performedBy;

    });

    return { logs, lastDoc, hasMore };

  }, []);



  const loadTab = useCallback(async (tab: CollectionTab, actionFilter: string) => {

    if (!userId) return;

    setFetching(true);

    try {

      const { logs, lastDoc, hasMore } = await fetchLogs(tab, null, actionFilter);

      updateTab(tab, { logs, cursor: lastDoc, hasMore, page: 1 });

      setNameVersion((v) => v + 1);

    } finally { setFetching(false); }

  }, [userId, fetchLogs]);



  useEffect(() => { loadTab("suppliers", tabStates.suppliers.actionFilter); }, [userId, tabStates.suppliers.actionFilter]); // eslint-disable-line

  useEffect(() => { loadTab("products", tabStates.products.actionFilter); }, [userId, tabStates.products.actionFilter]); // eslint-disable-line

  useEffect(() => { loadTab("productFamilies", tabStates.productFamilies.actionFilter); }, [userId, tabStates.productFamilies.actionFilter]); // eslint-disable-line

  useEffect(() => { loadTab("productUsages", tabStates.productUsages.actionFilter); }, [userId, tabStates.productUsages.actionFilter]); // eslint-disable-line

  useEffect(() => {

  loadTab("spfVersions", tabStates.spfVersions.actionFilter);

}, [userId, tabStates.spfVersions.actionFilter]);



  const loadNextPage = async (tab: CollectionTab) => {

    setFetching(true);

    try {

      const { cursor, actionFilter } = tabStates[tab];

      const { logs, lastDoc, hasMore } = await fetchLogs(tab, cursor, actionFilter);

      updateTab(tab, { logs, cursor: lastDoc, hasMore, page: tabStates[tab].page + 1 });

      setNameVersion((v) => v + 1);

    } finally { setFetching(false); }

  };



  const filtered = (tab: CollectionTab): AuditLog[] => {

    const { logs, search } = tabStates[tab];

    const q = search.toLowerCase();

    if (!q) return logs;

    return logs.filter((l) =>

      l.whatHappened?.toLowerCase().includes(q) ||

      l.performedByName?.toLowerCase().includes(q) ||

      l.performedBy?.toLowerCase().includes(q) ||

      l.company?.toLowerCase().includes(q) ||

      l.supplierBrand?.toLowerCase().includes(q) ||

      l.productReferenceID?.toLowerCase().includes(q) ||

      l.supplier?.company?.toLowerCase().includes(q) ||

      l.productClass?.toLowerCase().includes(q) ||

      l.productFamilyName?.toLowerCase().includes(q) ||

      l.productUsageName?.toLowerCase().includes(q),

    );

  };



  const ActionBadge = ({ action }: { action: string }) => (

    <Badge variant="outline" className={cn("text-xs whitespace-nowrap", ACTION_COLORS[action] ?? "bg-gray-100 text-gray-700 border-gray-200")}>

      {action}

    </Badge>

  );



  const displayName = (log: AuditLog) => log.performedByName || log.performedBy || "—";



  const EyeBtn = ({ log }: { log: AuditLog }) => (

    <TooltipProvider>

      <Tooltip>

        <TooltipTrigger asChild>

          <Button size="icon" variant="ghost" className="h-7 w-7"

            onClick={() => { setSelectedLog(log); setDetailOpen(true); }}>

            <Eye className="h-3.5 w-3.5" />

          </Button>

        </TooltipTrigger>

        <TooltipContent>View details</TooltipContent>

      </Tooltip>

    </TooltipProvider>

  );



  /* ── Reusable tab layout: toolbar + table/cards + pagination ── */

  // TabLayout is now defined outside HistoryPage to prevent input focus loss



  if (loading) return null;



  /* ── th helper ── */

  const Th = ({ children, className }: { children?: React.ReactNode; className?: string }) => (

    <th className={cn("text-left font-bold px-3 py-3 border-b whitespace-nowrap text-sm", className)}>

      {children}

    </th>

  );



  /* ── td helper ── */

  const Td = ({ children, className }: { children?: React.ReactNode; className?: string }) => (

    <td className={cn("px-3 py-3 border-b align-middle", className)}>{children}</td>

  );



  return (

    <AccessGuard accessKey="page:history">

      <div className="h-dvh flex flex-col overflow-hidden">



      {/* ── DESKTOP HEADER ── */}

      <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">

        <SidebarTrigger />

        <div className="flex items-center justify-between gap-3">

          <h1 className="text-2xl font-semibold shrink-0">Audit Trail</h1>

          <div className="flex items-center gap-2">

            <span className="text-sm text-gray-500">

              Welcome, {user?.Firstname} {user?.Lastname}

              <span className="ml-1 text-gray-400">({user?.Role})</span>

            </span>

            <Button size="sm" variant="outline" disabled={fetching}

              onClick={() => {

                  (["suppliers", "products", "productFamilies", "productUsages", "spfVersions"] as CollectionTab[]).forEach((t) =>

                    updateTab(t, { actionFilter: "all" }),

                  );

              }}

            >

              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", fetching && "animate-spin")} />

              Refresh

            </Button>

          </div>

        </div>

      </div>



      {/* ── MOBILE HEADER ── */}

      <div className="md:hidden shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 pt-5 pb-3">

        <div className="flex items-center justify-between mb-1">

          <h1 className="text-lg font-bold text-gray-900">Audit Trail</h1>

          <Button size="sm" variant="outline" disabled={fetching}

            onClick={() => {

              (["suppliers", "products", "productFamilies", "productUsages", "spfVersions"] as CollectionTab[]).forEach((t) =>

                updateTab(t, { actionFilter: "all" }),

              );

            }}

          >

            <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />

          </Button>

        </div>

        <p className="text-xs text-gray-400">

          {user?.Firstname} {user?.Lastname} · {user?.Role}

        </p>

      </div>



      {/* ── TABS ── */}

      <div className="flex-1 min-h-0 overflow-hidden">

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CollectionTab)} className="h-full flex flex-col">



          {/* Tab triggers — scrollable on mobile */}

          <div className="overflow-x-auto shrink-0 bg-white/70 backdrop-blur-sm border-b px-4 md:px-6">

            <TabsList className="w-max md:w-auto h-10 bg-transparent gap-0 rounded-none p-0">

              {([

                { value: "suppliers",       label: "Suppliers",        icon: Building2 },

                { value: "products",        label: "Products",         icon: Package   },

                { value: "productFamilies", label: "Product Families", icon: Layers    },

                { value: "productUsages",   label: "Product Usage",    icon: Tag       },

                { value: "spfVersions",     label: "SPF History",      icon: Layers    },

              ] as { value: CollectionTab; label: string; icon: React.ElementType }[]).map(({ value, label, icon: Icon }) => (

                <TabsTrigger

                  key={value}

                  value={value}

                  className="h-10 px-4 rounded-none border-b-2 border-transparent data-[state=active]:border-gray-900 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-xs md:text-sm whitespace-nowrap flex items-center gap-1.5"

                >

                  <Icon className="h-3.5 w-3.5" />

                  {label}

                </TabsTrigger>

              ))}

            </TabsList>

          </div>



          {/* ════ SUPPLIERS ════ */}

          <TabsContent value="suppliers" className="flex-1 min-h-0 overflow-hidden mt-0 p-4 md:p-6">

            <TabLayout

              tab="suppliers"

              searchPlaceholder="Search company, brand, name…"

              tableHeaders={<>

                <Th className="w-44">Timestamp</Th>

                <Th>Action</Th>

                <Th>Company</Th>

                <Th>Brand</Th>

                <Th>Performed By</Th>

                <Th className="w-10"></Th>

              </>}

              tableRows={filtered("suppliers").filter((log) => log.whatHappened !== "Supplier Bulk Upload").map((log) => (

                <tr key={log.id} className="border-b hover:bg-white/60 align-middle">

                  <Td className="text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(getDisplayTime(log))}</Td>

                  <Td><ActionBadge action={log.whatHappened} /></Td>

                  <Td className="font-medium">{log.company || <span className="text-gray-400 italic">No Company Name</span>}</Td>

                  <Td className="text-muted-foreground">{log.supplierBrand || <span className="text-gray-400 italic">No Supplier Brand</span>}</Td>

                  <Td className="text-xs text-muted-foreground">{displayName(log)}</Td>

                  <Td><EyeBtn log={log} /></Td>

                </tr>

              ))}

              mobileCards={<>{filtered("suppliers").filter((log) => log.whatHappened !== "Supplier Bulk Upload").map((log) => (

                <MobileCard key={log.id} log={log}

                  primaryLabel="Company Name" primaryValue={log.company || "No Company Name"}

                  secondaryLabel="Supplier Brand" secondaryValue={log.supplierBrand || "No Supplier Brand"}

                  onEye={() => { setSelectedLog(log); setDetailOpen(true); }}

                />

              ))}</>}

              tabState={tabStates.suppliers}

              filteredCount={filtered("suppliers").length}

              fetching={fetching}

              onSearchChange={(value) => updateTab("suppliers", { search: value })}

              onActionFilterChange={(value) => updateTab("suppliers", { actionFilter: value })}

              onFirstPage={() => { updateTab("suppliers", { cursor: null, page: 1 }); loadTab("suppliers", tabStates.suppliers.actionFilter); }}

              onNextPage={() => loadNextPage("suppliers")}

              actionOptions={ACTION_OPTIONS.suppliers}

            />

          </TabsContent>



          {/* ════ PRODUCTS ════ */}

          <TabsContent value="products" className="flex-1 min-h-0 overflow-hidden mt-0 p-4 md:p-6">

            <TabLayout

              tab="products"

              searchPlaceholder="Search ref ID, supplier, name…"

              tableHeaders={<>

                <Th className="w-44">Timestamp</Th>

                <Th>Action</Th>

                <Th>Company Name</Th>

                <Th>Supplier Brand</Th>

                <Th>Class</Th>

                <Th>Image</Th>

                <Th>Dimensional</Th>

                <Th>Illuminance</Th>

                <Th>Tech Specs</Th>

                <Th>Performed By</Th>

                <Th className="w-10"></Th>

              </>}

              tableRows={filtered("products").filter((log) => log.whatHappened !== "Product Bulk Upload").map((log) => (

                <tr key={log.id} className="border-b hover:bg-white/60 align-middle">

                  <Td className="text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(getDisplayTime(log))}</Td>

                  <Td><ActionBadge action={log.whatHappened} /></Td>

                  <Td className="text-muted-foreground">{log.supplier?.company || <span className="text-gray-400 italic">No Company Name</span>}</Td>

                  <Td className="text-muted-foreground">{log.supplier?.supplierBrand || <span className="text-gray-400 italic">No Supplier Brand</span>}</Td>

                  <Td>{log.productClass ? <Badge variant="secondary" className="text-xs">{log.productClass}</Badge> : "—"}</Td>

                  <Td className="text-xs">

                    {log.mainImage?.url

                      ? <button onClick={() => setImageModal({ url: log.mainImage!.url!, label: "Main Image" })} className="text-blue-600 underline hover:text-blue-800">View</button>

                      : <span className="text-gray-400 italic">None</span>}

                  </Td>

                  <Td className="text-xs">

                    {log.dimensionalDrawing?.url

                      ? <button onClick={() => setImageModal({ url: log.dimensionalDrawing!.url!, label: "Dimensional Drawing" })} className="text-blue-600 underline hover:text-blue-800">View</button>

                      : <span className="text-gray-400 italic">None</span>}

                  </Td>

                  <Td className="text-xs">

                    {log.illuminanceDrawing?.url

                      ? <button onClick={() => setImageModal({ url: log.illuminanceDrawing!.url!, label: "Illuminance Drawing" })} className="text-blue-600 underline hover:text-blue-800">View</button>

                      : <span className="text-gray-400 italic">None</span>}

                  </Td>

                  <Td className="text-xs">

                    {log.technicalSpecifications?.length

                      ? <button onClick={() => setSpecsModal(log.technicalSpecifications!)} className="text-blue-600 underline hover:text-blue-800">

                          {log.technicalSpecifications.length} group{log.technicalSpecifications.length !== 1 ? "s" : ""}

                        </button>

                      : <span className="text-gray-400 italic">None</span>}

                  </Td>

                  <Td className="text-xs text-muted-foreground">{displayName(log)}</Td>

                  <Td><EyeBtn log={log} /></Td>

                </tr>

              ))}

              mobileCards={<>{filtered("products").filter((log) => log.whatHappened !== "Product Bulk Upload").map((log) => (

                <MobileCard key={log.id} log={log}

                  primaryLabel="Company Name" primaryValue={log.supplier?.company || "No Company Name"}

                  secondaryLabel="Supplier Brand" secondaryValue={log.supplier?.supplierBrand || "No Supplier Brand"}

                  onEye={() => { setSelectedLog(log); setDetailOpen(true); }}

                  extraRows={[

                    { label: "Class", value: log.productClass

                        ? <Badge variant="secondary" className="text-xs">{log.productClass}</Badge>

                        : <span className="text-gray-400 italic">—</span> },

                    { label: "Tech Specs", value: log.technicalSpecifications?.length

                        ? <button onClick={() => setSpecsModal(log.technicalSpecifications!)} className="text-blue-600 underline">

                            {log.technicalSpecifications.length} group{log.technicalSpecifications.length !== 1 ? "s" : ""}

                          </button>

                        : <span className="text-gray-400 italic">None</span> },

                  ]}

                  mediaButtons={<>

                    {log.mainImage?.url && (

                      <button onClick={() => setImageModal({ url: log.mainImage!.url!, label: "Main Image" })}

                        className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 font-medium">

                        📷 Image

                      </button>

                    )}

                    {log.dimensionalDrawing?.url && (

                      <button onClick={() => setImageModal({ url: log.dimensionalDrawing!.url!, label: "Dimensional Drawing" })}

                        className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 font-medium">

                        📐 Dimensional

                      </button>

                    )}

                    {log.illuminanceDrawing?.url && (

                      <button onClick={() => setImageModal({ url: log.illuminanceDrawing!.url!, label: "Illuminance Drawing" })}

                        className="text-xs px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-600 font-medium">

                        💡 Illuminance

                      </button>

                    )}

                  </>}

                />

              ))}</>}

              tabState={tabStates.products}

              filteredCount={filtered("products").length}

              fetching={fetching}

              onSearchChange={(value) => updateTab("products", { search: value })}

              onActionFilterChange={(value) => updateTab("products", { actionFilter: value })}

              onFirstPage={() => { updateTab("products", { cursor: null, page: 1 }); loadTab("products", tabStates.products.actionFilter); }}

              onNextPage={() => loadNextPage("products")}

              actionOptions={ACTION_OPTIONS.products}

            />

          </TabsContent>



          {/* ════ PRODUCT FAMILIES ════ */}

          <TabsContent value="productFamilies" className="flex-1 min-h-0 overflow-hidden mt-0 p-4 md:p-6">

            <TabLayout

              tab="productFamilies"

              searchPlaceholder="Search family name…"

              tableHeaders={<>

                <Th className="w-44">Timestamp</Th>

                <Th>Action</Th>

                <Th>Family Name</Th>

                <Th>Performed By</Th>

                <Th className="w-10"></Th>

              </>}

              tableRows={filtered("productFamilies").map((log) => (

                <tr key={log.id} className="border-b hover:bg-white/60 align-middle">

                  <Td className="text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(getDisplayTime(log))}</Td>

                  <Td><ActionBadge action={log.whatHappened} /></Td>

                  <Td className="font-medium">{log.productFamilyName || "—"}</Td>

                  <Td className="text-xs text-muted-foreground">{displayName(log)}</Td>

                  <Td><EyeBtn log={log} /></Td>

                </tr>

              ))}

              mobileCards={<>{filtered("productFamilies").map((log) => (

                <MobileCard key={log.id} log={log}

                  primaryLabel="Family" primaryValue={log.productFamilyName || "—"}

                  onEye={() => { setSelectedLog(log); setDetailOpen(true); }}

                />

              ))}</>}

              tabState={tabStates.productFamilies}

              filteredCount={filtered("productFamilies").length}

              fetching={fetching}

              onSearchChange={(value) => updateTab("productFamilies", { search: value })}

              onActionFilterChange={(value) => updateTab("productFamilies", { actionFilter: value })}

              onFirstPage={() => { updateTab("productFamilies", { cursor: null, page: 1 }); loadTab("productFamilies", tabStates.productFamilies.actionFilter); }}

              onNextPage={() => loadNextPage("productFamilies")}

              actionOptions={ACTION_OPTIONS.productFamilies}

            />

          </TabsContent>



          {/* ════ PRODUCT USAGE ════ */}

          <TabsContent value="productUsages" className="flex-1 min-h-0 overflow-hidden mt-0 p-4 md:p-6">

            <TabLayout

              tab="productUsages"

              searchPlaceholder="Search product usage name…"

              tableHeaders={<>

                <Th className="w-44">Timestamp</Th>

                <Th>Action</Th>

                <Th>Product Usage Name</Th>

                <Th>Performed By</Th>

                <Th className="w-10"></Th>

              </>}

              tableRows={filtered("productUsages").map((log) => (

                <tr key={log.id} className="border-b hover:bg-white/60 align-middle">

                  <Td className="text-xs text-muted-foreground whitespace-nowrap">{formatTimestamp(getDisplayTime(log))}</Td>

                  <Td><ActionBadge action={log.whatHappened} /></Td>

                  <Td className="font-medium">{log.productUsageName || "—"}</Td>

                  <Td className="text-xs text-muted-foreground">{displayName(log)}</Td>

                  <Td><EyeBtn log={log} /></Td>

                </tr>

              ))}

              mobileCards={<>{filtered("productUsages").map((log) => (

                <MobileCard key={log.id} log={log}

                  primaryLabel="Usage" primaryValue={log.productUsageName || "—"}

                  onEye={() => { setSelectedLog(log); setDetailOpen(true); }}

                />

              ))}</>}

              tabState={tabStates.productUsages}

              filteredCount={filtered("productUsages").length}

              fetching={fetching}

              onSearchChange={(value) => updateTab("productUsages", { search: value })}

              onActionFilterChange={(value) => updateTab("productUsages", { actionFilter: value })}

              onFirstPage={() => { updateTab("productUsages", { cursor: null, page: 1 }); loadTab("productUsages", tabStates.productUsages.actionFilter); }}

              onNextPage={() => loadNextPage("productUsages")}

              actionOptions={ACTION_OPTIONS.productUsages}

            />

          </TabsContent>



          {/* ════ SPF VERSIONS ════ */}

          <TabsContent value="spfVersions" className="flex-1 min-h-0 overflow-hidden mt-0 p-4 md:p-6">

            <TabLayout

              tab="spfVersions"

              searchPlaceholder="Search SPF number…"

              tableHeaders={<>

                <Th className="w-44">Timestamp</Th>

                <Th>Action</Th>

                <Th>SPF Number</Th>

                <Th>Version</Th>

                <Th>Performed By</Th>

                <Th className="w-10"></Th>

              </>}

              tableRows={filtered("spfVersions").map((log) => (

                <tr key={log.id} className="border-b hover:bg-white/60 align-middle">

                  <Td className="text-xs text-muted-foreground whitespace-nowrap">

                    {formatTimestamp(getDisplayTime(log))}

                  </Td>

                  <Td><ActionBadge action={log.whatHappened} /></Td>

                  <Td className="font-medium">{log._raw?.spf_number || "—"}</Td>

                  <Td>{log._raw?.version_label || "—"}</Td>

                  <Td className="text-xs text-muted-foreground">{displayName(log)}</Td>

                  <Td><EyeBtn log={log} /></Td>

                </tr>

              ))}

              mobileCards={<>

                {filtered("spfVersions").map((log) => (

                  <MobileCard key={log.id} log={log}

                    primaryLabel="SPF Number"

                    primaryValue={log._raw?.spf_number || "—"}

                    secondaryLabel="Version"

                    secondaryValue={log._raw?.version_label || "—"}

                    onEye={() => { setSelectedLog(log); setDetailOpen(true); }}

                  />

                ))}

              </>}

              tabState={tabStates.spfVersions}

              filteredCount={filtered("spfVersions").length}

              fetching={fetching}

              onSearchChange={(value) => updateTab("spfVersions", { search: value })}

              onActionFilterChange={(value) => updateTab("spfVersions", { actionFilter: value })}

              onFirstPage={() => { updateTab("spfVersions", { cursor: null, page: 1 }); loadTab("spfVersions", tabStates.spfVersions.actionFilter); }}

              onNextPage={() => loadNextPage("spfVersions")}

              actionOptions={ACTION_OPTIONS.spfVersions}

            />

          </TabsContent>



        </Tabs>

      </div>



      {/* ── IMAGE MODAL ── */}

      {imageModal && (

        <Sheet open={!!imageModal} onOpenChange={() => setImageModal(null)}>

          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">

            <SheetHeader>

              <SheetTitle>{imageModal.label}</SheetTitle>

              <SheetDescription>

                <a href={imageModal.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline text-xs break-all">

                  Open original ↗

                </a>

              </SheetDescription>

            </SheetHeader>

            <Separator className="my-4" />

            <div className="flex items-center justify-center bg-gray-50 rounded-xl p-4 min-h-[200px]">

              <img

                src={`/api/gdrive-image?url=${encodeURIComponent(imageModal.url)}`}

                alt={imageModal.label}

                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow"

                onError={(e) => {

                  // fallback: try direct URL if proxy fails

                  const img = e.target as HTMLImageElement;

                  if (!img.src.includes("fallback")) {

                    img.src = imageModal.url;

                    img.setAttribute("data-fallback", "true");

                  }

                }}

              />

            </div>

          </SheetContent>

        </Sheet>

      )}



      {/* ── TECH SPECS MODAL ── */}

      {specsModal && (

        <Sheet open={!!specsModal} onOpenChange={() => setSpecsModal(null)}>

          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">

            <SheetHeader>

              <SheetTitle>Technical Specifications</SheetTitle>

              <SheetDescription>Snapshot at time of action</SheetDescription>

            </SheetHeader>

            <Separator className="my-4" />

            <div className="space-y-4">

              {specsModal.map((group, gi) => (

                <div key={gi}>

                  <p className="text-xs font-bold uppercase tracking-widest text-orange-600 mb-2">{group.title}</p>

                  <table className="w-full text-sm border-collapse">

                    <thead>

                      <tr className="bg-gray-100">

                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">Specification</th>

                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600 border-b">Value</th>

                      </tr>

                    </thead>

                    <tbody>

                      {group.specs.map((row, ri) => (

                        <tr key={ri} className="border-b hover:bg-gray-50">

                          <td className="px-3 py-2 text-xs text-gray-600">{row.specId || "—"}</td>

                          <td className="px-3 py-2 text-xs font-medium">{row.value || <span className="text-gray-400 italic">—</span>}</td>

                        </tr>

                      ))}

                    </tbody>

                  </table>

                </div>

              ))}

            </div>

          </SheetContent>

        </Sheet>

      )}



      <LogDetailSheet log={selectedLog} open={detailOpen} onClose={() => setDetailOpen(false)} />

    </div>

    </AccessGuard>

  );

}