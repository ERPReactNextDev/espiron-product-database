"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { AccessGuard } from "@/components/AccessGuard";
import { supabase } from "@/utils/supabase";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  RefreshCw,
} from "lucide-react";
import SPFRequestFetch from "@/components/spf-request-fetch";
import SPFRequestCreate, { type SPFRequest } from "@/components/spf-request-create";
import { CollaborationHubRowTrigger } from "@/components/collaboration-hub-row-trigger";
import SPFRequestDownloadAll from "@/components/spf-request-download-all";
import SpecialInstructionsDialog from "@/components/special-instructions-dialog";

/* ─────────────────────────────────────────────────────────────── */
/* STATUS LABEL MAPPING                                            */
/* ─────────────────────────────────────────────────────────────── */
function getStatusLabel(status: string | undefined): string {
  if (status === "Pending For Procurement") return "For Procurement Costing";
  if (status === "Approved By Procurement") return "Ready For Quotation";
  return status ?? "";
}

/* ─────────────────────────────────────────────────────────────── */
/* ALLOWED STATUSES                                                */
/* ─────────────────────────────────────────────────────────────── */
const ALLOWED_STATUSES = [
  "approved by tsm",
  "approved by sales head",
];

/* ─────────────────────────────────────────────────────────────── */
/* CREATION NOTIFICATION STATUSES                                  */
/* ─────────────────────────────────────────────────────────────── */
const CREATION_NOTIFICATION_STATUSES = new Set([
  "pending for procurement",
  "approved by procurement", 
  "for revision",
]);

/* ─────────────────────────────────────────────────────────────── */
/* STATUS BADGE                                                     */
/* ─────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  const isSalesHead = status.toLowerCase().includes("sales head");
  return (
    <span
      className={`text-xs px-2 py-1 rounded uppercase font-semibold whitespace-nowrap ${
        isSalesHead
          ? "bg-purple-100 text-purple-700"
          : "bg-blue-100 text-blue-700"
      }`}
    >
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* HOOK: useIsMobile                                               */
/* ─────────────────────────────────────────────────────────────── */
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}

