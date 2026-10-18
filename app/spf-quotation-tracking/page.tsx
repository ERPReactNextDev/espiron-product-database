"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AccessGuard } from "@/components/AccessGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  RefreshCw,
  Search,
  X,
  FileText,
  Banknote,
  Calculator,
  Trophy,
  ArrowUp,
  Loader2,
  ChevronDown,
  Download,
  History,
} from "lucide-react";

type HistoryRecord = {
  id: string;
  quotation_number: string;
  activity_reference_number: string;
  account_reference_number: string;
  product_sku: string;
  quotation_amount: string;
  status: string;
  so_status: string;
  date_created: string;
  date_updated: string;
  sales_agent: string;
  product_quantity: string;
  product_amount: string;
  [key: string]: any;
};

type QuotationGroup = {
  activityRef: string;
  accountRef: string;
  salesAgent: string;
  quotations: HistoryRecord[];
};

type ActivityHistoryRecord = {
  id: string;
  activity_reference_number: string;
  referenceid: string;
  type_activity: string;
  quotation_number: string | null;
  quotation_amount: string | null;
  so_number: string | null;
  so_amount: string | null;
  actual_sales: string | null;
  status: string;
  so_status: string | null;
  date_created: string;
  date_updated: string;
  remarks: string | null;
  company_name: string | null;
  contact_person: string | null;
  contact_number: string | null;
  [key: string]: any;
};

type SkuLine = { sku: string; qty: string | null; price: string | null };

// Everything the API needs to narrow the list. Dates are "YYYY-MM-DD" or "".
type Filters = { q: string; from: string; to: string };

const PAGE_SIZE = 30; // how many rows each "load more" brings in
const KPI_LIMIT = 1000; // how many rows the KPI request asks for

/* ───────────── helpers ───────────── */

