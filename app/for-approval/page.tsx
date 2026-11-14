"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import { Check, ChevronLeft, ChevronRight, Filter, Shield, X } from "lucide-react";
import { toast } from "sonner";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CollapsibleSearch from "@/components/collapsible-search";
import { db } from "@/lib/firebase";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import {
  approveForApprovalRequest,
  canReviewApprovals,
  getApprovalUserProfile,
  rejectForApprovalRequest,
  type ApprovalActionType,
  type ApprovalUserProfile,
} from "@/lib/for-approval";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import SupplierDiffTable from "@/components/supplier-diff-table";
import ProductDiffTable from "@/components/product-diff-table";
import UploadProductDiffTable from "@/components/upload-product-diff-table";
import UploadSupplierDiffTable from "@/components/upload-supplier-diff-table";

type RowDoc = {
  id: string;
  actionType: ApprovalActionType;
  entityLabel: string;
  summary: string;
  message: string;
  requesterName: string;
  requesterDepartment: string | null;
  requesterRole: string | null;
  status: string;
  createdAt: Timestamp | null;
  reviewedByName: string | null;
  reviewRemarks: string | null;
  payload: Record<string, unknown>;
};

function formatWhen(ts: Timestamp | null): string {
  if (!ts?.toDate) return "—";
  try {
    return ts.toDate().toLocaleString();
  } catch {
    return "—";
  }
}

function actionTitle(t: ApprovalActionType): string {
  const m: Record<ApprovalActionType, string> = {
    product_add: "Add product",
    product_edit: "Edit product",
    product_delete: "Delete product",
    supplier_add: "Add supplier",
    supplier_edit: "Edit supplier",
    supplier_delete: "Delete supplier",
    product_upload: "Upload products",
    supplier_upload: "Upload suppliers",
  };
  return m[t] ?? t;
}