/* ─────────────────────────────────────────────────────────────── */
/* MAIN PAGE                                                       */
/* ─────────────────────────────────────────────────────────────── */
export default function RequestsPage() {
  const { userId }            = useUser();
  const { markSPFRequestAsRead, getSPFRequestUnreadCount } = useNotifications();
  const { theme }             = useTheme();
  const { wallpaper }         = useWallpaper();
  const isEngineer            = theme === "engineer";
  const isMobile              = useIsMobile();

  /* ── User ── */
  const [loadingUser, setLoadingUser] = useState(true);
  const [userError, setUserError]     = useState<string | null>(null);
  const [processBy, setProcessBy]     = useState("");

  /* ── SPF list ── */
  const [requests, setRequests]               = useState<SPFRequest[]>([]);
  const [fetchError, setFetchError]           = useState<string | null>(null);
  const [loadingPage, setLoadingPage]         = useState(false);
  const [createdSPF, setCreatedSPF]           = useState<Record<string, string>>({});
  const [createdSPFIds, setCreatedSPFIds]    = useState<Record<string, number>>({});
  const [createdSPFLoaded, setCreatedSPFLoaded] = useState(false);

  /* ── Search / pagination ── */
  const [searchTerm, setSearchTerm]   = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [isRefreshing, setIsRefreshing] = useState(false);

  /* ── Filter / sort ── */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date_updated" | "date_received" | "alphabetical">("date_updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  /* ── Dialog ── */
  const [openDialog, setOpenDialog]     = useState(false);
  const [selectedRow, setSelectedRow]   = useState<SPFRequest | null>(null);
  const [specialInstructionsDialog, setSpecialInstructionsDialog] = useState<{
    open: boolean;
    instructions: string;
    customerName: string;
    spfNumber: string;
    status?: string;
  }>({
    open: false,
    instructions: "",
    customerName: "",
    spfNumber: "",
    status: "",
  });
  const [reviseTargetSpfNumber, setReviseTargetSpfNumber] = useState<string | null>(null);

  /* ─────────────────────── */
  /* Fetch user              */
  /* ─────────────────────── */
  useEffect(() => {
    if (!userId) { setLoadingUser(false); return; }
    const fetchUser = async () => {
      setUserError(null);
      setLoadingUser(true);
      try {
        const res  = await fetch(`/api/users?id=${encodeURIComponent(userId)}`);
        if (!res.ok) throw new Error("Failed to fetch user data");
        const data = await res.json();
        const name = `${data.Firstname ?? ""} ${data.Lastname ?? ""}`.trim();
        setProcessBy(name);
      } catch (err: any) {
        setUserError(err.message || "Failed to load user data");
      } finally {
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, [userId]);

  /* ─────────────────────── */
  /* Fetch createdSPF        */
  /* ─────────────────────── */
  const fetchCreatedSPF = useCallback(async (spfNumbers: string[]) => {
    if (!spfNumbers.length) { setCreatedSPFLoaded(true); return; }
    const { data: created } = await supabase
      .from("spf_creation")
      .select("id, spf_number, status, date_created, date_updated")
      .in("spf_number", spfNumbers);
    const map: Record<string, string> = {};
    const idMap: Record<string, number> = {}; // spf_number -> supabase id
    const versionMap: Record<string, number> = {};
    created?.forEach((c: any) => {
      const spfNumber = typeof c?.spf_number === "string" ? c.spf_number : "";
      if (!spfNumber) return;

      const dateUpdatedMs =
        typeof c?.date_updated === "string" || c?.date_updated instanceof Date
          ? new Date(c.date_updated).getTime()
          : Number.NaN;
      const dateCreatedMs =
        typeof c?.date_created === "string" || c?.date_created instanceof Date
          ? new Date(c.date_created).getTime()
          : Number.NaN;
      const idMs = typeof c?.id === "number" ? c.id : Number.NaN;
      const versionPoint = Number.isFinite(dateUpdatedMs)
        ? dateUpdatedMs
        : Number.isFinite(dateCreatedMs)
          ? dateCreatedMs
          : Number.isFinite(idMs)
            ? idMs
            : 0;
      const previousVersion = versionMap[spfNumber] ?? Number.NEGATIVE_INFINITY;
      if (versionPoint < previousVersion) return;

      versionMap[spfNumber] = versionPoint;
      map[spfNumber] = typeof c?.status === "string" ? c.status : "unknown";
      idMap[spfNumber] = typeof c?.id === "number" ? c.id : 0;
    });
    setCreatedSPF(map);
    setCreatedSPFIds(idMap);
    setCreatedSPFLoaded(true);
  }, []);

  /* ─────────────────────── */
  /* Fetch SPF requests      */
  /* ─────────────────────── */
  const fetchRequests = useCallback(async () => {
    try {
      setFetchError(null);
      setCreatedSPFLoaded(false);
      setLoadingPage(true);

      // Pass allowed statuses to API for server-side filtering
      const statusParams = ALLOWED_STATUSES.map(s => `status=${encodeURIComponent(s)}`).join('&');
      const res = await fetch(`/api/request/spf-request-fetch-api?page=1&${statusParams}`);
      if (!res.ok) throw new Error("Failed to fetch SPF requests");

      const data = await res.json();

      const mapped = (data.requests || []).map((r: any) => ({
        ...r,
        date_created: r.date_created
          ? new Date(r.date_created).toISOString()
          : null,
      }));

      setRequests(mapped);
      await fetchCreatedSPF(mapped.map((r: any) => r.spf_number));
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch SPF requests");
      setCreatedSPFLoaded(true);
    } finally {
      setLoadingPage(false);
    }
  }, [fetchCreatedSPF]);

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel("spf-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "spf_request" }, async (payload: any) => {
        // Only refresh if the record has a status that appears in the UI
        if (payload.new && typeof payload.new === 'object' && 'status' in payload.new && payload.new.status) {
          const normalizedStatus = String(payload.new.status).trim().toLowerCase();
          if (ALLOWED_STATUSES.includes(normalizedStatus)) {
            fetchRequests();
          }
        } else if (payload.old) {
          // For deletions, always refresh to update the list
          fetchRequests();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "spf_creation" }, async (payload: any) => {
        // Only refresh if the record has a status that appears in the UI
        if (payload.new && typeof payload.new === 'object' && 'status' in payload.new && payload.new.status) {
          const normalizedStatus = String(payload.new.status).trim().toLowerCase();
          if (CREATION_NOTIFICATION_STATUSES.has(normalizedStatus)) {
            fetchRequests();
          }
        } else if (payload.old) {
          // For deletions, always refresh to update the list
          fetchRequests();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchRequests]);

  /* ─────────────────────── */
  /* Filtered + paginated    */
  /* ─────────────────────── */
  const filteredRequests = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    // Apply search filter
    let filtered = requests.filter(
      (r) =>
        !term ||
        (r.spf_number || "").toLowerCase().includes(term) ||
        (r.customer_name || "").toLowerCase().includes(term)
    );

    // Apply status filter
    if (statusFilter) {
      filtered = filtered.filter((r) => {
        const spfStatus = createdSPF[r.spf_number];
        
        if (statusFilter === "No Status Yet") {
          return !spfStatus;
        }
        if (!spfStatus) return false;
        
        if (statusFilter === "For Procurement Costing") {
          return spfStatus.toLowerCase() === "pending for procurement";
        }
        if (statusFilter === "Ready For Quotation") {
          return spfStatus.toLowerCase() === "approved by procurement";
        }
        if (statusFilter === "For Revision") {
          return spfStatus.toLowerCase() === "for revision";
        }
        return false;
      });
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "alphabetical") {
        comparison = (a.spf_number || "").localeCompare(b.spf_number || "");
      } else if (sortBy === "date_received") {
        const dateA = a.date_approved_sales_head ? new Date(a.date_approved_sales_head).getTime() : 0;
        const dateB = b.date_approved_sales_head ? new Date(b.date_approved_sales_head).getTime() : 0;
        comparison = dateA - dateB;
      } else {
        // date_updated (default)
        const dateA = a.date_updated ? new Date(a.date_updated).getTime() : (a.date_created ? new Date(a.date_created).getTime() : 0);
        const dateB = b.date_updated ? new Date(b.date_updated).getTime() : (b.date_created ? new Date(b.date_created).getTime() : 0);
        comparison = dateA - dateB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [requests, searchTerm, statusFilter, sortBy, sortOrder, createdSPF]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / PAGE_SIZE));

  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRequests.slice(start, start + PAGE_SIZE);
  }, [filteredRequests, currentPage]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter, sortBy, sortOrder]);

  /* ─────────────────────── */
  /* Helpers                 */
  /* ─────────────────────── */
  const isProcurementStatus = (spfNumber: string): boolean => {
    if (!createdSPFLoaded) return true;
    const s = (createdSPF[spfNumber] ?? "").toLowerCase();
    return (
      s === "approved by procurement" ||
      s === "pending for procurement" ||
      s === "for revision" ||
      s === "pending on sales"
    );
  };

  const handleCreateFromRow = (rowData: SPFRequest) => {
    markSPFRequestAsRead(rowData.spf_number);
    setSelectedRow(rowData);
    setOpenDialog(true);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter(null);
    setSortBy("date_updated");
    setSortOrder("desc");
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setLoadingPage(true);
    try {
      await fetchRequests();
    } finally {
      setIsRefreshing(false);
      setLoadingPage(false);
    }
  };

  /* ─────────────────────── */
  /* Early returns           */
  /* ─────────────────────── */
  if (loadingUser) return <p className="p-6">Loading user...</p>;
  if (userError)   return <p className="p-6 text-red-500">{userError}</p>;

  /* ════════════════════════════════════════════════════════════ */
  /* RENDER                                                       */
  /* ════════════════════════════════════════════════════════════ */
  return (
    <AccessGuard accessKey="page:requests">
      <div className="h-dvh flex flex-col overflow-hidden">

      {/* ── DESKTOP HEADER ── */}
      <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
        <SidebarTrigger />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold shrink-0">SPF Requests</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <SPFRequestDownloadAll requests={filteredRequests} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search SPF, customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 w-64 rounded-md border pl-9 pr-3 text-sm bg-white/70"
              />
            </div>
            <span className="text-sm text-muted-foreground">{filteredRequests.length} results</span>
            {(searchTerm !== "" || statusFilter !== null) && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="text-xs h-8 px-2"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Status:</span>
          <Button
            size="sm"
            variant={statusFilter === null ? "default" : "outline"}
            onClick={() => setStatusFilter(null)}
            className="text-xs"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "For Procurement Costing" ? "default" : "outline"}
            onClick={() => setStatusFilter("For Procurement Costing")}
            className="text-xs"
          >
            For Procurement Costing
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "Ready For Quotation" ? "default" : "outline"}
            onClick={() => setStatusFilter("Ready For Quotation")}
            className="text-xs"
          >
            Ready For Quotation
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "For Revision" ? "default" : "outline"}
            onClick={() => setStatusFilter("For Revision")}
            className="text-xs"
          >
            For Revision
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "No Status Yet" ? "default" : "outline"}
            onClick={() => setStatusFilter("No Status Yet")}
            className="text-xs"
          >
            No Status Yet
          </Button>
          <div className="w-px h-6 bg-gray-300 mx-2" />
          <span className="text-xs text-gray-500 font-medium">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date_updated" | "date_received" | "alphabetical")}
            className="h-8 px-2 rounded-md border text-sm bg-white/70"
          >
            <option value="date_updated">Date Updated</option>
            <option value="date_received">Date Received</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="text-xs h-8 px-2"
          >
            {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
          </Button>
        </div>
      </div>

      {/* ── MOBILE HEADER ── */}
      <div className="md:hidden shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 pt-5 pb-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-gray-900">SPF Requests</h1>
          <SPFRequestDownloadAll requests={filteredRequests} />
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search SPF, customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-10 pl-9 pr-3 bg-white/70 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-gray-500 font-medium self-center">Status:</span>
          <Button
            size="sm"
            variant={statusFilter === null ? "default" : "outline"}
            onClick={() => setStatusFilter(null)}
            className="text-xs h-7 px-2"
          >
            All
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "For Procurement Costing" ? "default" : "outline"}
            onClick={() => setStatusFilter("For Procurement Costing")}
            className="text-xs h-7 px-2"
          >
            Procurement
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "Ready For Quotation" ? "default" : "outline"}
            onClick={() => setStatusFilter("Ready For Quotation")}
            className="text-xs h-7 px-2"
          >
            Quotation
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "For Revision" ? "default" : "outline"}
            onClick={() => setStatusFilter("For Revision")}
            className="text-xs h-7 px-2"
          >
            Revision
          </Button>
          <Button
            size="sm"
            variant={statusFilter === "No Status Yet" ? "default" : "outline"}
            onClick={() => setStatusFilter("No Status Yet")}
            className="text-xs h-7 px-2"
          >
            No Status
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-medium">Sort:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date_updated" | "date_received" | "alphabetical")}
            className="h-7 px-2 rounded-md border text-xs bg-white/70"
          >
            <option value="date_updated">Date Updated</option>
            <option value="date_received">Date Received</option>
            <option value="alphabetical">Alphabetical</option>
          </select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            className="text-xs h-7 px-2"
          >
            {sortOrder === "asc" ? "↑" : "↓"}
          </Button>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            {filteredRequests.length} result{filteredRequests.length !== 1 ? "s" : ""}
          </p>
          {(searchTerm !== "" || statusFilter !== null) && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-xs h-7 px-2"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* ── DESKTOP PAGINATION BAR ── */}
      <div className="hidden md:flex items-center justify-between px-6 py-2 bg-white/70 backdrop-blur-md border-b shrink-0">
        <span className="text-sm text-gray-500">
          Page {currentPage} of {totalPages} · {filteredRequests.length} requests
        </span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={isRefreshing} onClick={handleRefresh}>
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="outline" disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {/* ── DESKTOP TABLE ── */}
      <div className={`hidden md:block flex-1 min-h-0 overflow-auto bg-white/60 backdrop-blur-sm ${
        isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
      }`}>
        <table className="w-full text-sm border-collapse">
          <thead className="bg-red-50/80 backdrop-blur-sm sticky top-0 z-30">
            <tr>
              {["SPF Number", "Customer Name", "Special Instructions", "Prepared By", "Approved By", "Date Received", "Date Updated", "Action"].map((h, index) => (
                <th key={h} className={`px-4 py-3 text-left font-bold border-b whitespace-nowrap ${index === 0 ? 'sticky left-0 bg-red-50/80 backdrop-blur-sm z-20' : ''}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isRefreshing ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">Loading...</td>
              </tr>
            ) : filteredRequests.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">No SPF requests yet.</td>
              </tr>
            ) : (
              paginatedRequests.map((req) => {
                const formattedDate = req.date_updated
                  ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(req.date_updated))
                  : (req.date_created
                    ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(req.date_created))
                    : "-");
                const formattedDateApprovedSalesHead = req.date_approved_sales_head
                  ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(req.date_approved_sales_head))
                  : "-";
                const spfStatus = createdSPF[req.spf_number];
                const unreadCountForRow = getSPFRequestUnreadCount(req.spf_number);
                const isUnreadRow = unreadCountForRow > 0;

                return (
                  <tr key={req.id} className={`border-b hover:bg-white/60 align-middle ${isUnreadRow ? "bg-red-50/40 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.20)]" : ""}`}>
                    <td className="px-4 py-3 font-medium uppercase sticky left-0 bg-white/60 backdrop-blur-sm z-20">
                      <div className="inline-flex items-center gap-2">
                        <span>{req.spf_number}</span>
                        {isUnreadRow && (
                          <span className="h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] rounded-full bg-red-600 text-white font-bold shadow-[0_0_16px_rgba(239,68,68,0.75)] animate-pulse">
                            1
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 uppercase">{req.customer_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {/* Person icon */}
                        <div className="shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        {/* Speech balloon */}
                        <div className="relative group cursor-pointer" onClick={() => {
                          if (req.special_instructions && req.special_instructions.length > 30) {
                            setSpecialInstructionsDialog({
                              open: true,
                              instructions: req.special_instructions,
                              customerName: req.customer_name,
                              spfNumber: req.spf_number
                            });
                          }
                        }}>
                          <div className="relative bg-linear-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-2xl px-3 py-2 shadow-sm hover:shadow-md hover:scale-105 hover:-translate-y-0.5 transition-all duration-300 ease-out max-w-50">
                            <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide block truncate">
                              {req.special_instructions || "-"}
                            </span>
                            {/* Show "Click to view more..." indicator */}
                            {req.special_instructions && (
                              <span 
                                className="text-[10px] text-indigo-500 font-medium cursor-pointer hover:text-indigo-700 underline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSpecialInstructionsDialog({
                                    open: true,
                                    instructions: req.special_instructions || "",
                                    customerName: req.customer_name,
                                    spfNumber: req.spf_number,
                                    status: req.status
                                  });
                                }}
                              >
                                Click to view more...
                              </span>
                            )}
                            {/* Speech balloon tail pointing to person */}
                            <div 
                              className="absolute -left-2 top-3 w-3 h-3 bg-indigo-50 border-l-2 border-b-2 border-indigo-300 transform rotate-45 group-hover:bg-purple-50 transition-colors duration-300 cursor-pointer hover:scale-105"
                              onClick={() => {
                                setSpecialInstructionsDialog({
                                  open: true,
                                  spfNumber: req.spf_number,
                                  customerName: req.customer_name,
                                  instructions: req.special_instructions || "",
                                  status: req.status
                                });
                              }}></div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 uppercase">{req.prepared_by || "-"}</td>
                    <td className="px-4 py-3 uppercase">{req.approved_by || "-"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formattedDateApprovedSalesHead}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{formattedDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-nowrap items-center">
                        <CollaborationHubRowTrigger
                          requestId={String(createdSPFIds[req.spf_number] || "")}
                          spfNumber={req.spf_number}
                          status={spfStatus}
                        />
                        {!isProcurementStatus(req.spf_number) && (
                          <Button className="rounded-none h-9 px-4 shrink-0" variant="outline" onClick={() => handleCreateFromRow(req)}>
                            Create
                          </Button>
                        )}
                        {spfStatus && (
                          <div className="flex items-center gap-2 shrink-0">
                            <SPFRequestFetch
                              spfNumber={req.spf_number}
                              onOpen={() => markSPFRequestAsRead(req.spf_number)}
                              triggerDataAttr={req.spf_number}
                              triggerMode={
                                reviseTargetSpfNumber === req.spf_number ? "edit" : "view"
                              }
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── MOBILE CARD LIST ── */}
      <div className="md:hidden flex-1 overflow-y-auto px-3 pt-3 pb-28 space-y-3 min-h-0">
        {isRefreshing ? (
          <div className="flex justify-center py-16">
            <div className="h-7 w-7 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-14 w-14 rounded-full bg-white/60 flex items-center justify-center mb-3">
              <Search className="h-6 w-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-600">No SPF requests found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your search</p>
          </div>
        ) : (
          paginatedRequests.map((req) => {
            const formattedDate = req.date_updated
              ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(req.date_updated))
              : (req.date_created
                ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(req.date_created))
                : "-");
            const formattedDateApprovedSalesHead = req.date_approved_sales_head
              ? new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date(req.date_approved_sales_head))
              : "-";
            const spfStatus = createdSPF[req.spf_number];
            const unreadCountForRow = getSPFRequestUnreadCount(req.spf_number);
            const isUnreadRow = unreadCountForRow > 0;

            return (
              <div key={req.id} className={`border rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm p-4 space-y-2 ${isUnreadRow ? "border-red-200 shadow-[0_0_16px_rgba(239,68,68,0.35)]" : "border-gray-200"}`}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm uppercase">{req.spf_number}</p>
                    {isUnreadRow && (
                      <span className="h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] rounded-full bg-red-600 text-white font-bold shadow-[0_0_16px_rgba(239,68,68,0.75)] animate-pulse">
                        1
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formattedDate}</span>
                </div>
                <p className="text-sm font-medium text-gray-800 uppercase">{req.customer_name}</p>
                <div className="flex items-start gap-2">
                  {/* Person icon */}
                  <div className="shrink-0 w-7 h-7 rounded-full bg-linear-to-br from-indigo-400 to-purple-500 flex items-center justify-center shadow-md">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  {/* Speech balloon */}
                  <div className="relative group cursor-pointer w-fit">
                    <div className="relative bg-linear-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-2xl px-3 py-2 shadow-sm hover:shadow-md hover:scale-105 hover:-translate-y-0.5 transition-all duration-300 ease-out">
                      <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
                        {req.special_instructions || "-"}
                      </span>
                      {/* Speech balloon tail pointing to person */}
                      <div className="absolute -left-2 top-3 w-3 h-3 bg-indigo-50 border-l-2 border-b-2 border-indigo-300 transform rotate-45 group-hover:bg-purple-50 transition-colors duration-300"></div>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-gray-600 space-y-1 uppercase">
                  <p><span className="text-gray-400">Prepared By:</span> {req.prepared_by || "-"}</p>
                  <p><span className="text-gray-400">Approved By:</span> {req.approved_by || "-"}</p>
                </div>
                <div>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-xs text-gray-600"><span className="text-gray-400">Date Received:</span> {formattedDateApprovedSalesHead}</p>
                <div className="flex gap-2 pt-1 flex-wrap items-center">
                  <CollaborationHubRowTrigger
                    requestId={String(createdSPFIds[req.spf_number] || "")}
                    spfNumber={req.spf_number}
                    status={spfStatus}
                  />
                  {!isProcurementStatus(req.spf_number) && (
                    <Button size="sm" className="rounded-xl flex-1 h-9" variant="outline" onClick={() => handleCreateFromRow(req)}>
                      Create
                    </Button>
                  )}
                  {spfStatus && (
                    <div className="flex-1">
                      <SPFRequestFetch
                        spfNumber={req.spf_number}
                        onOpen={() => markSPFRequestAsRead(req.spf_number)}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── MOBILE PAGINATION ── */}
      {totalPages > 1 && (
        <div
          className="md:hidden flex justify-center items-center gap-3 py-3 border-t bg-white/70 backdrop-blur-sm shrink-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}
        >
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="h-8 w-8 rounded-lg border flex items-center justify-center disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            disabled={isRefreshing}
            onClick={handleRefresh}
            className="h-8 w-8 rounded-lg border flex items-center justify-center disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-sm font-medium text-gray-600">{currentPage} / {totalPages}</span>
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="h-8 w-8 rounded-lg border flex items-center justify-center disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── CREATE SPF DIALOG (delegated to SPFRequestCreate) ── */}
      {selectedRow && (
        <SPFRequestCreate
          open={openDialog}
          onOpenChange={setOpenDialog}
          rowData={selectedRow}
          processBy={processBy}
          isMobile={isMobile}
          onSuccess={fetchRequests}
        />
      )}

      {/* ── SPECIAL INSTRUCTIONS DIALOG ── */}
      <SpecialInstructionsDialog
        open={specialInstructionsDialog.open}
        onClose={() => setSpecialInstructionsDialog(prev => ({ ...prev, open: false }))}
        instructions={specialInstructionsDialog.instructions}
        customerName={specialInstructionsDialog.customerName}
        spfNumber={specialInstructionsDialog.spfNumber}
        status={createdSPF[specialInstructionsDialog.spfNumber]}
        onCreate={() => {
          const request = paginatedRequests.find(r => r.spf_number === specialInstructionsDialog.spfNumber);
          if (request) {
            handleCreateFromRow(request);
            setSpecialInstructionsDialog(prev => ({ ...prev, open: false }));
          }
        }}
        onRevise={() => {
          setSpecialInstructionsDialog(prev => ({ ...prev, open: false }));
          const spfNo = specialInstructionsDialog.spfNumber;
          setReviseTargetSpfNumber(spfNo);
          // Open SPF dialog in edit mode to trigger revision selector directly
          setTimeout(() => {
            const btn = document.querySelector(
              `button[data-spf-fetch="${spfNo}"]`,
            ) as HTMLButtonElement | null;
            if (btn) {
              // Set a flag to indicate this is a revise action from special instructions
              (btn as any).dataset.reviseFromSpecial = "true";
              btn.click();
            }
            setTimeout(() => setReviseTargetSpfNumber(null), 300);
          }, 100);
        }}
      />
    </div>
  </AccessGuard>
  );
}