const formatPeso = (value: string | number | undefined | null) => {
  const n = typeof value === "number" ? value : parseFloat(value || "");
  if (isNaN(n)) return null;
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPesoCompact = (n: number) =>
  `₱${new Intl.NumberFormat("en-PH", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n)}`;

// "2026-10-09" -> "Oct 9, 2026" (parsed as a plain calendar date, no timezone shift)
const formatFilterDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const describeDateRange = (from: string, to: string) => {
  if (from && to) return from === to ? formatFilterDate(from) : `${formatFilterDate(from)} – ${formatFilterDate(to)}`;
  if (from) return `from ${formatFilterDate(from)}`;
  if (to) return `up to ${formatFilterDate(to)}`;
  return "";
};

const buildParams = (f: Filters, limit: number, offset: number) => {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (f.q) params.set("q", f.q);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  return params;
};

// Pull only the SPF-DSI SKUs out of the comma-separated product_sku string and
// pair each one with the quantity / amount at the same position.
const getSpfDsiSkuLines = (
  sku: string | null | undefined,
  amount: string | null | undefined,
  quantity: string | null | undefined
): SkuLine[] => {
  if (!sku) return [];

  const skuList = sku.split(",").map((s) => s.trim());
  const amountList = (amount || "").split(",").map((a) => a.trim());
  const qtyList = (quantity || "").split(",").map((q) => q.trim());

  const seen = new Set<string>();
  const lines: SkuLine[] = [];

  skuList.forEach((entry, i) => {
    const match = entry.match(/SPF-DSI-[^\s,&()]+/i);
    if (!match) return;
    const code = match[0];
    if (seen.has(code)) return;
    seen.add(code);
    lines.push({
      sku: code,
      qty: qtyList[i] || null,
      price: formatPeso(amountList[i]),
    });
  });

  return lines;
};

const countSpfDsiSkus = (r: HistoryRecord) =>
  getSpfDsiSkuLines(r.product_sku, r.product_amount, r.product_quantity).length;

// Group quotations by activity ref and account ref
const groupQuotations = (records: HistoryRecord[]): QuotationGroup[] => {
  const groupMap = new Map<string, QuotationGroup>();

  records.forEach((record) => {
    const key = `${record.activity_reference_number}|||${record.account_reference_number}`;
    const existing = groupMap.get(key);

    if (existing) {
      existing.quotations.push(record);
    } else {
      groupMap.set(key, {
        activityRef: record.activity_reference_number,
        accountRef: record.account_reference_number,
        salesAgent: record.sales_agent,
        quotations: [record],
      });
    }
  });

  return Array.from(groupMap.values());
};

/* ───────────── small components ───────────── */

const SkuList = ({ lines }: { lines: SkuLine[] }) => {
  const [open, setOpen] = useState(false);

  // Extract first 4 parts of SKU for navigation (e.g., SPF-DSI-26-0438 from SPF-DSI-26-0438-002)
  const getSkuBase = (sku: string) => {
    const parts = sku.split("-");
    return parts.slice(0, 4).join("-");
  };

  const handleSkuClick = (sku: string) => {
    const skuBase = getSkuBase(sku);
    // Store search query in sessionStorage instead of URL parameter
    sessionStorage.setItem("spfSkuSearch", skuBase);
    window.location.href = `/requests`;
  };

  if (lines.length === 0) return <span className="text-gray-400">-</span>;

  return (
  <div className={open ? "md:min-w-[260px]" : "md:min-w-[200px]"}>
    <ul className="divide-y divide-gray-200">
        {lines.map((line) => (
          <li
            key={line.sku}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-1.5 first:pt-0 last:pb-0"
          >
            <button
              type="button"
              onClick={() => handleSkuClick(line.sku)}
              className="font-mono text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline md:whitespace-nowrap cursor-pointer"
              title={`Search for ${getSkuBase(line.sku)} in Requests`}
            >
              {line.sku}
            </button>
            {open && (
              <span className="flex items-center gap-2 shrink-0">
                {line.qty && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 whitespace-nowrap">
                    Qty {line.qty}
                  </span>
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800"
      >
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
        {open ? "Hide qty" : "Show qty"}
      </button>
    </div>
  );
};

type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  accent: string; // tailwind classes for icon chip
  loading?: boolean;
  cardClass: string;
  className?: string;
  big?: boolean;
};

const KpiCard = ({ label, value, hint, icon, accent, loading, cardClass, className = "", big }: KpiCardProps) => (
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

const QuotationDropdown = ({ quotations }: { quotations: HistoryRecord[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<HistoryRecord | null>(quotations[0] || null);

  if (quotations.length === 0) return <span className="text-gray-400">-</span>;
  if (quotations.length === 1) {
    return (
      <span className="font-medium uppercase">{quotations[0].quotation_number || "-"}</span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 font-medium uppercase text-blue-600 hover:text-blue-800"
      >
        {selectedQuotation?.quotation_number || "-"}
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="absolute z-10 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto min-w-[180px]">
          {quotations.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setSelectedQuotation(q);
                setIsOpen(false);
              }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-100 uppercase"
            >
              {q.quotation_number || "-"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/* ───────────── page ───────────── */

export default function SPFQuotationTracking() {
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isComic = theme === "comic";
  const isEngineer = theme === "engineer";
  const isBold = isComic || isEngineer;

  // list (infinite scroll)
  const [quotations, setQuotations] = useState<HistoryRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false); // first page / new search
  const [loadingMore, setLoadingMore] = useState(false); // next chunks
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // SO status filter (hardcoded to "All" and "Convert to SI")
  const [soStatusFilter, setSoStatusFilter] = useState("");
  const [soActivityRefs, setSoActivityRefs] = useState<Set<string> | null>(null);
  const [soLoading, setSoLoading] = useState(false);
  const [soError, setSoError] = useState<string | null>(null);

  // Stable object so effects only re-run when a filter really changes
  const filters = useMemo<Filters>(
    () => ({ q: search, from: dateFrom, to: dateTo }),
    [search, dateFrom, dateTo]
  );
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const hasAnyFilter = Boolean(search || hasDateFilter || soStatusFilter);
  const dateRangeLabel = describeDateRange(dateFrom, dateTo);

  // KPI data (separate request so numbers cover more than the loaded rows)
  const [kpiRecords, setKpiRecords] = useState<HistoryRecord[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);

  // scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const offsetRef = useRef(0); // how many rows the server has actually given us
  const [endReached, setEndReached] = useState(false); // stop auto-loading when true
  const [showTop, setShowTop] = useState(false);

  // history dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedActivityRef, setSelectedActivityRef] = useState<string | null>(null);
  const [activityHistory, setActivityHistory] = useState<ActivityHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const hasMore = !endReached && quotations.length < totalCount;

  /* fetch a chunk. reset=true starts from the top (filter change / refresh) */
  const fetchChunk = useCallback(async (f: Filters, _offset: number, reset: boolean) => {
    const requestId = reset ? ++requestIdRef.current : requestIdRef.current;
    try {
      setError(null);
      if (reset) {
        offsetRef.current = 0;
        setEndReached(false);
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const res = await fetch(
        `/api/spf-dsi-quotations?${buildParams(f, PAGE_SIZE, offsetRef.current).toString()}`
      );
      if (!res.ok) throw new Error("Failed to fetch quotations");
      const data = await res.json();

      if (requestId !== requestIdRef.current) return; // stale
      const incoming: HistoryRecord[] = data.quotations || [];
      const total: number = data.total || 0;

      offsetRef.current += incoming.length;

      setQuotations((prev) => {
        if (reset) return incoming;
        const ids = new Set(prev.map((r) => r.id));
        return [...prev, ...incoming.filter((r) => !ids.has(r.id))];
      });
      setTotalCount(total);

      // nothing more to fetch -> stop the loop
      if (incoming.length === 0 || offsetRef.current >= total) {
        setEndReached(true);
      }
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      setError(err.message || "Failed to fetch quotations");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  const fetchKpis = useCallback(async (f: Filters) => {
    try {
      setKpiLoading(true);
      const res = await fetch(`/api/spf-dsi-quotations?${buildParams(f, KPI_LIMIT, 0).toString()}`);
      if (!res.ok) throw new Error("kpi fetch failed");
      const data = await res.json();
      setKpiRecords(data.quotations || []);
    } catch {
      setKpiRecords([]);
    } finally {
      setKpiLoading(false);
    }
  }, []);

  // debounce typing
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // when an SO status is picked, fetch the activity refs that have it in their history
  useEffect(() => {
    if (!soStatusFilter) {
      setSoActivityRefs(null);
      setSoError(null);
      setSoLoading(false);
      return;
    }

    let cancelled = false;
    setSoLoading(true);
    setSoError(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/activity-history/so-status?so_status=${encodeURIComponent(soStatusFilter)}`
        );
        if (!res.ok) throw new Error("Failed to apply SO status filter");
        const data = await res.json();
        if (!cancelled) setSoActivityRefs(new Set<string>(data.activityRefs || []));
      } catch (err: any) {
        if (!cancelled) {
          setSoActivityRefs(new Set());
          setSoError(err.message || "Failed to apply SO status filter");
        }
      } finally {
        if (!cancelled) setSoLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [soStatusFilter]);

  // any filter change -> reset list + KPIs, jump back to top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    fetchChunk(filters, 0, true);
    fetchKpis(filters);
  }, [filters, fetchChunk, fetchKpis]);

  // jump to top when SO status filter changes too
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [soStatusFilter]);

  // infinite scroll: load the next chunk when the sentinel nears the viewport
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore && !error) {
          fetchChunk(filters, quotations.length, false);
        }
      },
      { root, rootMargin: "400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, error, quotations.length, filters, fetchChunk]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchChunk(filters, 0, true), fetchKpis(filters)]);
    setIsRefreshing(false);
  };

  const handleDownload = async () => {
    try {
      const params = new URLSearchParams();
      if (filters.q) params.set("q", filters.q);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await fetch(`/api/spf-dsi-quotations/download?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to download data");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `spf-quotations-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error("Download error:", err);
      alert("Failed to download data. Please try again.");
    }
  };

  const clearDates = () => {
    setDateFrom("");
    setDateTo("");
  };

  const handleViewHistory = async (activityRef: string) => {
    setSelectedActivityRef(activityRef);
    setHistoryDialogOpen(true);
    setHistoryLoading(true);
    setHistoryError(null);
    setActivityHistory([]);

    try {
      const res = await fetch(`/api/activity-history?activityRef=${encodeURIComponent(activityRef)}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setActivityHistory(data.history || []);
    } catch (err: any) {
      setHistoryError(err.message || "Failed to fetch history");
    } finally {
      setHistoryLoading(false);
    }
  };

  /* ── apply SO status filter to what's on screen ── */
  const filteredQuotations = useMemo(() => {
    if (!soStatusFilter || !soActivityRefs) return quotations;
    return quotations.filter((r) => soActivityRefs.has(r.activity_reference_number));
  }, [quotations, soStatusFilter, soActivityRefs]);

  const filteredKpiRecords = useMemo(() => {
    if (!soStatusFilter || !soActivityRefs) return kpiRecords;
    return kpiRecords.filter((r) => soActivityRefs.has(r.activity_reference_number));
  }, [kpiRecords, soStatusFilter, soActivityRefs]);

  // while the SO filter is still loading, don't flash unfiltered data
  const soPending = Boolean(soStatusFilter) && (soLoading || soActivityRefs === null);

  /* ── KPI math ── */
  const kpis = useMemo(() => {
    const amountOf = (r: HistoryRecord) => {
      const n = parseFloat(r.quotation_amount || "");
      return isNaN(n) ? 0 : n;
    };

    const totalValue = filteredKpiRecords.reduce((s, r) => s + amountOf(r), 0);
    const count = filteredKpiRecords.length;
    const avg = count ? totalValue / count : 0;
    const skuCount = filteredKpiRecords.reduce((s, r) => s + countSpfDsiSkus(r), 0);

    const byAgent = new Map<string, { value: number; count: number }>();
    filteredKpiRecords.forEach((r) => {
      const name = (r.sales_agent || "Unassigned").trim().toUpperCase();
      const cur = byAgent.get(name) || { value: 0, count: 0 };
      cur.value += amountOf(r);
      cur.count += 1;
      byAgent.set(name, cur);
    });
    const agents = [...byAgent.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.value - a.value);

    return { totalValue, count, avg, skuCount, agents };
  }, [filteredKpiRecords]);

  // Group the loaded (and filtered) quotations for display
  const displayGroups = useMemo(() => {
    return groupQuotations(filteredQuotations);
  }, [filteredQuotations]);

  const topAgents = kpis.agents.slice(0, 5);
  const maxAgentValue = topAgents[0]?.value || 1;

  /* ── theme-aware styles ── */
  const cardClass = isBold
    ? "rounded-lg border-2 border-gray-800 shadow-[4px_4px_0_0_#1f2937]"
    : "rounded-xl border border-gray-200 shadow-sm";

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date(dateString));
  };

  const emptyMessage = hasAnyFilter
    ? `No quotations match${search ? ` "${search}"` : " these filters"}${
        hasDateFilter ? ` for ${dateRangeLabel}` : ""
      }${soStatusFilter ? ` with SO status "${soStatusFilter}"` : ""}.`
    : "No SPF-DSI quotations found.";

  const searchBar = (
    <div className="relative w-full md:w-80">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search activity ref #, account ref #, SKU, SO status, or agent..."
        className="pl-8 pr-8 h-9"
      />
      {searchInput && (
        <button
          type="button"
          onClick={() => setSearchInput("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Clear search"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  // SO Status filter (hardcoded to "All" and "Convert to SI")
  const soStatusFilterEl = (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <label htmlFor="spf-so-status" className="sr-only">
        Filter by SO status
      </label>
      <select
        id="spf-so-status"
        value={soStatusFilter}
        onChange={(e) => setSoStatusFilter(e.target.value)}
        className="h-9 w-full md:w-48 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">All SO Status</option>
        <option value="Convert to SI">Convert to SI</option>
      </select>
      {soStatusFilter && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSoStatusFilter("")}
          className="h-9 shrink-0 px-2.5"
          aria-label="Clear SO status filter"
          title="Clear SO status"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  // Date range filter: filters on Date Created, inclusive of both days
  const dateFilter = (
    <div className="flex items-center gap-2 w-full md:w-auto">
      <div className="flex items-center gap-1.5 flex-1 md:flex-none">
        <label htmlFor="spf-date-from" className="sr-only">
          Date created from
        </label>
        <Input
          id="spf-date-from"
          type="date"
          value={dateFrom}
          max={dateTo || undefined}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 w-full md:w-[9.5rem] text-sm"
        />
        <span className="text-xs text-gray-500">to</span>
        <label htmlFor="spf-date-to" className="sr-only">
          Date created to
        </label>
        <Input
          id="spf-date-to"
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 w-full md:w-[9.5rem] text-sm"
        />
      </div>
      {hasDateFilter && (
        <Button
          size="sm"
          variant="outline"
          onClick={clearDates}
          className="h-9 shrink-0 px-2.5"
          aria-label="Clear date filter"
          title="Clear dates"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );

  const kpiPartial = kpiRecords.length >= KPI_LIMIT && totalCount > KPI_LIMIT;

  const kpiHint = (() => {
    if (!hasAnyFilter) return "All SPF-DSI quotations";
    const parts: string[] = [];
    if (search) parts.push(`Matching "${search}"`);
    if (hasDateFilter) parts.push(`Created ${dateRangeLabel}`);
    if (soStatusFilter) parts.push(`SO: ${soStatusFilter}`);
    return parts.join(" · ");
  })();

  const showLoading = loading || soPending;
  const kpiIsLoading = kpiLoading || soPending;

  return (
    <AccessGuard accessKey="page:requests">
      <div className="h-dvh flex flex-col overflow-hidden">
        {/* ── DESKTOP HEADER ── */}
        <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
          <SidebarTrigger />
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold shrink-0">SPF Quotation Tracking</h1>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {searchBar}
              {soStatusFilterEl}
              {dateFilter}
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download
              </Button>
              <Button size="sm" variant="outline" disabled={isRefreshing} onClick={handleRefresh}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* ── MOBILE HEADER ── */}
        <div className="md:hidden shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 pt-5 pb-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">SPF Quotation Tracking</h1>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" disabled={isRefreshing} onClick={handleRefresh}>
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {searchBar}
            {soStatusFilterEl}
            {dateFilter}
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
              <KpiCard
                big
                label="Total quoted value"
                value={formatPeso(kpis.totalValue) || "₱0.00"}
                hint={kpiHint}
                icon={<Banknote className="h-5 w-5 text-emerald-700" />}
                accent="bg-emerald-100"
                loading={kpiIsLoading}
                cardClass={cardClass}
                className="col-span-2 lg:col-span-4"
              />
              <KpiCard
                label="Quotations"
                value={kpis.count.toLocaleString("en-PH")}
                hint={`${kpis.skuCount.toLocaleString("en-PH")} SKU lines`}
                icon={<FileText className="h-5 w-5 text-purple-700" />}
                accent="bg-purple-100"
                loading={kpiIsLoading}
                cardClass={cardClass}
                className="lg:col-span-2"
              />
              <KpiCard
                label="Average quotation"
                value={formatPesoCompact(kpis.avg)}
                hint={formatPeso(kpis.avg) || undefined}
                icon={<Calculator className="h-5 w-5 text-sky-700" />}
                accent="bg-sky-100"
                loading={kpiIsLoading}
                cardClass={cardClass}
                className="lg:col-span-2"
              />

              {/* Top agents leaderboard */}
              <div className={`col-span-2 lg:col-span-4 bg-white p-4 ${cardClass}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600 font-medium">Top agents by value</span>
                  <span className="h-9 w-9 rounded-lg flex items-center justify-center bg-amber-100">
                    <Trophy className="h-5 w-5 text-amber-700" />
                  </span>
                </div>
                {kpiIsLoading ? (
                  <div className="space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-5 rounded bg-gray-200 animate-pulse" />
                    ))}
                  </div>
                ) : topAgents.length === 0 ? (
                  <div className="text-xs text-gray-400">No data yet.</div>
                ) : (
                  <ul className="space-y-2">
                    {topAgents.map((a, i) => (
                      <li key={a.name}>
                        <div className="flex items-baseline justify-between gap-2 text-xs">
                          <span className="truncate font-semibold text-gray-800">
                            {i === 0 ? "🏆 " : ""}
                            {a.name}
                          </span>
                          <span className="shrink-0 tabular-nums text-gray-600">
                            {formatPesoCompact(a.value)}
                            <span className="text-gray-400"> · {a.count}</span>
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${i === 0 ? "bg-amber-500" : "bg-amber-300"}`}
                            style={{ width: `${Math.max(4, (a.value / maxAgentValue) * 100)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            {kpiPartial && (
              <p className="mt-2 text-xs text-gray-500">
                KPIs cover the latest {KPI_LIMIT.toLocaleString("en-PH")} of {totalCount.toLocaleString("en-PH")}{" "}
                quotations.
              </p>
            )}
            {soError && <p className="mt-2 text-xs text-red-500">{soError}</p>}
          </section>

          {/* LIST HEADER STRIP (replaces the pagination bar) */}
          <div className="px-3 md:px-6 py-2 text-sm text-gray-600 flex items-center justify-between">
            <span>
              Showing <b className="text-gray-900 tabular-nums">{displayGroups.length}</b> groups of{" "}
              <b className="text-gray-900 tabular-nums">{filteredQuotations.length}</b> quotations
              {hasDateFilter && <span className="text-gray-500"> · created {dateRangeLabel}</span>}
              {soStatusFilter && <span className="text-gray-500"> · SO status: {soStatusFilter}</span>}
            </span>
            {loadingMore && (
              <span className="flex items-center gap-1.5 text-xs text-gray-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more
              </span>
            )}
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-blue-50/95 backdrop-blur-sm sticky top-0 z-30">
                <tr>
                  {["Activity Ref #", "Account Ref #", "Sales Agent", "Quotation #", "Product SKU", "Status", "Date Created", "Date Updated"].map(
                    (h) => (
                      <th key={h} className={`px-4 py-3 text-left font-bold border-b whitespace-nowrap ${(h === "Status" || h === "SO Status") ? "px-2" : ""}`}>
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {showLoading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : error && displayGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : displayGroups.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  displayGroups.map((group) => {
                    const firstQuotation = group.quotations[0];
                    return (
                      <tr key={`${group.activityRef}-${group.accountRef}`} className="border-b hover:bg-white/60 align-top">
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium uppercase">{group.activityRef || "-"}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewHistory(group.activityRef)}
                              className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <History className="h-3 w-3 mr-1" />
                              View History
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium uppercase">{group.accountRef || "-"}</td>
                        <td className="px-4 py-3 uppercase">{group.salesAgent || "-"}</td>
                        <td className="px-4 py-3">
                          <QuotationDropdown quotations={group.quotations} />
                        </td>
                        <td className="px-4 py-3">
                          <SkuList
                            lines={getSpfDsiSkuLines(firstQuotation.product_sku, firstQuotation.product_amount, firstQuotation.product_quantity)}
                          />
                        </td>
                        <td className="px-2 py-3">
                          <span className="text-xs px-1.5 py-1 rounded uppercase font-semibold whitespace-nowrap bg-purple-100 text-purple-700">
                            {firstQuotation.status || "-"}
                          </span>

                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {formatDate(firstQuotation.date_created)}
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {formatDate(firstQuotation.date_updated)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD LIST */}
          <div className="md:hidden px-3 pb-6 space-y-3">
            {showLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
              </div>
            ) : error && displayGroups.length === 0 ? (
              <div className="text-center py-16 text-red-500">{error}</div>
            ) : displayGroups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">{emptyMessage}</div>
            ) : (
              displayGroups.map((group) => {
                const firstQuotation = group.quotations[0];
                return (
                  <div key={`${group.activityRef}-${group.accountRef}`} className="bg-white rounded-lg border p-4 shadow-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-sm uppercase">{group.activityRef || "-"}</div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewHistory(group.activityRef)}
                          className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 mt-1"
                        >
                          <History className="h-3 w-3 mr-1" />
                          View History
                        </Button>
                        <div className="text-xs text-gray-500 mt-1">{group.accountRef || "-"}</div>
                        <div className="text-xs text-gray-500 mt-1">{group.salesAgent || "-"}</div>
                      </div>
                      <div className="flex gap-1">
                        <span className="text-xs px-2 py-1 rounded uppercase font-semibold whitespace-nowrap bg-purple-100 text-purple-700">
                          {firstQuotation.status || "-"}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Quotation #:</span>
                        <div className="mt-1">
                          <QuotationDropdown quotations={group.quotations} />
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-500">Product SKU:</span>
                        <div className="mt-1">
                          <SkuList
                            lines={getSpfDsiSkuLines(firstQuotation.product_sku, firstQuotation.product_amount, firstQuotation.product_quantity)}
                          />
                        </div>
                      </div>
                      <div className="text-gray-400 text-xs">
                        Created {formatDate(firstQuotation.date_created)}
                      </div>
                      <div className="text-gray-400 text-xs">
                        Updated {formatDate(firstQuotation.date_updated)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* INFINITE SCROLL FOOTER */}
          <div ref={sentinelRef} className="h-16 flex items-center justify-center text-xs text-gray-500">
            {loadingMore ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading more quotations...
              </span>
            ) : error && quotations.length > 0 ? (
              <button
                type="button"
                className="text-red-500 underline"
                onClick={() => fetchChunk(filters, quotations.length, false)}
              >
                Couldn&apos;t load more. Tap to retry
              </button>
            ) : (endReached || !hasMore) && quotations.length > 0 ? (
              <span>
                You&apos;ve reached the end · {filteredQuotations.length} quotations
              </span>
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

        {/* HISTORY DIALOG (filter removed — it now lives on the main page) */}
        <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
            <DialogHeader className="sticky top-0 bg-white border-b px-6 py-4 z-10">
              <DialogTitle>
                Activity History: {selectedActivityRef}
                {activityHistory.length > 0 && activityHistory[0].company_name && (
                  <span className="block text-sm font-normal text-gray-600 mt-1">
                    {activityHistory[0].company_name}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {historyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : historyError ? (
                <div className="text-center py-8 text-red-500">{historyError}</div>
              ) : activityHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No history records found.</div>
              ) : (
                <div className="space-y-3">
                  {activityHistory.map((record) => (
                    <div key={record.id} className="border rounded-lg p-4 bg-gray-50">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Activity Type:</span>
                          <div className="font-medium">{record.type_activity || "-"}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Status:</span>
                          <div className="font-medium">{record.status || "-"}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Quotation #:</span>
                          <div className="font-medium uppercase">{record.quotation_number || "-"}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">SO Status:</span>
                          <div className="font-bold uppercase text-green-600">{record.so_status || "-"}</div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Date Updated:</span>
                          <div className="font-medium text-xs">{formatDate(record.date_updated)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AccessGuard>
  );
}