export default function ForApprovalPage() {
  const router = useRouter();
  const { userId } = useUser();
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isEngineer = theme === "engineer";

  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [reviewerProfile, setReviewerProfile] = useState<ApprovalUserProfile | null>(null);
  const [rows, setRows] = useState<RowDoc[]>([]);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectRemarks, setRejectRemarks] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasLoadedSnapshotRef = useRef(false);
  const pendingIdsRef = useRef<Set<string>>(new Set());

  const itemsPerPage = 10;

  useEffect(() => {
    if (userId === null) return;
    if (!userId) {
      router.push("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      const profile = await getApprovalUserProfile(userId);
      if (cancelled) return;
      if (!canReviewApprovals(profile)) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      setReviewerProfile(profile);
      setAccessDenied(false);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, router]);

  useEffect(() => {
    if (!userId || accessDenied || !reviewerProfile) return;
    hasLoadedSnapshotRef.current = false;
    pendingIdsRef.current = new Set();
    if (!audioRef.current) {
      audioRef.current = new Audio("/musics/notif-sound.mp3");
      audioRef.current.preload = "auto";
    }
    const q = query(collection(db, "forApprovals"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        const next: RowDoc[] = snap.docs.map((d) => {
          const x = d.data() as Record<string, unknown>;
          return {
            id: d.id,
            actionType: x.actionType as ApprovalActionType,
            entityLabel: String(x.entityLabel ?? ""),
            summary: String(x.summary ?? ""),
            message: String(x.message ?? ""),
            requesterName: String(x.requesterName ?? ""),
            requesterDepartment: (x.requesterDepartment as string) ?? null,
            requesterRole: (x.requesterRole as string) ?? null,
            status: String(x.status ?? ""),
            createdAt: (x.createdAt as Timestamp) ?? null,
            reviewedByName: (x.reviewedByName as string) ?? null,
            reviewRemarks: (x.reviewRemarks as string) ?? null,
            payload: (x.payload as Record<string, unknown>) ?? {},
          };
        });
        const nextPendingIds = new Set(next.filter((item) => item.status === "Pending").map((item) => item.id));
        const newPendingCount = [...nextPendingIds].filter((id) => !pendingIdsRef.current.has(id)).length;
        if (hasLoadedSnapshotRef.current && newPendingCount > 0) {
          const audio = audioRef.current;
          if (audio) {
            audio.currentTime = 0;
            void audio.play().catch(() => {});
          }
          toast.info(
            newPendingCount === 1 ? "New approval request" : `${newPendingCount} new approval requests`,
          );
        }
        pendingIdsRef.current = nextPendingIds;
        hasLoadedSnapshotRef.current = true;
        setRows(next);
      },
      (err) => {
        console.error(err);
        toast.error("Could not load approvals");
      },
    );
  }, [userId, accessDenied, reviewerProfile]);

  const filteredItems = useMemo(() => {
    const keyword = search.toLowerCase().trim();
    if (!keyword) return rows;
    return rows.filter((item) => {
      const blob = [
        item.summary,
        item.entityLabel,
        item.requesterName,
        item.status,
        item.message,
        actionTitle(item.actionType),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(keyword);
    });
  }, [search, rows]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = filteredItems.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const handleApprove = useCallback(
    async (id: string) => {
      if (!reviewerProfile) return;
      setActionLoadingId(id);
      try {
        await approveForApprovalRequest(id, reviewerProfile);
        toast.success("Approved", { description: "The request was applied successfully." });
      } catch (e) {
        console.error(e);
        toast.error("Approve failed", {
          description: e instanceof Error ? e.message : "Try again.",
        });
      } finally {
        setActionLoadingId(null);
      }
    },
    [reviewerProfile],
  );

  const openReject = (id: string) => {
    setRejectTargetId(id);
    setRejectRemarks("");
    setRejectOpen(true);
  };

  const submitReject = async () => {
    if (!rejectTargetId || !reviewerProfile) return;
    setActionLoadingId(rejectTargetId);
    try {
      await rejectForApprovalRequest(rejectTargetId, reviewerProfile, rejectRemarks);
      toast.success("Rejected", { description: "The requester will be notified." });
      setRejectOpen(false);
      setRejectTargetId(null);
    } catch (e) {
      console.error(e);
      toast.error("Reject failed", {
        description: e instanceof Error ? e.message : "Try again.",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const duplicateHint = (payload: Record<string, unknown>) => {
    const dup = payload.duplicateSummary;
    if (typeof dup === "string" && dup.trim()) return dup;
    const total = payload.rowCount;
    const dupes = payload.duplicateRowCount;
    if (typeof total === "number") {
      return `Rows in file: ${total}${typeof dupes === "number" ? ` · Duplicates vs DB: ${dupes}` : ""}`;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-gray-800 animate-spin" />
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="h-dvh flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-4">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              Only Engineering managers and IT staff can open For Approval.
            </p>
            <Button onClick={() => router.push("/dashboard")} className="w-full">
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
        <SidebarTrigger />
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold shrink-0">For Approval</h1>
          <div className="flex flex-wrap gap-2 items-center">
            <CollapsibleSearch
              value={search}
              onChange={setSearch}
              placeholder="Search by requester, type, message…"
            />
            <Button variant="outline" className="gap-1" disabled>
              <Filter className="h-4 w-4" /> Filter
            </Button>
          </div>
        </div>
      </div>

      <div className="hidden md:flex items-center justify-between px-6 py-2 bg-white/70 backdrop-blur-md border-b shrink-0">
        <span className="text-sm text-gray-500">
          Page {currentPage} of {totalPages} · {filteredItems.length} items
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>

      <div className={`hidden md:block flex-1 min-h-0 overflow-auto bg-white/60 backdrop-blur-sm ${
        isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
      }`}>
        <table className="w-full text-sm border-collapse">
          <thead className="bg-red-50/80 backdrop-blur-sm sticky top-0 z-10">
            <tr>
              <th className="text-left font-bold px-3 py-3 border-b whitespace-nowrap">Request</th>
              <th className="text-left font-bold px-3 py-3 border-b whitespace-nowrap max-w-[200px]">
                Message
              </th>
              <th className="text-left font-bold px-3 py-3 border-b whitespace-nowrap">Requested By</th>
              <th className="text-center font-bold px-3 py-3 border-b whitespace-nowrap">Date</th>
              <th className="text-center font-bold px-3 py-3 border-b whitespace-nowrap">Status</th>
              <th className="text-center font-bold px-3 py-3 border-b whitespace-nowrap w-[120px]">
                Decision
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  No approval records yet.
                </td>
              </tr>
            ) : (
              paginatedItems.map((item) => {
                const dupHint = duplicateHint(item.payload);
                const pending = item.status === "Pending";
                const unreadCountForRow = pending ? 1 : 0;
                const isUnreadRow = unreadCountForRow > 0;
                return (
                  <tr key={item.id} className={`border-b hover:bg-white/60 align-top ${isUnreadRow ? "bg-red-50/40 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.20)]" : ""}`}>
                    <td className="px-3 py-3">
                      <div className="inline-flex items-center gap-2 font-medium">
                        <span>{actionTitle(item.actionType)}</span>
                        {isUnreadRow && (
                          <span className="h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] rounded-full bg-red-600 text-white font-bold shadow-[0_0_16px_rgba(239,68,68,0.75)] animate-pulse">
                            {unreadCountForRow}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 break-all">
                        {item.summary || item.entityLabel}
                      </div>
                      {dupHint && (
                        <div className="text-[11px] text-amber-800 mt-1 bg-amber-50 rounded px-1.5 py-1 border border-amber-100">
                          {dupHint}
                        </div>
                      )}
                      {["supplier_edit", "supplier_delete", "supplier_add"].includes(item.actionType) && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer select-none">
                            View field comparison
                          </summary>
                          <div className="mt-2">
                            <SupplierDiffTable
                              oldData={(item.payload.before ?? {}) as any}
                              newData={item.payload as any}
                            />
                          </div>
                        </details>
                      )}

                      {["product_edit", "product_delete", "product_add"].includes(item.actionType) && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer select-none">
                            View field comparison
                          </summary>
                          <div className="mt-2">
                            <ProductDiffTable
                              oldData={(item.payload.before ?? {}) as any}
                              newData={item.payload as any}
                            />
                          </div>
                        </details>
                      )}

                      {item.actionType === "product_upload" && Array.isArray(item.payload.rows) && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer select-none">
                            View rows ({(item.payload.rows as unknown[]).length})
                          </summary>
                          {/* Fixed-size box — scrolls both axes, never bleeds into the page */}
                          <div
                            className="mt-2"
                            style={{ width: "min(680px, 60vw)", maxHeight: "280px", overflow: "auto" }}
                          >
                            <UploadProductDiffTable rows={item.payload.rows as any} />
                          </div>
                        </details>
                      )}

                      {item.actionType === "supplier_upload" && Array.isArray(item.payload.rows) && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer select-none">
                            View rows ({(item.payload.rows as unknown[]).length})
                          </summary>
                          <div
                            className="mt-2"
                            style={{ width: "min(680px, 60vw)", maxHeight: "280px", overflow: "auto" }}
                          >
                            <UploadSupplierDiffTable rows={item.payload.rows as any} />
                          </div>
                        </details>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground max-w-[220px] whitespace-pre-wrap break-words">
                      {item.message || "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div>{item.requesterName || "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {[item.requesterDepartment, item.requesterRole].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-xs whitespace-nowrap">
                      {formatWhen(item.createdAt)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={
                          item.status === "Pending"
                            ? "text-amber-700 font-medium"
                            : item.status === "Approved"
                              ? "text-green-700 font-medium"
                              : "text-red-700 font-medium"
                        }
                      >
                        {item.status}
                      </span>
                      {item.reviewedByName && (
                        <div className="text-[10px] text-muted-foreground mt-1">
                          by {item.reviewedByName}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {pending ? (
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-full border-green-600 text-green-700 hover:bg-green-50"
                            disabled={actionLoadingId === item.id}
                            onClick={() => handleApprove(item.id)}
                            title="Approve"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-9 w-9 rounded-full border-red-500 text-red-600 hover:bg-red-50"
                            disabled={actionLoadingId === item.id}
                            onClick={() => openReject(item.id)}
                            title="Reject"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : item.status === "Approved" ? (
                        <div className="flex justify-center text-green-600">
                          <Check className="h-6 w-6" aria-label="Approved" />
                        </div>
                      ) : (
                        <div className="flex justify-center text-red-500">
                          <X className="h-6 w-6" aria-label="Rejected" />
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-white/50">
        {paginatedItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white/70 p-6 text-center text-sm text-gray-500">
            No approval records yet.
          </div>
        ) : (
          paginatedItems.map((item) => {
            const dupHint = duplicateHint(item.payload);
            const pending = item.status === "Pending";
            const unreadCountForRow = pending ? 1 : 0;
            const isUnreadRow = unreadCountForRow > 0;
            return (
              <div
                key={item.id}
                className={`rounded-2xl border bg-white/80 p-4 shadow-sm space-y-2 ${isUnreadRow ? "border-red-200 shadow-[0_0_16px_rgba(239,68,68,0.35)]" : "border-gray-200"}`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{actionTitle(item.actionType)}</p>
                  {isUnreadRow && (
                    <span className="h-5 min-w-5 px-1.5 flex items-center justify-center text-[10px] rounded-full bg-red-600 text-white font-bold shadow-[0_0_16px_rgba(239,68,68,0.75)] animate-pulse">
                      {unreadCountForRow}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">{item.summary || item.entityLabel}</p>
                {dupHint && (
                  <p className="text-[11px] text-amber-900 bg-amber-50 rounded px-2 py-1">{dupHint}</p>
                )}

                {["supplier_edit", "supplier_delete", "supplier_add"].includes(item.actionType) && (
                  <details className="mt-1">
                    <summary className="text-xs text-blue-600 cursor-pointer select-none">
                      View field comparison
                    </summary>
                    <div className="mt-2">
                      <SupplierDiffTable
                        oldData={(item.payload.before ?? {}) as any}
                        newData={item.payload as any}
                      />
                    </div>
                  </details>
                )}

                {["product_edit", "product_delete", "product_add"].includes(item.actionType) && (
                  <details className="mt-1">
                    <summary className="text-xs text-blue-600 cursor-pointer select-none">
                      View field comparison
                    </summary>
                    <div className="mt-2">
                      <ProductDiffTable
                        oldData={(item.payload.before ?? {}) as any}
                        newData={item.payload as any}
                      />
                    </div>
                  </details>
                )}

                {item.actionType === "product_upload" && Array.isArray(item.payload.rows) && (
                  <details className="mt-1">
                    <summary className="text-xs text-blue-600 cursor-pointer select-none">
                      View rows ({(item.payload.rows as unknown[]).length})
                    </summary>
                    <div
                      className="mt-2"
                      style={{ width: "100%", maxHeight: "260px", overflow: "auto" }}
                    >
                      <UploadProductDiffTable rows={item.payload.rows as any} />
                    </div>
                  </details>
                )}

                {item.actionType === "supplier_upload" && Array.isArray(item.payload.rows) && (
                  <details className="mt-1">
                    <summary className="text-xs text-blue-600 cursor-pointer select-none">
                      View rows ({(item.payload.rows as unknown[]).length})
                    </summary>
                    <div
                      className="mt-2"
                      style={{ width: "100%", maxHeight: "260px", overflow: "auto" }}
                    >
                      <UploadSupplierDiffTable rows={item.payload.rows as any} />
                    </div>
                  </details>
                )}

                <p className="text-xs text-gray-500 whitespace-pre-wrap">{item.message || "—"}</p>
                <p className="text-xs text-gray-500">{item.requesterName}</p>
                <p className="text-xs text-gray-400">{formatWhen(item.createdAt)}</p>
                <p className="text-xs font-medium text-gray-700">{item.status}</p>
                {pending ? (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={actionLoadingId === item.id}
                      onClick={() => handleApprove(item.id)}
                    >
                      <Check className="h-4 w-4 mr-1" /> Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      disabled={actionLoadingId === item.id}
                      onClick={() => openReject(item.id)}
                    >
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                ) : item.status === "Approved" ? (
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <Check className="h-5 w-5" /> Approved
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600 text-sm">
                    <X className="h-5 w-5" /> Rejected
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>Optional note to the requester (shown in audit).</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea
              value={rejectRemarks}
              onChange={(e) => setRejectRemarks(e.target.value)}
              rows={3}
              placeholder="Reason for rejection…"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitReject} disabled={!!actionLoadingId}>
              Confirm reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
