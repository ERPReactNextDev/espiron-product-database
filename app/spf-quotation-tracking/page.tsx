"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AccessGuard } from "@/components/AccessGuard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CollapsibleSearch from "@/components/collapsible-search";
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
  Layers,
  ArrowUp,
  Loader2,
  ChevronDown,
  Download,
  History,
  FilterX,
} from "lucide-react";

/* ───────────── types ───────────── */

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

// What the API narrows by. Dates are "YYYY-MM-DD" or "".
type Filters = { q: string; from: string; to: string };

// Chart cross-filters (click a bar / slice to filter everything else)
type Dim = "months" | "agents" | "statuses" | "buckets";
type Sel = Record<Dim, string[]>;
type Metric = "value" | "count";
type BarRow = { key: string; label: string; value: number; count: number };

const EMPTY_SEL: Sel = { months: [], agents: [], statuses: [], buckets: [] };

const DATA_LIMIT = 1000; // rows the dashboard works with
const ROWS_STEP = 30; // rows revealed per scroll in the details list
const SKU_PREVIEW = 3; // SKU chips shown before "+N more"

// Power BI-ish palette
const PALETTE = ["#01b8aa", "#374649", "#fd625e", "#f2c80f", "#5f6b6d", "#8ad4eb", "#fe9666", "#a66999"];

const BUCKETS = [
  { label: "Under ₱50K", max: 50_000 },
  { label: "₱50K – ₱100K", max: 100_000 },
  { label: "₱100K – ₱250K", max: 250_000 },
  { label: "₱250K – ₱500K", max: 500_000 },
  { label: "₱500K and up", max: Infinity },
];

/* ───────────── helpers ───────────── */

const formatPeso = (value: string | number | undefined | null) => {
  const n = typeof value === "number" ? value : parseFloat(value || "");
  if (isNaN(n)) return null;
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPesoCompact = (n: number) =>
  `₱${new Intl.NumberFormat("en-PH", { notation: "compact", maximumFractionDigits: 2 }).format(n)}`;

const fmtMetric = (metric: Metric, n: number) =>
  metric === "value" ? formatPesoCompact(n) : n.toLocaleString("en-PH");

const formatFilterDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
    lines.push({ sku: code, qty: qtyList[i] || null, price: formatPeso(amountList[i]) });
  });

  return lines;
};

const countSpfDsiSkus = (r: HistoryRecord) =>
  getSpfDsiSkuLines(r.product_sku, r.product_amount, r.product_quantity).length;

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

/* ── dimensions used by the charts ── */

const amountOf = (r: HistoryRecord) => {
  const n = parseFloat(r.quotation_amount || "");
  return isNaN(n) ? 0 : n;
};

const monthFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit" });
const monthOf = (r: HistoryRecord) => {
  const d = new Date(r.date_created);
  return isNaN(d.getTime()) ? "unknown" : monthFmt.format(d); // "2026-11"
};
const monthLabel = (key: string) => {
  if (key === "unknown") return "No date";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
};
const agentOf = (r: HistoryRecord) => (r.sales_agent || "Unassigned").trim().toUpperCase();
const statusOf = (r: HistoryRecord) => (r.status || "Unknown").trim().toUpperCase();
const bucketOf = (r: HistoryRecord) => {
  const amt = amountOf(r);
  return String(BUCKETS.findIndex((b) => amt < b.max));
};

// Power BI style: a chart ignores its own selection so you can still compare siblings
const passes = (r: HistoryRecord, sel: Sel, skip?: Dim) => {
  if (skip !== "months" && sel.months.length && !sel.months.includes(monthOf(r))) return false;
  if (skip !== "agents" && sel.agents.length && !sel.agents.includes(agentOf(r))) return false;
  if (skip !== "statuses" && sel.statuses.length && !sel.statuses.includes(statusOf(r))) return false;
  if (skip !== "buckets" && sel.buckets.length && !sel.buckets.includes(bucketOf(r))) return false;
  return true;
};

