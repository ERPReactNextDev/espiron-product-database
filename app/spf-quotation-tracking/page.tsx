"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AccessGuard } from "@/components/AccessGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";

type HistoryRecord = {
  id: string;
  quotation_number: string;
  product_sku: string;
  quotation_amount: string;
  status: string;
  date_created: string;
  date_updated: string;
  sales_agent: string;
  product_quantity: string;
  product_amount: string;
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
    sessionStorage.setItem('spfSkuSearch', skuBase);
    window.location.href = `/requests`;
  };

  if (lines.length === 0) return <span className="text-gray-400">-</span>;

  return (
    <div className="md:min-w-[340px]">
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
                {line.price && (
                  <span className="text-xs font-medium text-gray-700 tabular-nums whitespace-nowrap">
                    {line.price}
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
        {open ? "Hide qty & price" : "Show qty & price"}
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

  // Stable object so effects only re-run when a filter really changes
  const filters = useMemo<Filters>(
    () => ({ q: search, from: dateFrom, to: dateTo }),
    [search, dateFrom, dateTo]
  );
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const hasAnyFilter = Boolean(search || hasDateFilter);
  const dateRangeLabel = describeDateRange(dateFrom, dateTo);

  // KPI data (separate request so numbers cover more than the loaded rows)
  const [kpiRecords, setKpiRecords] = useState<HistoryRecord[]>([]);
  const [kpiLoading, setKpiLoading] = useState(true);

  // scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const [showTop, setShowTop] = useState(false);

  const hasMore = quotations.length < totalCount;

  /* fetch a chunk. reset=true starts from the top (filter change / refresh) */
  const fetchChunk = useCallback(async (f: Filters, offset: number, reset: boolean) => {
    const requestId = reset ? ++requestIdRef.current : requestIdRef.current;
    try {
      setError(null);
      reset ? setLoading(true) : setLoadingMore(true);

      const res = await fetch(`/api/spf-dsi-quotations?${buildParams(f, PAGE_SIZE, offset).toString()}`);
      if (!res.ok) throw new Error("Failed to fetch quotations");
      const data = await res.json();

      if (requestId !== requestIdRef.current) return; // stale
      const incoming: HistoryRecord[] = data.quotations || [];

      setQuotations((prev) => {
        if (reset) return incoming;
        const ids = new Set(prev.map((r) => r.id));
        return [...prev, ...incoming.filter((r) => !ids.has(r.id))];
      });
      setTotalCount(data.total || 0);
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

  // any filter change -> reset list + KPIs, jump back to top
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    fetchChunk(filters, 0, true);
    fetchKpis(filters);
  }, [filters, fetchChunk, fetchKpis]);

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

  const clearDates = () => {
    setDateFrom("");
    setDateTo("");
  };

  /* ── KPI math ── */
  const kpis = useMemo(() => {
    const amountOf = (r: HistoryRecord) => {
      const n = parseFloat(r.quotation_amount || "");
      return isNaN(n) ? 0 : n;
    };

    const totalValue = kpiRecords.reduce((s, r) => s + amountOf(r), 0);
    const count = kpiRecords.length;
    const avg = count ? totalValue / count : 0;
    const skuCount = kpiRecords.reduce((s, r) => s + countSpfDsiSkus(r), 0);

    const byAgent = new Map<string, { value: number; count: number }>();
    kpiRecords.forEach((r) => {
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
  }, [kpiRecords]);

  const topAgents = kpis.agents.slice(0, 5);
  const maxAgentValue = topAgents[0]?.value || 1;

  /* ── theme-aware styles ── */
  const headerBorder = isBold ? "border-b-4 border-gray-800" : "border-b border-gray-200";
  const cardClass = isBold
    ? "rounded-lg border-2 border-gray-800 shadow-[4px_4px_0_0_#1f2937]"
    : "rounded-xl border border-gray-200 shadow-sm";
  const titleClass = isComic
    ? "font-comic-title comic-text-shadow text-gray-900"
    : isEngineer
    ? "font-engineer-title engineer-text-shadow text-orange-600"
    : "font-formal-title text-gray-900";

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
      }.`
    : "No SPF-DSI quotations found.";

  const searchBar = (
    <div className="relative w-full md:w-80">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <Input
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search quotation #, SKU, or agent..."
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
    return parts.join(" · ");
  })();

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
              {dateFilter}
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
            <Button size="sm" variant="outline" disabled={isRefreshing} onClick={handleRefresh}>
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <div className="mt-3 space-y-2">
            {searchBar}
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
                loading={kpiLoading}
                cardClass={cardClass}
                className="col-span-2 lg:col-span-4"
              />
              <KpiCard
                label="Quotations"
                value={kpis.count.toLocaleString("en-PH")}
                hint={`${kpis.skuCount.toLocaleString("en-PH")} SKU lines`}
                icon={<FileText className="h-5 w-5 text-purple-700" />}
                accent="bg-purple-100"
                loading={kpiLoading}
                cardClass={cardClass}
                className="lg:col-span-2"
              />
              <KpiCard
                label="Average quotation"
                value={formatPesoCompact(kpis.avg)}
                hint={formatPeso(kpis.avg) || undefined}
                icon={<Calculator className="h-5 w-5 text-sky-700" />}
                accent="bg-sky-100"
                loading={kpiLoading}
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
                {kpiLoading ? (
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
          </section>

          {/* LIST HEADER STRIP (replaces the pagination bar) */}
          <div className="px-3 md:px-6 py-2 text-sm text-gray-600 flex items-center justify-between">
            <span>
              Showing <b className="text-gray-900 tabular-nums">{quotations.length}</b> of{" "}
              <b className="text-gray-900 tabular-nums">{totalCount}</b> quotations
              {hasDateFilter && <span className="text-gray-500"> · created {dateRangeLabel}</span>}
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
                  {["Quotation #", "Sales Agent", "Product SKU", "Quotation Amount (SPF)", "Status", "Date Created", "Date Updated"].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left font-bold border-b whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : error && quotations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : quotations.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      {emptyMessage}
                    </td>
                  </tr>
                ) : (
                  quotations.map((record) => (
                    <tr key={record.id} className="border-b hover:bg-white/60 align-top">
                      <td className="px-4 py-3 font-medium uppercase">{record.quotation_number || "-"}</td>
                      <td className="px-4 py-3 uppercase">{record.sales_agent || "-"}</td>
                      <td className="px-4 py-3">
                        <SkuList
                          lines={getSpfDsiSkuLines(record.product_sku, record.product_amount, record.product_quantity)}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium">{formatPeso(record.quotation_amount) || "-"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded uppercase font-semibold whitespace-nowrap bg-purple-100 text-purple-700">
                          {record.status || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(record.date_created)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {formatDate(record.date_updated)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARD LIST */}
          <div className="md:hidden px-3 pb-6 space-y-3">
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
              </div>
            ) : error && quotations.length === 0 ? (
              <div className="text-center py-16 text-red-500">{error}</div>
            ) : quotations.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">{emptyMessage}</div>
            ) : (
              quotations.map((record) => (
                <div key={record.id} className="bg-white rounded-lg border p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-sm uppercase">{record.quotation_number || "-"}</div>
                      <div className="text-xs text-gray-500 mt-1">{record.sales_agent || "-"}</div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded uppercase font-semibold whitespace-nowrap bg-purple-100 text-purple-700">
                      {record.status || "-"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Product SKU:</span>
                      <div className="mt-1">
                        <SkuList
                          lines={getSpfDsiSkuLines(record.product_sku, record.product_amount, record.product_quantity)}
                        />
                      </div>
                    </div>
                    <div>
                      <span className="text-gray-500">Quotation Amount (SPF):</span>
                      <div className="font-bold">{formatPeso(record.quotation_amount) || "-"}</div>
                    </div>
                    <div className="text-gray-400 text-xs">
                      Created {formatDate(record.date_created)}
                    </div>
                    <div className="text-gray-400 text-xs">
                      Updated {formatDate(record.date_updated)}
                    </div>
                  </div>
                </div>
              ))
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
            ) : !hasMore && quotations.length > 0 ? (
              <span>You&apos;ve reached the end · {totalCount} quotations</span>
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