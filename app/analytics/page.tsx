"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useUser } from "@/contexts/UserContext";
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
  Search,
  RefreshCw,
  BarChart3,
  Clock,
  Package,
  FileText,
  DollarSign,
  Tag,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

/* ─────────────────────────────────────────────────────────────── */
/* TYPES                                                           */
/* ─────────────────────────────────────────────────────────────── */
type SPFCreation = {
  id: number;
  referenceid?: string;
  tsm?: string;
  spf_number?: string;
  status?: string;
  product_offer_image?: string;
  product_offer_qty?: string;
  product_offer_technical_specification?: string;
  product_offer_unit_cost?: string;
  product_offer_packaging_details?: string;
  product_offer_factory_address?: string;
  product_offer_port_of_discharge?: string;
  product_offer_subtotal?: string;
  date_created?: string;
  date_updated?: string;
  company_name?: string;
  supplier_brand?: string;
  contact_name?: string;
  contact_number?: string;
  final_selling_cost?: string;
  proj_lead_time?: string;
  manager?: string;
  item_code?: string;
  final_unit_cost?: string;
  final_subtotal?: string;
  item_added_date?: string;
  item_added_author?: string;
  product_offer_pcs_per_carton?: string;
  spf_creation_start_time?: string;
  spf_creation_end_time?: string;
  price_validity?: string;
  tds?: string;
  dimensional_drawing?: string;
  illuminance_drawing?: string;
  original_technical_specification?: string;
  product_reference_id?: string;
  revision_remarks?: string;
  revision_type?: string;
  spf_remarks_pd?: string;
  supplier_branch?: string;
  spf_remarks_procurement?: string;
  tds_pdf_urls?: string;
  commercial_type?: string;
  warranty?: string;
  customer_name?: string;
  request_date_created?: string;
};

const ROW_SEP = "|ROW|";