const aggregate = (recs: HistoryRecord[], keyFn: (r: HistoryRecord) => string) => {
  const m = new Map<string, { value: number; count: number }>();
  recs.forEach((r) => {
    const k = keyFn(r);
    const c = m.get(k) || { value: 0, count: 0 };
    c.value += amountOf(r);
    c.count += 1;
    m.set(k, c);
  });
  return m;
};

/* ───────────── small components ───────────── */

const SkuList = ({ lines }: { lines: SkuLine[] }) => {
  const [expanded, setExpanded] = useState(false);
  const [showQty, setShowQty] = useState(false);

  const getSkuBase = (sku: string) => sku.split("-").slice(0, 4).join("-");

  const handleSkuClick = (sku: string) => {
    sessionStorage.setItem("spfSkuSearch", getSkuBase(sku));
    window.location.href = `/requests`;
  };

  if (lines.length === 0) return <span className="text-gray-400">-</span>;

  const visible = expanded ? lines : lines.slice(0, SKU_PREVIEW);
  const hiddenCount = lines.length - SKU_PREVIEW;

  return (
    <div className="md:min-w-[220px] md:max-w-[360px]">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          {lines.length} {lines.length === 1 ? "SKU" : "SKUs"}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visible.map((line) => (
          <button
            key={line.sku}
            type="button"
            onClick={() => handleSkuClick(line.sku)}
            title={`Search for ${getSkuBase(line.sku)} in Requests`}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-mono text-[11px] font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100 cursor-pointer whitespace-nowrap"
          >
            {line.sku}
            {showQty && line.qty && (
              <span className="rounded bg-white px-1 text-[10px] font-medium text-gray-600">×{line.qty}</span>
            )}
          </button>
        ))}

        {!expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-600 hover:border-gray-400 hover:bg-gray-50"
          >
            +{hiddenCount} more
            <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] font-medium text-gray-500">
        {expanded && hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="inline-flex items-center gap-1 hover:text-gray-800"
          >
            <ChevronDown className="h-3 w-3 rotate-180" />
            Show less
          </button>
        )}
        <button
          type="button"
          onClick={() => setShowQty((q) => !q)}
          aria-pressed={showQty}
          className="hover:text-gray-800"
        >
          {showQty ? "Hide qty" : "Show qty"}
        </button>
      </div>
    </div>
  );
};

