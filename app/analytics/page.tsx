"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AccessGuard } from "@/components/AccessGuard";
import { supabase } from "@/utils/supabase";
import {
  Search,
  RefreshCw,
  Clock,
  FileText,
  DollarSign,
  Download,
  X,
  Loader2,
  ArrowUp,
  Trophy,
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
const PAGE_SIZE = 30; // rows revealed per scroll chunk

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
/* SUMMARY CARD (matches KpiCard styling)                          */
/* ─────────────────────────────────────────────────────────────── */
type SummaryCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent: string;
  loading?: boolean;
  cardClass: string;
  className?: string;
  big?: boolean;
};

const SummaryCard = ({ label, value, hint, icon, accent, loading, cardClass, className = "", big }: SummaryCardProps) => (
  <div className={`bg-white p-4 flex flex-col justify-between gap-3 ${cardClass} ${className}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-gray-600 font-medium">{label}</span>
      <span className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent}`}>{icon}</span>
    </div>
    <div>
      {loading ? (
        <div className="h-8 w-32 rounded bg-gray-200 animate-pulse" />
      ) : (
        <div
          className={`font-bold text-gray-900 tabular-nums leading-none truncate ${
            big ? "text-3xl md:text-4xl" : "text-2xl"
          }`}
          title={value}
        >
          {value}
        </div>
      )}
      {hint && <div className="mt-1.5 text-xs text-gray-500 truncate">{hint}</div>}
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────── */
/* MAIN PAGE                                                       */
/* ─────────────────────────────────────────────────────────────── */
export default function AnalyticsPage() {
  const { userId } = useUser();
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isComic = theme === "comic";
  const isEngineer = theme === "engineer";
  const isBold = isComic || isEngineer;

  /* ── State ── */
  const [records, setRecords] = useState<SPFCreation[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);

  const [userMap, setUserMap] = useState<Record<string, { Firstname: string; Lastname: string }>>({});

  /* ── Search / infinite scroll ── */
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

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
  /* Filtered + visible      */
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

  const hasMore = visibleCount < filteredRecords.length;

  const visibleRecords = useMemo(
    () => filteredRecords.slice(0, visibleCount),
    [filteredRecords, visibleCount],
  );

  // filters / sort changed -> start from the top again
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    scrollRef.current?.scrollTo({ top: 0 });
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  // infinite scroll: reveal the next chunk when the footer nears the viewport
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) setVisibleCount((c) => c + PAGE_SIZE);
      },
      { root, rootMargin: "400px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, visibleCount]);

  // Top authors by SRP (follows the active filters)
  const pesoCompact = (n: number) =>
    `₱${new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 2 }).format(n)}`;

  const topAuthors = useMemo(() => {
    const byAuthor = new Map<string, { value: number; count: number }>();
    filteredRecords.forEach((r) => {
      const refId = r.item_added_author || r.tsm || "";
      const u = userMap[refId];
      const name = (
        u && u.Firstname && u.Lastname ? `${u.Firstname} ${u.Lastname}` : refId || "Unassigned"
      )
        .trim()
        .toUpperCase();
      const cur = byAuthor.get(name) || { value: 0, count: 0 };
      cur.value += computeTotalSrp(r) ?? 0;
      cur.count += 1;
      byAuthor.set(name, cur);
    });
    return [...byAuthor.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [filteredRecords, userMap]);
  const maxAuthorValue = topAuthors[0]?.value || 1;

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

  const authorLabel = (rec: SPFCreation) => {
    const refId = rec.item_added_author || rec.tsm;
    if (!refId) return "-";
    const user = userMap[refId];
    if (user && user.Firstname && user.Lastname) {
      return `${user.Firstname} ${user.Lastname}`;
    }
    return refId;
  };

  /* ── theme-aware styles ── */
  const cardClass = isBold
    ? "rounded-lg border-2 border-gray-800 shadow-[4px_4px_0_0_#1f2937]"
    : "rounded-xl border border-gray-200 shadow-sm";

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

      return {
        "SPF Number": rec.spf_number || "-",
        "Customer Name": rec.customer_name || "-",
        "Author": authorLabel(rec),
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
  const hasAnyFilter = Boolean(searchTerm || statusFilter);

  const searchBar = (
    <div className="relative w-full md:w-80">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="Search SPF, customer, or brand..."
        className="pl-8 pr-8 h-9"
      />
      {searchTerm && (
        <button
          type="button"
          onClick={() => setSearchTerm("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <AccessGuard accessKey="page:analytics">
      <div className="h-dvh flex flex-col overflow-hidden">

        {/* ── DESKTOP HEADER ── */}
        <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
          <SidebarTrigger />
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold shrink-0">SPF Creation Analytics</h1>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {searchBar}
              <Button size="sm" variant="outline" disabled={isRefreshing} onClick={handleRefresh}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" variant="outline" onClick={handleDownloadExcel}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
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
              className="text-xs h-8"
            >
              All
            </Button>
            {uniqueStatuses.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => setStatusFilter(s)}
                className="text-xs h-8"
              >
                {s}
              </Button>
            ))}
            {hasAnyFilter && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearFilters}
                className="text-xs h-8 px-2.5"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
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
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">SPF Analytics</h1>
            <Button size="sm" variant="outline" disabled={isRefreshing} onClick={handleRefresh}>
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {searchBar}
            <div className="flex items-center gap-2 flex-wrap">
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
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">
                {filteredRecords.length} result{filteredRecords.length !== 1 ? "s" : ""}
              </span>
              {hasAnyFilter && (
                <Button variant="ghost" onClick={clearFilters} className="text-xs h-7 px-2">
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── ONE SCROLL AREA: KPIs + list ── */}
        <div
          ref={scrollRef}
          onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 600)}
          className={`relative flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white/60 backdrop-blur-sm ${
            isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
          }`}
        >
          {/* KPI DASHBOARD */}
          <section className="px-3 md:px-6 pt-4 pb-3">
            <div className="grid grid-cols-2 lg:grid-cols-12 gap-3">
              <SummaryCard
                big
                label="Total SRP"
                value={`₱${srpFmt.format(stats.totalSrp)}`}
                hint={`${filteredRecords.length} of ${stats.total} records shown`}
                icon={<DollarSign className="h-5 w-5 text-emerald-700" />}
                accent="bg-emerald-100"
                loading={loadingPage}
                cardClass={cardClass}
                className="col-span-2 lg:col-span-4"
              />
              <SummaryCard
                label="Total Records"
                value={stats.total.toLocaleString("en-PH")}
                hint={`${stats.withDuration} timed records`}
                icon={<FileText className="h-5 w-5 text-purple-700" />}
                accent="bg-purple-100"
                loading={loadingPage}
                cardClass={cardClass}
                className="lg:col-span-2"
              />
              <SummaryCard
                label="Avg Creation Time"
                value={stats.avgDurationStr}
                hint="Average SPF creation duration"
                icon={<Clock className="h-5 w-5 text-sky-700" />}
                accent="bg-sky-100"
                loading={loadingPage}
                cardClass={cardClass}
                className="lg:col-span-2"
              />

              {/* Top authors leaderboard */}
              <div className={`col-span-2 lg:col-span-4 bg-white p-4 ${cardClass}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600 font-medium">Top authors by SRP</span>
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center bg-amber-100">
                    <Trophy className="h-5 w-5 text-amber-700" />
                  </span>
                </div>
                {loadingPage ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-5 rounded bg-gray-200 animate-pulse" />
                    ))}
                  </div>
                ) : topAuthors.length === 0 ? (
                  <div className="text-xs text-gray-400">No data yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {topAuthors.map((a, i) => (
                      <li key={a.name}>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-semibold text-gray-800">
                            {i === 0 ? "🏆 " : ""}
                            {a.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-gray-600">
                            {pesoCompact(a.value)}
                            <span className="text-gray-400"> · {a.count}</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? "bg-amber-500" : "bg-amber-300"}`}
                            style={{ width: `${Math.max(4, (a.value / maxAuthorValue) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          {/* LIST HEADER STRIP */}
          <div className="px-3 md:px-6 py-2 text-sm text-gray-600 flex items-center justify-between">
            <span>
              Showing <b className="text-gray-900 tabular-nums">{visibleRecords.length}</b> of{" "}
              <b className="text-gray-900 tabular-nums">{filteredRecords.length}</b> records
            </span>
          </div>

          {/* ── DESKTOP TABLE ── */}
          <div className="hidden md:block">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-blue-50/95 backdrop-blur-sm sticky top-0 z-30">
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
                        i === 0 ? "sticky left-0 bg-blue-50/95 backdrop-blur-sm z-20" : ""
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
                ) : fetchError && records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-red-500">
                      {fetchError}
                    </td>
                  </tr>
                ) : filteredRecords.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-muted-foreground">
                      No SPF creation records found.
                    </td>
                  </tr>
                ) : (
                  visibleRecords.map((rec) => {
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
                        className="border-b hover:bg-white/60 align-top"
                      >
                        <td className="px-4 py-3 font-medium uppercase sticky left-0 bg-white/60 backdrop-blur-sm z-20">
                          {rec.spf_number || "-"}
                        </td>
                        <td className="px-4 py-3 uppercase">{rec.customer_name || "-"}</td>
                        <td className="px-4 py-3 text-xs">{authorLabel(rec)}</td>
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

          {/* ── MOBILE CARD LIST ── */}
          <div className="md:hidden px-3 pb-6 space-y-3">
            {isRefreshing || loadingPage ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
              </div>
            ) : fetchError && records.length === 0 ? (
              <div className="text-center py-16 text-red-500">{fetchError}</div>
            ) : filteredRecords.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                No SPF creation records found.
              </div>
            ) : (
              visibleRecords.map((rec) => {
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
                  <div key={rec.id} className="bg-white rounded-lg border p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-sm uppercase">{rec.spf_number || "-"}</div>
                        <div className="text-xs text-gray-500 mt-1">{rec.customer_name || "-"}</div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded uppercase font-semibold whitespace-nowrap bg-green-100 text-green-700">
                        {rec.status || "-"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <div className="font-mono font-bold text-red-600">{duration}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Date Created:</span>
                        <div>{fmt(rec.request_date_created)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Date Updated:</span>
                        <div>{fmt(rec.date_updated)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Product Offer Qty:</span>
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
                      </div>
                      <div>
                        <span className="text-gray-500">Final Selling Cost:</span>
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
                      </div>
                      <div>
                        <span className="text-gray-500">Total SRP:</span>
                        <div className="font-bold">
                          {totalSrp === null ? "-" : `₱ ${srpFmt.format(totalSrp)}`}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Author:</span>
                        <div>{authorLabel(rec)}</div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* INFINITE SCROLL FOOTER */}
          <div ref={sentinelRef} className="h-16 flex items-center justify-center text-xs text-gray-500">
            {hasMore ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading more records...
              </span>
            ) : filteredRecords.length > 0 ? (
              <span>You&apos;ve reached the end · {filteredRecords.length} records</span>
            ) : null}
          </div>

          {/* BACK TO TOP */}
          {showTop && (
            <button
              type="button"
              onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
              className="fixed bottom-5 right-5 z-40 h-10 w-10 rounded-full bg-gray-900 text-white shadow-lg flex items-center justify-center hover:bg-gray-700"
              aria-label="Back to top"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </AccessGuard>
  );
}