/* ─────────────────────────────────────────────────────────────── */
/* STATUS BADGE                                                     */
/* ─────────────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string | undefined }) {
  if (!status) return null;
  const lower = status.toLowerCase();

  let colorClass = "bg-gray-100 text-gray-700";
  if (lower.includes("approved by procurement"))
    colorClass = "bg-green-100 text-green-700";
  else if (lower.includes("pending"))
    colorClass = "bg-yellow-100 text-yellow-700";
  else if (lower.includes("revision"))
    colorClass = "bg-orange-100 text-orange-700";
  else if (lower.includes("sales"))
    colorClass = "bg-purple-100 text-purple-700";

  return (
    <span
      className={`text-xs px-2 py-1 rounded uppercase font-semibold whitespace-nowrap ${colorClass}`}
    >
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* DURATION HELPER                                                 */
/* ─────────────────────────────────────────────────────────────── */
function formatDuration(start?: string, end?: string): string {
  if (!start) return "-";
  const s = new Date(start).getTime();
  if (isNaN(s)) return "-";
  const eRaw = end ? new Date(end).getTime() : Date.now();
  const e = isNaN(eRaw) ? Date.now() : eRaw;
  const diff = Math.max(0, e - s);
  const mins = Math.floor(diff / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs}s`;
}

function parseLooseNumber(value: string | undefined): number | null {
  const raw = (value ?? "").trim();
  if (!raw || raw === "-") return null;
  const normalized = raw.replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function splitByRowGroupItem(value: string | undefined): string[][][] {
  if (!value) return [];
  return value.split(ROW_SEP).map((rowStr) =>
    rowStr.split("|").map((groupStr) => groupStr.split(",").map((v) => v.trim())),
  );
}

function computeTotalSrp(rec: SPFCreation): number | null {
  const sellingRows = splitByRowGroupItem(rec.final_selling_cost);
  const qtyRows = splitByRowGroupItem(rec.product_offer_qty);

  const rowCount = Math.max(sellingRows.length, qtyRows.length);
  let total = 0;
  let hasAny = false;

  for (let i = 0; i < rowCount; i++) {
    const srpGroups = sellingRows[i] ?? [];
    const qtyGroups = qtyRows[i] ?? [];
    const groupCount = Math.max(srpGroups.length, qtyGroups.length);

    for (let g = 0; g < groupCount; g++) {
      const srpCells = srpGroups[g] ?? [];
      const qtyCells = qtyGroups[g] ?? [];

      const cellCount = Math.max(srpCells.length, qtyCells.length);
      for (let j = 0; j < cellCount; j++) {
        const srp = parseLooseNumber(srpCells[j]);
        const qty = parseLooseNumber(qtyCells[j]);
        if (srp === null || qty === null) continue;
        total += srp * qty;
        hasAny = true;
      }
    }
  }

  return hasAny ? Math.round(total * 100) / 100 : null;
}

function formatMultiRowText(raw: string | undefined): string {
  const rows = splitByRowGroupItem(raw);
  if (rows.length === 0) return "-";
  const outRows = rows
    .map((groups) =>
      groups
        .map((cells) => cells.filter((c) => c !== "").join(", "))
        .filter((g) => g !== "")
        .join(" | "),
    )
    .filter((r) => r !== "");
  return outRows.length ? outRows.join(" | ") : "-";
}

function formatPairedByItemCode(
  valueRaw: string | undefined,
  itemCodeRaw: string | undefined,
  formatCell: (raw: string) => string,
): string[] {
  const valueRows = splitByRowGroupItem(valueRaw);
  if (valueRows.length === 0) return [];
  const codeRows = splitByRowGroupItem(itemCodeRaw);
  // if (codeRows.length === 0) return formatMultiRowText(valueRaw); // This was string return

  const rowCount = Math.max(valueRows.length, codeRows.length);
  const allItems: string[] = [];

  for (let r = 0; r < rowCount; r++) {
    const vGroups = valueRows[r] ?? [];
    const cGroups = codeRows[r] ?? [];
    const groupCount = Math.max(vGroups.length, cGroups.length);

    for (let g = 0; g < groupCount; g++) {
      const vCellsRaw = (vGroups[g] ?? []).map((v) => v.trim());
      const cCellsRaw = (cGroups[g] ?? []).map((v) => v.trim());

      const cellCount = Math.max(vCellsRaw.length, cCellsRaw.length);
      if (cellCount === 0) continue;

      const vCells =
        vCellsRaw.length === 1 && cellCount > 1
          ? Array.from({ length: cellCount }, () => vCellsRaw[0])
          : vCellsRaw;
      const cCells =
        cCellsRaw.length === 1 && cellCount > 1
          ? Array.from({ length: cellCount }, () => cCellsRaw[0])
          : cCellsRaw;

      for (let i = 0; i < cellCount; i++) {
        const formattedValue = formatCell((vCells[i] ?? "").trim());
        const code = (cCells[i] ?? "").trim();
        allItems.push(code && code !== "-" ? `${formattedValue} (${code})` : formattedValue);
      }
    }
  }

  return allItems;
}

/* ─────────────────────────────────────────────────────────────── */
/* MOBILE HOOK                                                     */
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
/* SUMMARY CARD                                                    */
/* ─────────────────────────────────────────────────────────────── */
function SummaryCard({
  icon,
  label,
  value,
  sub,
  valueClassName = "text-xl",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-white/80 backdrop-blur-sm border border-gray-200 rounded-xl p-3 sm:p-4 flex items-start gap-2 sm:gap-3 shadow-sm min-w-0">
      <div className="p-1.5 sm:p-2 rounded-lg bg-red-50 text-red-600 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-xs text-gray-500 uppercase font-medium tracking-wide truncate">{label}</p>
        <p
          className={`${valueClassName} font-bold text-gray-900 truncate`}
          title={String(value)}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────── */
/* MAIN PAGE                                                       */
/* ─────────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { userId } = useUser();
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isEngineer = theme === "engineer";
  const isMobile = useIsMobile();

  /* ── State ── */
  const [records, setRecords] = useState<SPFCreation[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);

  const [userMap, setUserMap] = useState<Record<string, { Firstname: string; Lastname: string }>>({});

  /* ── Search / pagination ── */
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;

  /* ── Filter / sort ── */
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date_updated" | "date_created" | "alphabetical">("date_updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  /* ─────────────────────── */
  /* Fetch user names from MongoDB */
  /* ─────────────────────── */
  const fetchUserNames = useCallback(async (referenceIds: string[]) => {
    if (referenceIds.length === 0) return;

    try {
      const uniqueIds = Array.from(new Set(referenceIds.filter(Boolean)));
      const userPromises = uniqueIds.map(async (refId) => {
        try {
          const response = await fetch(`/api/users?referenceID=${refId}`);
          if (response.ok) {
            const userData = await response.json();
            return { refId, userData };
          }
          return null;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(userPromises);
      const newUserMap: Record<string, { Firstname: string; Lastname: string }> = {};
      
      results.forEach((result) => {
        if (result && result.userData) {
          newUserMap[result.refId] = {
            Firstname: result.userData.Firstname || "",
            Lastname: result.userData.Lastname || "",
          };
        }
      });

      setUserMap(newUserMap);
    } catch (err) {
      console.error("Error fetching user names:", err);
    }
  }, []);

  /* ─────────────────────── */
  /* Fetch records           */
  /* ─────────────────────── */
  const fetchRecords = useCallback(async () => {
    try {
      setFetchError(null);
      setLoadingPage(true);

      const { data, error } = await supabase
        .from("spf_creation")
        .select("*")
        .eq("status", "Approved By Procurement")
        .order("date_updated", { ascending: false });

      if (error) throw error;

      let mergedData = data || [];
      if (mergedData.length > 0) {
        const spfNumbers = mergedData.map((r) => r.spf_number).filter(Boolean);
        const { data: requestData, error: requestError } = await supabase
          .from("spf_request")
          .select("spf_number, customer_name, date_created")
          .in("spf_number", spfNumbers);

        if (!requestError && requestData) {
          const requestMap = new Map(
            requestData.map((r) => [r.spf_number, { customer_name: r.customer_name, date_created: r.date_created }])
          );
          mergedData = mergedData.map((r) => {
            const req = requestMap.get(r.spf_number);
            return {
              ...r,
              customer_name: req?.customer_name || "-",
              request_date_created: req?.date_created || r.date_created,
            };
          });
        }
      }

      setRecords(mergedData);

      // Fetch user names for all unique ReferenceIDs
      if (mergedData.length > 0) {
        const referenceIds = mergedData
          .map((r) => r.item_added_author || r.tsm)
          .filter(Boolean);
        await fetchUserNames(referenceIds);
      }
    } catch (err: any) {
      setFetchError(err.message || "Failed to fetch SPF creation records");
    } finally {
      setLoadingPage(false);
    }
  }, [fetchUserNames]);

  useEffect(() => {
    fetchRecords();

    const channel = supabase
      .channel("spf-creation-analytics")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "spf_creation" },
        () => {
          fetchRecords();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRecords]);

  /* ─────────────────────── */
  /* Summary stats           */
  /* ─────────────────────── */
  const stats = useMemo(() => {
    const total = records.length;

    const statusCounts: Record<string, number> = {};
    records.forEach((r) => {
      const s = (r.status || "unknown").toLowerCase();
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const withDuration = records.filter(
      (r) => r.spf_creation_start_time && r.spf_creation_end_time,
    );
    let avgDurationMs = 0;
    if (withDuration.length) {
      const totalMs = withDuration.reduce((acc, r) => {
        const s = new Date(r.spf_creation_start_time!).getTime();
        const e = new Date(r.spf_creation_end_time!).getTime();
        return acc + Math.max(0, e - s);
      }, 0);
      avgDurationMs = totalMs / withDuration.length;
    }
    const avgMins = Math.floor(avgDurationMs / 60000);
    const avgSecs = Math.floor((avgDurationMs % 60000) / 1000);
    const avgDurationStr =
      withDuration.length === 0
        ? "-"
        : avgMins === 0
        ? `${avgSecs}s`
        : `${avgMins}m ${avgSecs}s`;

    // Calculate total SRP across all records
    const totalSrp = records.reduce((acc, r) => {
      const srp = computeTotalSrp(r);
      return acc + (srp ?? 0);
    }, 0);

    return { total, statusCounts, avgDurationStr, withDuration: withDuration.length, totalSrp };
  }, [records]);

  /* ─────────────────────── */
  /* Filtered + paginated    */
  /* ─────────────────────── */
  const filteredRecords = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    let filtered = records.filter(
      (r) =>
        !term ||
        (r.spf_number || "").toLowerCase().includes(term) ||
        (r.customer_name || "").toLowerCase().includes(term) ||
        (r.supplier_brand || "").toLowerCase().includes(term) ||
        (r.item_code || "").toLowerCase().includes(term),
    );

    if (statusFilter) {
      filtered = filtered.filter(
        (r) =>
          (r.status || "").toLowerCase() === statusFilter.toLowerCase(),
      );
    }

    filtered = [...filtered].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "alphabetical") {
        comparison = (a.spf_number || "").localeCompare(b.spf_number || "");
      } else if (sortBy === "date_created") {
        const dA = a.request_date_created ? new Date(a.request_date_created).getTime() : 0;
        const dB = b.request_date_created ? new Date(b.request_date_created).getTime() : 0;
        comparison = dA - dB;
      } else {
        const dA = a.date_updated
          ? new Date(a.date_updated).getTime()
          : a.date_created
          ? new Date(a.date_created).getTime()
          : 0;
        const dB = b.date_updated
          ? new Date(b.date_updated).getTime()
          : b.date_created
          ? new Date(b.date_created).getTime()
          : 0;
        comparison = dA - dB;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [records, searchTerm, statusFilter, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / PAGE_SIZE));

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  /* ─────────────────────── */
  /* Unique statuses         */
  /* ─────────────────────── */
  const uniqueStatuses = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r) => {
      if (r.status) set.add(r.status);
    });
    return Array.from(set).sort();
  }, [records]);

  /* ─────────────────────── */
  /* Helpers                 */
  /* ─────────────────────── */
  const fmt = (iso?: string) => {
    if (!iso) return "-";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "-";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter(null);
    setSortBy("date_updated");
    setSortOrder("desc");
  };

  const srpFmt = useMemo(
    () =>
      new Intl.NumberFormat("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [],
  );

  const formatTextCell = (raw: string): string => {
    const t = raw.trim();
    return t ? t : "-";
  };

  const formatNumberCell = (raw: string): string => {
    const n = parseLooseNumber(raw);
    return n === null ? "-" : srpFmt.format(n);
  };

  const formatPesoCell = (raw: string): string => {
    const n = parseLooseNumber(raw);
    return n === null ? "-" : `₱ ${srpFmt.format(n)}`;
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchRecords();
    setIsRefreshing(false);
  };

  const handleDownloadExcel = () => {
    const exportData = filteredRecords.map((rec) => {
      const totalSrp = computeTotalSrp(rec);
      const qtyDisplay = formatPairedByItemCode(
        rec.product_offer_qty,
        rec.item_code,
        formatTextCell,
      );
      const sellingCostDisplay = formatPairedByItemCode(
        rec.final_selling_cost,
        rec.item_code,
        formatPesoCell,
      );
      const duration = formatDuration(
        rec.spf_creation_start_time,
        rec.spf_creation_end_time,
      );
      const refId = rec.item_added_author || rec.tsm;
      const user = userMap[refId || ""];
      const authorName = user && user.Firstname && user.Lastname
        ? `${user.Firstname} ${user.Lastname}`
        : refId || "-";

      return {
        "SPF Number": rec.spf_number || "-",
        "Customer Name": rec.customer_name || "-",
        "Author": authorName,
        "Date Created": fmt(rec.request_date_created),
        "Date Updated": fmt(rec.date_updated),
        "Duration": duration,
        "Product Offer Qty": qtyDisplay.join("; "),
        "Final Selling Cost": sellingCostDisplay.join("; "),
        "Total SRP": totalSrp === null ? "-" : `₱ ${srpFmt.format(totalSrp)}`,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SPF Analytics");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "SPF_Creation_Analytics.xlsx");
  };

  /* ─────────────────────── */
  /* Auth guard              */
  /* ─────────────────────── */
  useEffect(() => {
    if (userId === null) return;
    if (!userId) window.location.href = "/login";
  }, [userId]);

  /* ════════════════════════════════════════════════════════════ */
  /* RENDER                                                       */
  /* ════════════════════════════════════════════════════════════ */
  return (
    <AccessGuard accessKey="page:analytics">
      <div className="h-dvh flex flex-col overflow-hidden">

        {/* ── DESKTOP HEADER ── */}
        <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
          <SidebarTrigger />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-red-600" />
              <h1 className="text-2xl font-semibold shrink-0">SPF Creation Analytics</h1>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search SPF, customer, brand..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 w-72 rounded-md border pl-9 pr-3 text-sm bg-white/70"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredRecords.length} results
              </span>
              {(searchTerm !== "" || statusFilter !== null) && (
                <Button variant="ghost" onClick={clearFilters} className="text-xs h-8 px-2">
                  Clear Filters
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDownloadExcel} className="text-xs h-8 px-3 gap-2">
                <Download className="h-4 w-4" />
                Download Excel
              </Button>
            </div>
          </div>

          {/* Status filter row */}
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
            {uniqueStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
                className="text-xs"
              >
                {s}
              </Button>
            ))}
            <div className="w-px h-6 bg-gray-300 mx-2" />
            <span className="text-xs text-gray-500 font-medium">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "date_updated" | "date_created" | "alphabetical",
                )
              }
              className="h-8 px-2 rounded-md border text-sm bg-white/70"
            >
              <option value="date_updated">Date Updated</option>
              <option value="date_created">Date Created</option>
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
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-red-600" />
              <h1 className="text-lg font-bold text-gray-900">SPF Analytics</h1>
            </div>
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
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 font-medium shrink-0">Status:</span>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
              <Button
                size="sm"
                variant={statusFilter === null ? "default" : "outline"}
                onClick={() => setStatusFilter(null)}
                className="text-xs h-8 px-3 shrink-0 whitespace-nowrap"
              >
                All
              </Button>
              {uniqueStatuses.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  onClick={() => setStatusFilter(s)}
                  className="text-xs h-8 px-3 shrink-0 whitespace-nowrap"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "date_updated" | "date_created" | "alphabetical")
              }
              className="h-7 px-2 rounded-md border text-xs bg-white/70"
            >
              <option value="date_updated">Date Updated</option>
              <option value="date_created">Date Created</option>
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
          <div className="flex items-center justify-between mt-1">
            <button
              onClick={() => setShowMobileSummary((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 font-medium"
            >
              {filteredRecords.length} result{filteredRecords.length !== 1 ? "s" : ""}
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${
                  showMobileSummary ? "rotate-180" : ""
                }`}
              />
            </button>
            {(searchTerm !== "" || statusFilter !== null) && (
              <Button variant="ghost" onClick={clearFilters} className="text-xs h-7 px-2">
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* ── DESKTOP PAGINATION BAR ── */}
        <div className="hidden md:flex items-center justify-between px-6 py-2 bg-white/70 backdrop-blur-md border-b shrink-0">
          <span className="text-sm text-gray-500">
            Page {currentPage} of {totalPages} · {filteredRecords.length} records
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={isRefreshing} onClick={handleRefresh}>
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={currentPage === totalPages || totalPages === 0}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>

        {/* ── SUMMARY CARDS (desktop only, scrollable section) ── */}
        <div className={`hidden md:grid grid-cols-3 gap-3 px-6 py-3 shrink-0 bg-white/60 border-b ${
          isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
        }`}>
          <SummaryCard
            icon={<FileText className="h-4 w-4" />}
            label="Total Records"
            value={stats.total}
            sub={`${filteredRecords.length} shown`}
          />
          <SummaryCard
            icon={<DollarSign className="h-4 w-4" />}
            label="Total SRP"
            value={`₱ ${srpFmt.format(stats.totalSrp)}`}
            sub="Sum of all records"
          />
          <SummaryCard
            icon={<Clock className="h-4 w-4" />}
            label="Avg Creation Time"
            value={stats.avgDurationStr}
            sub={`${stats.withDuration} timed records`}
          />
        </div>

        {/* ── DESKTOP TABLE ── */}
        <div
          className={`hidden md:block flex-1 min-h-0 overflow-auto bg-white/60 backdrop-blur-sm ${
            isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
          }`}
        >
          <table className="w-full text-sm border-collapse">
            <thead className="bg-red-50/80 backdrop-blur-sm sticky top-0 z-30">
              <tr>
                {[
                  "SPF Number",
                  "Customer Name",
                  "Author",
                  "Date Created",
                  "Date Updated",
                  "Duration",
                  "Product Offer Qty",
                  "Final Selling Cost",
                  "TOTAL SRP",
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-left font-bold border-b whitespace-nowrap ${
                      i === 0 ? "sticky left-0 bg-red-50/80 backdrop-blur-sm z-20" : ""
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isRefreshing || loadingPage ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-muted-foreground">
                    No SPF creation records found.
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((rec) => {
                  const duration = formatDuration(
                    rec.spf_creation_start_time,
                    rec.spf_creation_end_time,
                  );
                  const totalSrp = computeTotalSrp(rec);
                  const qtyDisplay = formatPairedByItemCode(
                    rec.product_offer_qty,
                    rec.item_code,
                    formatTextCell,
                  );
                  const sellingCostDisplay = formatPairedByItemCode(
                    rec.final_selling_cost,
                    rec.item_code,
                    formatPesoCell,
                  );

                  return (
                    <tr
                      key={rec.id}
                      className="border-b hover:bg-white/60 align-middle"
                    >
                      <td className="px-4 py-3 font-medium uppercase sticky left-0 bg-white/60 backdrop-blur-sm z-20">
                        {rec.spf_number || "-"}
                      </td>
                      <td className="px-4 py-3 uppercase">{rec.customer_name || "-"}</td>
                      <td className="px-4 py-3 text-xs">
                        {(() => {
                          const refId = rec.item_added_author || rec.tsm;
                          if (!refId) return "-";
                          const user = userMap[refId];
                          if (user && user.Firstname && user.Lastname) {
                            return `${user.Firstname} ${user.Lastname}`;
                          }
                          return refId;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {fmt(rec.request_date_created)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {fmt(rec.date_updated)}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {duration}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {qtyDisplay.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {qtyDisplay.map((item, idx) => (
                              <div key={idx} className="whitespace-nowrap">
                                {idx + 1}. {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {sellingCostDisplay.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {sellingCostDisplay.map((item, idx) => (
                              <div key={idx} className="whitespace-nowrap">
                                {idx + 1}. {item}
                              </div>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-semibold whitespace-nowrap">
                        {totalSrp === null ? "-" : `₱ ${srpFmt.format(totalSrp)}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── MOBILE SUMMARY CARDS ── */}
        {showMobileSummary && (
          <div className="md:hidden shrink-0 grid grid-cols-2 gap-2 px-3 py-3 bg-white/60 border-b">
            <SummaryCard
              icon={<FileText className="h-4 w-4" />}
              label="Total"
              value={stats.total}
              valueClassName="text-lg"
            />
            <SummaryCard
              icon={<Clock className="h-4 w-4" />}
              label="Avg Time"
              value={stats.avgDurationStr}
              valueClassName="text-lg"
            />
            <div className="col-span-2">
              <SummaryCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Total SRP"
                value={`₱ ${srpFmt.format(stats.totalSrp)}`}
                valueClassName="text-xl"
              />
            </div>
          </div>
        )}

        {/* ── MOBILE CARD LIST ── */}
        <div className="md:hidden flex-1 overflow-y-auto px-3 pt-3 pb-28 space-y-3 min-h-0">
          {isRefreshing || loadingPage ? (
            <div className="flex justify-center py-16">
              <div className="h-7 w-7 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-14 w-14 rounded-full bg-white/60 flex items-center justify-center mb-3">
                <Search className="h-6 w-6 text-gray-300" />
              </div>
              <p className="text-sm font-medium text-gray-600">No records found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your search</p>
            </div>
          ) : (
            paginatedRecords.map((rec) => {
              const duration = formatDuration(
                rec.spf_creation_start_time,
                rec.spf_creation_end_time,
              );
              const qtyDisplay = formatPairedByItemCode(
                rec.product_offer_qty,
                rec.item_code,
                formatTextCell,
              );
              const sellingCostDisplay = formatPairedByItemCode(
                rec.final_selling_cost,
                rec.item_code,
                formatPesoCell,
              );

              return (
                <div
                  key={rec.id}
                  className="border rounded-2xl bg-white/80 backdrop-blur-sm shadow-sm p-4 space-y-2 border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-sm uppercase">
                      {rec.spf_number || "-"}
                    </p>
                    <span className="text-[10px] text-muted-foreground">
                      {fmt(rec.date_updated)}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-red-600 uppercase">
                    {rec.customer_name || "-"}
                  </p>
                  <div className="text-xs text-gray-600 space-y-1 uppercase">
                    <p>
                      <span className="text-gray-400">Duration:</span>{" "}
                      <span className="font-mono text-red-600 font-bold">{duration}</span>
                    </p>
                    <p>
                      <span className="text-gray-400">Date Created:</span>{" "}
                      {fmt(rec.request_date_created)}
                    </p>
                    <p>
                      <span className="text-gray-400">Offer Qty:</span>{" "}
                      <div className="font-mono mt-1 space-y-1">
                        {qtyDisplay.length > 0 ? (
                          qtyDisplay.map((item, idx) => (
                            <div key={idx}>
                              {idx + 1}. {item}
                            </div>
                          ))
                        ) : (
                          "-"
                        )}
                      </div>
                    </p>
                    <p>
                      <span className="text-gray-400">Selling Cost:</span>{" "}
                      <div className="font-mono mt-1 space-y-1">
                        {sellingCostDisplay.length > 0 ? (
                          sellingCostDisplay.map((item, idx) => (
                            <div key={idx}>
                              {idx + 1}. {item}
                            </div>
                          ))
                        ) : (
                          "-"
                        )}
                      </div>
                    </p>
                    <p>
                      <span className="text-gray-400">Author:</span>{" "}
                      {(() => {
                        const refId = rec.item_added_author || rec.tsm;
                        if (!refId) return "-";
                        const user = userMap[refId];
                        if (user && user.Firstname && user.Lastname) {
                          return `${user.Firstname} ${user.Lastname}`;
                        }
                        return refId;
                      })()}
                    </p>
                  </div>
                  {rec.revision_remarks && (
                    <div className="mt-1 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                      <p className="text-[10px] font-semibold text-orange-700 uppercase mb-0.5">
                        Revision Remarks
                      </p>
                      <p className="text-xs text-orange-800">{rec.revision_remarks}</p>
                    </div>
                  )}
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
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
            <span className="text-sm font-medium text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
              className="h-8 w-8 rounded-lg border flex items-center justify-center disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </AccessGuard>
  );
}