const QuotationDropdown = ({ quotations }: { quotations: HistoryRecord[] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<HistoryRecord | null>(quotations[0] || null);

  if (quotations.length === 0) return <span className="text-gray-400">-</span>;
  if (quotations.length === 1) {
    return <span className="font-medium uppercase">{quotations[0].quotation_number || "-"}</span>;
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

/* ── dashboard pieces ── */

// KPI tile with a colored left edge, like the Power BI cards
const KpiTile = ({
  label,
  value,
  hint,
  icon,
  color,
  loading,
  cardClass,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
  cardClass: string;
}) => (
  <div className={`relative overflow-hidden bg-white p-4 ${cardClass}`}>
    <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: color }} />
    <div className="flex items-start justify-between gap-2 pl-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <span className="text-gray-400">{icon}</span>
    </div>
    <div className="mt-3 pl-1.5">
      {loading ? (
        <div className="h-9 w-28 rounded bg-gray-200 animate-pulse" />
      ) : (
        <div className="truncate text-3xl font-bold leading-none tabular-nums text-gray-900" title={value}>
          {value}
        </div>
      )}
      <div className="mt-1.5 truncate text-xs text-gray-500">{hint || "\u00A0"}</div>
    </div>
  </div>
);

const Panel = ({
  title,
  subtitle,
  cardClass,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  cardClass: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <div className={`bg-white p-4 ${cardClass} ${className}`}>
    <div className="mb-3">
      <div className="text-sm font-semibold text-gray-800">{title}</div>
      {subtitle && <div className="text-[11px] uppercase tracking-wide text-gray-400">{subtitle}</div>}
    </div>
    {children}
  </div>
);

const MetricToggle = ({ metric, onChange }: { metric: Metric; onChange: (m: Metric) => void }) => (
  <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-xs font-semibold" role="group" aria-label="Chart metric">
    {(["value", "count"] as Metric[]).map((m) => (
      <button
        key={m}
        type="button"
        aria-pressed={metric === m}
        onClick={() => onChange(m)}
        className={`rounded-md px-3 py-1 capitalize transition-colors ${
          metric === m ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        {m === "value" ? "₱ Value" : "Count"}
      </button>
    ))}
  </div>
);

const NoData = () => <div className="py-10 text-center text-xs text-gray-400">No data for this selection.</div>;

// Vertical columns (quotations over time)
const ColumnChart = ({
  rows,
  metric,
  selected,
  onToggle,
}: {
  rows: BarRow[];
  metric: Metric;
  selected: string[];
  onToggle: (key: string) => void;
}) => {
  if (rows.length === 0) return <NoData />;
  const max = Math.max(1, ...rows.map((r) => r[metric]));

  return (
    <div className="flex h-52 items-stretch gap-2 overflow-x-auto pb-1">
      {rows.map((r) => {
        const v = r[metric];
        const active = selected.length === 0 || selected.includes(r.key);
        const isSelected = selected.includes(r.key);
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onToggle(r.key)}
            aria-pressed={isSelected}
            title={`${r.label}: ${formatPeso(r.value)} · ${r.count} quotations`}
            className={`group flex min-w-[46px] flex-1 flex-col items-center gap-1 transition-opacity ${
              active ? "" : "opacity-35"
            }`}
          >
            <span className="text-[10px] font-medium tabular-nums text-gray-600">{fmtMetric(metric, v)}</span>
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-t-md transition-all duration-300 group-hover:brightness-110"
                style={{
                  height: `${Math.max(3, (v / max) * 100)}%`,
                  background: isSelected ? "#374649" : "#01b8aa",
                }}
              />
            </div>
            <span className="text-[10px] text-gray-500">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// Horizontal bars (agents, value ranges)
const HBars = ({
  rows,
  metric,
  selected,
  onToggle,
  color,
}: {
  rows: BarRow[];
  metric: Metric;
  selected: string[];
  onToggle: (key: string) => void;
  color: string;
}) => {
  if (rows.length === 0) return <NoData />;
  const max = Math.max(1, ...rows.map((r) => r[metric]));

  return (
    <ul className="max-h-60 space-y-2.5 overflow-y-auto pr-1">
      {rows.map((r) => {
        const v = r[metric];
        const active = selected.length === 0 || selected.includes(r.key);
        const isSelected = selected.includes(r.key);
        return (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => onToggle(r.key)}
              aria-pressed={isSelected}
              className={`block w-full text-left transition-opacity ${active ? "" : "opacity-35"}`}
            >
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-semibold text-gray-800">{r.label}</span>
                <span className="shrink-0 tabular-nums text-gray-600">
                  {fmtMetric(metric, v)}
                  <span className="text-gray-400">
                    {" "}
                    · {metric === "value" ? `${r.count}` : formatPesoCompact(r.value)}
                  </span>
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(3, (v / max) * 100)}%`,
                    background: isSelected ? "#374649" : color,
                  }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
};

// Donut (status split)
const Donut = ({
  rows,
  metric,
  selected,
  onToggle,
}: {
  rows: BarRow[];
  metric: Metric;
  selected: string[];
  onToggle: (key: string) => void;
}) => {
  const total = rows.reduce((s, r) => s + r[metric], 0);
  if (rows.length === 0 || total === 0) return <NoData />;

  let acc = 0;
  const segments = rows.map((r, i) => {
    const pct = (r[metric] / total) * 100;
    const seg = { ...r, pct, offset: 25 - acc, color: PALETTE[i % PALETTE.length] };
    acc += pct;
    return seg;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 42 42" className="h-44 w-44 shrink-0" role="img" aria-label="Status split">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f3f4f6" strokeWidth="6" />
        {segments.map((s) => {
          const isSelected = selected.includes(s.key);
          const active = selected.length === 0 || isSelected;
          return (
            <circle
              key={s.key}
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke={s.color}
              strokeWidth={isSelected ? 8 : 6}
              strokeDasharray={`${s.pct} ${100 - s.pct}`}
              strokeDashoffset={s.offset}
              opacity={active ? 1 : 0.3}
              className="cursor-pointer transition-all duration-300"
              onClick={() => onToggle(s.key)}
            >
              <title>{`${s.label}: ${fmtMetric(metric, s[metric])} (${s.pct.toFixed(0)}%)`}</title>
            </circle>
          );
        })}
        <text x="21" y="20.5" textAnchor="middle" className="fill-gray-900" style={{ fontSize: 5.2, fontWeight: 700 }}>
          {fmtMetric(metric, total)}
        </text>
        <text x="21" y="26" textAnchor="middle" className="fill-gray-400" style={{ fontSize: 2.6 }}>
          TOTAL
        </text>
      </svg>

      <ul className="w-full max-h-44 space-y-1 overflow-y-auto pr-1">
        {segments.map((s) => {
          const isSelected = selected.includes(s.key);
          const active = selected.length === 0 || isSelected;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onToggle(s.key)}
                aria-pressed={isSelected}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-gray-50 transition-opacity ${
                  active ? "" : "opacity-40"
                }`}
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="flex-1 truncate font-semibold text-gray-800">{s.label}</span>
                <span className="tabular-nums text-gray-500">{s.pct.toFixed(0)}%</span>
              </button>
            </li>
          );
        })}
      </ul>
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

  // data (one request, the whole dashboard + list work off it)
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // server-side filters
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // SO status filter (hardcoded to "All" and "Convert to SI")
  const [soStatusFilter, setSoStatusFilter] = useState("");
  const [soActivityRefs, setSoActivityRefs] = useState<Set<string> | null>(null);
  const [soLoading, setSoLoading] = useState(false);
  const [soError, setSoError] = useState<string | null>(null);

  // interactive chart selections
  const [sel, setSel] = useState<Sel>(EMPTY_SEL);
  const [metric, setMetric] = useState<Metric>("value");

  const filters = useMemo<Filters>(
    () => ({ q: search, from: dateFrom, to: dateTo }),
    [search, dateFrom, dateTo]
  );
  const hasDateFilter = Boolean(dateFrom || dateTo);
  const hasAnyFilter = Boolean(search || hasDateFilter || soStatusFilter);
  const dateRangeLabel = describeDateRange(dateFrom, dateTo);

  // list reveal + scrolling
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const [visibleCount, setVisibleCount] = useState(ROWS_STEP);
  const [showTop, setShowTop] = useState(false);

  // history dialog
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedActivityRef, setSelectedActivityRef] = useState<string | null>(null);
  const [activityHistory, setActivityHistory] = useState<ActivityHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const fetchData = useCallback(async (f: Filters) => {
    const requestId = ++requestIdRef.current;
    try {
      setError(null);
      setLoading(true);
      const res = await fetch(`/api/spf-dsi-quotations?${buildParams(f, DATA_LIMIT, 0).toString()}`);
      if (!res.ok) throw new Error("Failed to fetch quotations");
      const data = await res.json();
      if (requestId !== requestIdRef.current) return; // stale
      const recs: HistoryRecord[] = data.quotations || [];
      setRecords(recs);
      setTotalCount(data.total || recs.length);
    } catch (err: any) {
      if (requestId !== requestIdRef.current) return;
      setRecords([]);
      setTotalCount(0);
      setError(err.message || "Failed to fetch quotations");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  // debounce typing
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // SO status -> activity refs that have it
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

  // server filter change -> refetch
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    fetchData(filters);
  }, [filters, fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchData(filters);
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

  /* ── chart selection ── */
  const toggleSel = (dim: Dim, key: string) =>
    setSel((s) => ({
      ...s,
      [dim]: s[dim].includes(key) ? s[dim].filter((k) => k !== key) : [...s[dim], key],
    }));
  const clearSel = () => setSel(EMPTY_SEL);
  const hasSel = Object.values(sel).some((a) => a.length > 0);

  /* ── data pipeline: API rows -> SO status -> chart selections ── */
  const soPending = Boolean(soStatusFilter) && (soLoading || soActivityRefs === null);

  const base = useMemo(() => {
    if (!soStatusFilter || !soActivityRefs) return records;
    return records.filter((r) => soActivityRefs.has(r.activity_reference_number));
  }, [records, soStatusFilter, soActivityRefs]);

  const filtered = useMemo(() => base.filter((r) => passes(r, sel)), [base, sel]);

  /* ── KPIs (follow every filter and selection) ── */
  const kpis = useMemo(() => {
    const totalValue = filtered.reduce((s, r) => s + amountOf(r), 0);
    const count = filtered.length;
    return {
      totalValue,
      count,
      avg: count ? totalValue / count : 0,
      skuCount: filtered.reduce((s, r) => s + countSpfDsiSkus(r), 0),
    };
  }, [filtered]);

  /* ── chart data (each chart ignores its own selection) ── */
  const monthRows = useMemo<BarRow[]>(() => {
    const agg = aggregate(base.filter((r) => passes(r, sel, "months")), monthOf);
    return [...agg.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([key, v]) => ({ key, label: monthLabel(key), ...v }));
  }, [base, sel]);

  const agentRows = useMemo<BarRow[]>(() => {
    const agg = aggregate(base.filter((r) => passes(r, sel, "agents")), agentOf);
    return [...agg.entries()]
      .map(([key, v]) => ({ key, label: key, ...v }))
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, 10);
  }, [base, sel, metric]);

  const statusRows = useMemo<BarRow[]>(() => {
    const agg = aggregate(base.filter((r) => passes(r, sel, "statuses")), statusOf);
    return [...agg.entries()]
      .map(([key, v]) => ({ key, label: key, ...v }))
      .sort((a, b) => b[metric] - a[metric]);
  }, [base, sel, metric]);

  const bucketRows = useMemo<BarRow[]>(() => {
    const agg = aggregate(base.filter((r) => passes(r, sel, "buckets")), bucketOf);
    return BUCKETS.map((b, i) => ({
      key: String(i),
      label: b.label,
      ...(agg.get(String(i)) || { value: 0, count: 0 }),
    }));
  }, [base, sel]);

  /* ── details list ── */
  const displayGroups = useMemo(() => groupQuotations(filtered), [filtered]);
  const visibleGroups = displayGroups.slice(0, visibleCount);
  const moreToShow = visibleCount < displayGroups.length;

  // new data or selection -> start the list over
  useEffect(() => {
    setVisibleCount(ROWS_STEP);
  }, [filtered]);

  // reveal more rows as the sentinel nears the viewport
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && moreToShow) setVisibleCount((c) => c + ROWS_STEP);
      },
      { root, rootMargin: "400px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [moreToShow, visibleCount]);

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

  const anyFilter = hasAnyFilter || hasSel;
  const emptyMessage = anyFilter
    ? `No quotations match${search ? ` "${search}"` : " these filters"}${
        hasDateFilter ? ` for ${dateRangeLabel}` : ""
      }${soStatusFilter ? ` with SO status "${soStatusFilter}"` : ""}.`
    : "No SPF-DSI quotations found.";

  const showLoading = loading || soPending;
  const kpiPartial = records.length >= DATA_LIMIT && totalCount > DATA_LIMIT;

  const kpiHint = (() => {
    if (!anyFilter) return "All SPF-DSI quotations";
    const parts: string[] = [];
    if (search) parts.push(`"${search}"`);
    if (hasDateFilter) parts.push(dateRangeLabel);
    if (soStatusFilter) parts.push(soStatusFilter);
    if (hasSel) parts.push("chart filters on");
    return parts.join(" · ");
  })();

  // chips that show what the charts are currently filtering by
  const chips: { dim: Dim; key: string; label: string }[] = [
    ...sel.months.map((k) => ({ dim: "months" as Dim, key: k, label: monthLabel(k) })),
    ...sel.agents.map((k) => ({ dim: "agents" as Dim, key: k, label: k })),
    ...sel.statuses.map((k) => ({ dim: "statuses" as Dim, key: k, label: k })),
    ...sel.buckets.map((k) => ({ dim: "buckets" as Dim, key: k, label: BUCKETS[Number(k)]?.label || k })),
  ];

  /* ── filter controls ── */
  const searchBar = (
    <>
      <CollapsibleSearch
        className="hidden md:flex"
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Search activity ref #, account ref #, SKU, SO status, or agent..."
      />
      <div className="relative w-full md:hidden">
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
    </>
  );

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
        <div className="md:hidden shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 pt-14 pb-3">
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

        {/* ── ONE SCROLL AREA: dashboard + details ── */}
        <div
          ref={scrollRef}
          onScroll={(e) => setShowTop(e.currentTarget.scrollTop > 600)}
          className={`relative flex-1 min-h-0 overflow-y-auto overflow-x-auto bg-white/60 backdrop-blur-sm ${
            isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
          }`}
        >
          <section className="px-3 md:px-6 pt-4 pb-2 space-y-3">
            {/* active chart filters + metric switch */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5 min-h-[28px]">
                {chips.length === 0 ? (
                  <span className="text-xs text-gray-500">
                    Tip: click any bar or slice to filter the whole dashboard. Click again to undo.
                  </span>
                ) : (
                  <>
                    {chips.map((c) => (
                      <button
                        key={`${c.dim}-${c.key}`}
                        type="button"
                        onClick={() => toggleSel(c.dim, c.key)}
                        className="inline-flex items-center gap-1 rounded-full bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-gray-700"
                        aria-label={`Remove filter ${c.label}`}
                      >
                        {c.label}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={clearSel}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <FilterX className="h-3 w-3" />
                      Clear all
                    </button>
                  </>
                )}
              </div>
              <MetricToggle metric={metric} onChange={setMetric} />
            </div>

            {/* KPI TILES */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiTile
                label="Total quoted value"
                value={formatPeso(kpis.totalValue) || "₱0.00"}
                hint={kpiHint}
                icon={<Banknote className="h-5 w-5" />}
                color="#01b8aa"
                loading={showLoading}
                cardClass={cardClass}
              />
              <KpiTile
                label="Quotations"
                value={kpis.count.toLocaleString("en-PH")}
                hint={`${displayGroups.length.toLocaleString("en-PH")} activity groups`}
                icon={<FileText className="h-5 w-5" />}
                color="#374649"
                loading={showLoading}
                cardClass={cardClass}
              />
              <KpiTile
                label="Average quotation"
                value={formatPesoCompact(kpis.avg)}
                hint={formatPeso(kpis.avg) || undefined}
                icon={<Calculator className="h-5 w-5" />}
                color="#fd625e"
                loading={showLoading}
                cardClass={cardClass}
              />
              <KpiTile
                label="SKU lines"
                value={kpis.skuCount.toLocaleString("en-PH")}
                hint={
                  kpis.count ? `${(kpis.skuCount / kpis.count).toFixed(1)} per quotation` : undefined
                }
                icon={<Layers className="h-5 w-5" />}
                color="#f2c80f"
                loading={showLoading}
                cardClass={cardClass}
              />
            </div>

            {/* CHARTS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <Panel
                title="Quotations over time"
                subtitle={`By date created · ${metric === "value" ? "quoted value" : "count"}`}
                cardClass={cardClass}
                className="lg:col-span-7"
              >
                {showLoading ? (
                  <div className="h-52 rounded bg-gray-100 animate-pulse" />
                ) : (
                  <ColumnChart
                    rows={monthRows}
                    metric={metric}
                    selected={sel.months}
                    onToggle={(k) => toggleSel("months", k)}
                  />
                )}
              </Panel>

              <Panel
                title="Status split"
                subtitle="Share of total"
                cardClass={cardClass}
                className="lg:col-span-5"
              >
                {showLoading ? (
                  <div className="h-44 rounded bg-gray-100 animate-pulse" />
                ) : (
                  <Donut
                    rows={statusRows}
                    metric={metric}
                    selected={sel.statuses}
                    onToggle={(k) => toggleSel("statuses", k)}
                  />
                )}
              </Panel>

              <Panel
                title="Top agents"
                subtitle={`Ranked by ${metric === "value" ? "quoted value" : "quotation count"}`}
                cardClass={cardClass}
                className="lg:col-span-7"
              >
                {showLoading ? (
                  <div className="h-44 rounded bg-gray-100 animate-pulse" />
                ) : (
                  <HBars
                    rows={agentRows}
                    metric={metric}
                    selected={sel.agents}
                    onToggle={(k) => toggleSel("agents", k)}
                    color="#01b8aa"
                  />
                )}
              </Panel>

              <Panel
                title="Quotation size"
                subtitle="Distribution by amount"
                cardClass={cardClass}
                className="lg:col-span-5"
              >
                {showLoading ? (
                  <div className="h-44 rounded bg-gray-100 animate-pulse" />
                ) : (
                  <HBars
                    rows={bucketRows}
                    metric={metric}
                    selected={sel.buckets}
                    onToggle={(k) => toggleSel("buckets", k)}
                    color="#fd625e"
                  />
                )}
              </Panel>
            </div>

            {kpiPartial && (
              <p className="text-xs text-gray-500">
                Dashboard covers the latest {DATA_LIMIT.toLocaleString("en-PH")} of{" "}
                {totalCount.toLocaleString("en-PH")} quotations. Narrow with search or dates to see the rest.
              </p>
            )}
            {soError && <p className="text-xs text-red-500">{soError}</p>}
          </section>

          {/* DETAILS HEADER STRIP */}
          <div className="px-3 md:px-6 py-2 text-sm text-gray-600 flex items-center justify-between">
            <span>
              Details · showing <b className="text-gray-900 tabular-nums">{visibleGroups.length}</b> of{" "}
              <b className="text-gray-900 tabular-nums">{displayGroups.length}</b> groups
              <span className="text-gray-500"> · {filtered.length} quotations</span>
              {hasDateFilter && <span className="text-gray-500"> · created {dateRangeLabel}</span>}
              {soStatusFilter && <span className="text-gray-500"> · SO status: {soStatusFilter}</span>}
            </span>
          </div>

          {/* DESKTOP TABLE */}
          <div className="hidden md:block">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-blue-50/95 backdrop-blur-sm sticky top-0 z-30">
                <tr>
                  {["Activity Ref #", "Account Ref #", "Sales Agent", "Quotation #", "Product SKU", "Status", "Date Created", "Date Updated"].map(
                    (h) => (
                      <th key={h} className={`px-4 py-3 text-left font-bold border-b whitespace-nowrap ${h === "Status" ? "px-2" : ""}`}>
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
                  visibleGroups.map((group) => {
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
          <div className="md:hidden px-3 pb-6 space-y-2.5">
            {showLoading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
              </div>
            ) : error && displayGroups.length === 0 ? (
              <div className="text-center py-16 text-red-500">{error}</div>
            ) : displayGroups.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">{emptyMessage}</div>
            ) : (
              visibleGroups.map((group) => {
                const firstQuotation = group.quotations[0];
                return (
                  <div
                    key={`${group.activityRef}-${group.accountRef}`}
                    className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-sm"
                  >
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
                      <div className="text-gray-400 text-xs">Created {formatDate(firstQuotation.date_created)}</div>
                      <div className="text-gray-400 text-xs">Updated {formatDate(firstQuotation.date_updated)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* LIST FOOTER (auto-reveals more rows) */}
          <div ref={sentinelRef} className="h-16 flex items-center justify-center text-xs text-gray-500">
            {moreToShow ? (
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + ROWS_STEP)}
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading more · tap to load now
              </button>
            ) : displayGroups.length > 0 ? (
              <span>You&apos;ve reached the end · {filtered.length} quotations</span>
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

        {/* HISTORY DIALOG */}
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