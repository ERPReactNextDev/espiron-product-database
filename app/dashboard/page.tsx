// app/dashboard/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { useNotifications } from "@/contexts/NotificationContext";
import { useTheme } from "@/contexts/ThemeContext";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { collection, query, where, getCountFromServer } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { supabase } from "@/utils/supabase";
import { ImageIcon, X, Upload, Trash2, CheckCircle2 } from "lucide-react";

type UserData = {
  Firstname: string;
  Lastname: string;
  Role: string;
};

export default function Dashboard() {
  const router = useRouter();
  const { userId } = useUser();
  const { wallpaper, opacity, setWallpaper, setOpacity } = useWallpaper();
  const { unreadCount } = useNotifications();
  const { theme } = useTheme();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [themeOpen, setThemeOpen] = useState(false);
  const isComic = theme === "comic";
  const isEngineer = theme === "engineer";

  const [totalProducts, setTotalProducts]   = useState<number | null>(null);
  const [totalSuppliers, setTotalSuppliers] = useState<number | null>(null);
  const [totalSPF, setTotalSPF]             = useState<number | null>(null);

  /* ── Auth guard ── */
  useEffect(() => {
    if (userId === null) return;
    if (!userId) { window.location.href = "/login"; }
  }, [userId]);

  /* ── Fetch user ── */
  useEffect(() => {
    if (!userId) return;
    fetch(`/api/users?id=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => setUser({ Firstname: d.Firstname ?? "", Lastname: d.Lastname ?? "", Role: d.Role ?? "" }))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  /* ── Fetch counts ── */
  useEffect(() => {
    if (!userId) return;

    async function fetchCounts() {
      try {
        const [prodSnap, suppSnap] = await Promise.all([
          getCountFromServer(query(collection(db, "products"),  where("isActive", "==", true))),
          getCountFromServer(query(collection(db, "suppliers"), where("isActive", "==", true))),
        ]);
        setTotalProducts(prodSnap.data().count);
        setTotalSuppliers(suppSnap.data().count);

        const { count } = await supabase
          .from("spf_request")
          .select("*", { count: "exact", head: true });
        setTotalSPF(count ?? 0);
      } catch (err) {
        console.error("fetchCounts error:", err);
      }
    }

    fetchCounts();
  }, [userId]);

  const metrics: {
    key: string;
    label: string;
    value: number | null;
    color: string;
    badge?: number;
  }[] = [
    { key: "products",  label: "Total Products",  value: totalProducts,  color: "#378ADD" },
    { key: "suppliers", label: "Total Suppliers",  value: totalSuppliers, color: "#1D9E75" },
    { key: "requests",  label: "SPF Requests",     value: totalSPF,       color: "#BA7517", badge: unreadCount },
  ];

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* ── DESKTOP HEADER ── */}
      <div className={`hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white ${
        isComic ? "border-b-4 border-gray-800" : isEngineer ? "border-b-4 border-gray-800" : "border-b border-gray-200"
      }`}>
        <SidebarTrigger />
        <div className="flex items-center justify-between">
          <h1 className={`text-3xl ${
            isComic
              ? "font-comic-title comic-text-shadow text-gray-900"
              : isEngineer
              ? "font-engineer-title engineer-text-shadow text-orange-600"
              : "font-formal-title text-gray-900"
          }`}>
            {loading ? "Loading..." : user ? (
              <>
                {isComic && "👋 "}{isEngineer && "👷 "}Welcome, {user.Firstname} {user.Lastname}
                <span className={`ml-2 text-sm ${isComic ? "text-gray-600 font-comic" : isEngineer ? "text-gray-700 font-engineer" : "text-gray-600 font-formal"}`}>
                  ({user.Role})
                </span>
              </>
            ) : "Welcome"}
          </h1>
        </div>
      </div>

      {/* ── MOBILE HEADER ── */}
      <div className={`md:hidden shrink-0 bg-white px-4 pt-5 pb-3 ${
        isComic ? "border-b-4 border-gray-800" : isEngineer ? "border-b-4 border-gray-800" : "border-b border-gray-200"
      }`}>
        <div className="flex items-center justify-between">
          <h1 className={`text-xl ${
            isComic
              ? "font-comic-title comic-text-shadow text-gray-900"
              : isEngineer
              ? "font-engineer-title engineer-text-shadow text-orange-600"
              : "font-formal-title text-gray-900"
          }`}>
            {loading ? "Loading..." : user ? (
              <>
                {isComic && "👋 "}{isEngineer && "👷 "}Welcome, {user.Firstname}
                <span className={`ml-2 text-xs ${isComic ? "text-gray-600 font-comic" : isEngineer ? "text-gray-700 font-engineer" : "text-gray-600 font-formal"}`}>
                  ({user.Role})
                </span>
              </>
            ) : "Welcome"}
          </h1>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className={`flex-1 overflow-auto p-6 space-y-6 pb-20 md:pb-6 ${
        isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
      }`}>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {metrics.map(({ key, label, value, color, badge }) => (
          <button
            key={key}
            onClick={() => router.push(`/${key}`)}
            className={`p-5 space-y-3 text-left relative group ${
              isComic
                ? "comic-card comic-hover-lift"
                : isEngineer
                ? "engineer-card engineer-hover-lift"
                : "formal-card hover:shadow-lg transition-shadow"
            }`}
            style={{ background: 'white' }}
          >
            {/* Notification badge */}
            {badge !== undefined && badge > 0 && (
              <span className={`absolute -top-2 -right-2 z-10 min-w-7 h-7 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${
                isComic
                  ? "bg-yellow-400 text-gray-900 font-comic border-3 border-gray-800 shadow-[3px_3px_0px_#2d3436] comic-animate-bounce"
                  : isEngineer
                  ? "bg-orange-500 text-white font-engineer border-3 border-gray-800 shadow-[3px_3px_0px_#2c3e50] engineer-animate-wiggle"
                  : "bg-red-600 text-white font-formal shadow-md"
              }`}>
                {badge > 99 ? "99+" : badge}
              </span>
            )}

            <div className="flex items-center gap-3">
              <span
                className={`inline-block w-4 h-4 rounded-lg shrink-0 ${
                  isComic
                    ? "border-2 border-gray-800 shadow-[2px_2px_0px_#2d3436]"
                    : "border border-gray-300"
                }`}
                style={{ backgroundColor: color }}
              />
              <p className={`text-sm font-bold text-gray-600 ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
                {label}
              </p>
            </div>
            <p className={`text-4xl text-gray-900 group-hover:scale-105 transition-transform ${
              isComic ? "font-comic-title comic-text-shadow" : isEngineer ? "font-engineer-title engineer-text-stencil" : "font-formal-title"
            }`}>
              {value === null
                ? <span className={`text-gray-400 text-2xl ${isComic ? "comic-animate-pulse" : ""}`}>
                    {isComic ? "⚡" : isEngineer ? "🔧" : "..."}
                  </span>
                : value.toLocaleString()
              }
            </p>
            <p className={`text-xs text-gray-500 ${isComic ? "font-comic" : isEngineer ? "font-engineer" : "font-formal"}`}>
              {isComic ? "Click to explore! 🚀" : isEngineer ? "Click to explore! 🏗️" : "Click to explore"}
            </p>
          </button>
        ))}
      </div>

      {/* ── Customize Theme Button ── */}
      <button
        onClick={() => setThemeOpen(true)}
        className={`flex items-center gap-2.5 px-5 py-3 bg-linear-to-r from-blue-400 to-purple-400 text-white ${
          isComic
            ? "comic-button font-comic"
            : isEngineer
            ? "engineer-button font-engineer"
            : "font-formal rounded-md shadow-sm hover:shadow-md transition-shadow"
        }`}
      >
        <ImageIcon className="h-5 w-5" />
        <span>{isComic ? "Customize Wallpaper 🎨" : isEngineer ? "Customize Wallpaper 🔧" : "Customize Wallpaper"}</span>
        {wallpaper && (
          <span className={`ml-1 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
            isComic
              ? "bg-green-400 text-gray-900 border-2 border-gray-800 font-comic"
              : isEngineer
              ? "bg-orange-500 text-white border-2 border-gray-800 font-engineer"
              : "bg-green-500 text-white font-formal"
          }`}>
            <CheckCircle2 className="h-3 w-3" />
            Active!
          </span>
        )}
      </button>

      {/* ── Wallpaper Modal ── */}
      {themeOpen && (
        <WallpaperModal
          current={wallpaper}
          currentOpacity={opacity}
          onSave={(b64, op) => { setWallpaper(b64); setOpacity(op); }}
          onClose={() => setThemeOpen(false)}
        />
      )}
      </div>
    </div>
  );
}

/* ── Wallpaper Upload Modal ── */
function WallpaperModal({
  current,
  currentOpacity,
  onSave,
  onClose,
}: {
  current: string | null;
  currentOpacity: number;
  onSave: (b64: string | null, opacity: number) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const isComic = theme === "comic";
  const isEngineer = theme === "engineer";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(current);
  const [opacity, setOpacityLocal] = useState<number>(currentOpacity);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_MB = 10;

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (JPG, PNG, WEBP, etc.)");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Image must be under ${MAX_MB}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleApply = () => {
    onSave(preview, opacity);
    onClose();
  };

  const handleSaveRemove = () => {
    onSave(null, opacity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className={`w-full max-w-md overflow-hidden relative ${
        isComic ? "comic-card" : isEngineer ? "engineer-card" : "bg-white rounded-lg shadow-2xl"
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 ${
          isComic
            ? "bg-linear-to-r from-yellow-300 to-orange-300 border-b-3 border-gray-800"
            : isEngineer
            ? "bg-linear-to-r from-orange-500 to-yellow-400 border-b-4 border-gray-800"
            : "bg-linear-to-r from-red-600 to-red-800 border-b border-red-700"
        }`}>
          <div>
            <h2 className={`text-xl ${
              isComic
                ? "font-comic-title text-gray-900 comic-text-outline"
                : isEngineer
                ? "font-engineer-title text-white engineer-text-shadow"
                : "font-formal-title text-white"
            }`}>
              {isComic ? "🎨 Customize Wallpaper" : isEngineer ? "🔧 Customize Wallpaper" : "Customize Wallpaper"}
            </h2>
            <p className={`text-xs mt-0.5 ${
              isComic ? "font-comic text-gray-700" : isEngineer ? "font-engineer text-yellow-200" : "font-formal text-red-100"
            }`}>
              Saved locally on this device only
            </p>
          </div>
          <button
            onClick={onClose}
            className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
              isComic
                ? "bg-white border-3 border-gray-800 shadow-[3px_3px_0px_#2d3436] hover:shadow-[2px_2px_0px_#2d3436] hover:translate-x-px hover:translate-y-px"
                : isEngineer
                ? "bg-white border-3 border-gray-800 shadow-[3px_3px_0px_#2c3e50] hover:shadow-[2px_2px_0px_#2c3e50] hover:translate-x-px hover:translate-y-px"
                : "bg-white/20 hover:bg-white/30 text-white"
            }`}
          >
            <X className={`h-5 w-5 ${isComic || isEngineer ? "text-gray-800" : "text-white"}`} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">

          {/* Preview */}
          {preview ? (
            <div className="relative rounded-xl overflow-hidden border border-gray-200 aspect-video bg-white">
              <img
                src={preview}
                alt="Wallpaper preview"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity }}
              />
              <div className="absolute inset-0 bg-white" style={{ opacity: 1 - opacity }} />
              <div className="absolute inset-0 flex flex-col items-start justify-end p-3 gap-1.5">
                <div className="h-2 w-24 rounded-full bg-gray-300/80" />
                <div className="h-2 w-16 rounded-full bg-gray-200/80" />
              </div>
              <button
                onClick={() => setPreview(null)}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
              <span className="absolute top-2 left-3 text-xs text-white/90 font-medium drop-shadow">Preview</span>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-200
                ${dragging
                  ? "border-gray-400 bg-gray-50 scale-[1.01]"
                  : "border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100"
                }
              `}
            >
              <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center mb-3">
                <Upload className="h-5 w-5 text-gray-500" />
              </div>
              <p className="text-sm font-medium text-gray-700">
                {dragging ? "Drop image here" : "Upload wallpaper"}
              </p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP — max {MAX_MB}MB</p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />

          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

          {/* Opacity slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-semibold text-gray-600 ${isComic ? "" : isEngineer ? "font-engineer" : "font-formal"}`}>Opacity</label>
              <span className={`text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md ${isComic ? "" : isEngineer ? "font-engineer" : "font-formal"}`}>
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={opacity}
              onChange={(e) => setOpacityLocal(parseFloat(e.target.value))}
              className={`w-full h-1.5 rounded-full appearance-none cursor-pointer ${
                isComic ? "bg-gray-200 accent-gray-800" : isEngineer ? "bg-gray-200 accent-orange-600" : "bg-gray-200 accent-red-600"
              }`}
            />
            <div className={`flex justify-between text-[10px] text-gray-400 ${isComic ? "" : isEngineer ? "font-engineer" : "font-formal"}`}>
              <span>Subtle</span>
              <span>Full</span>
            </div>
          </div>

          {preview && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-9 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Change Image
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex gap-3">
          {current && (
            <button
              onClick={handleSaveRemove}
              className={`flex items-center gap-1.5 px-4 h-12 text-white text-sm ${
                isComic
                  ? "comic-button bg-red-400 font-comic"
                  : isEngineer
                  ? "engineer-button bg-red-500 font-engineer"
                  : "bg-red-500 hover:bg-red-600 font-formal rounded-md shadow-sm transition-colors"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              {isComic ? "Remove 🗑️" : isEngineer ? "Remove 🗑️" : "Remove"}
            </button>
          )}
          <button
            onClick={onClose}
            className={`flex-1 h-12 text-sm ${
              isComic
                ? "comic-button bg-gray-200 text-gray-800 font-comic"
                : isEngineer
                ? "engineer-button bg-gray-200 text-gray-800 font-engineer"
                : "bg-gray-100 hover:bg-gray-200 text-gray-700 font-formal rounded-md shadow-sm transition-colors"
            }`}
          >
            {isComic ? "Cancel ✖️" : isEngineer ? "Cancel ✖️" : "Cancel"}
          </button>
          <button
            onClick={handleApply}
            disabled={!preview}
            className={`flex-1 h-12 text-white text-sm disabled:opacity-50 ${
              isComic
                ? "comic-button bg-linear-to-r from-green-400 to-emerald-400 font-comic"
                : isEngineer
                ? "engineer-button bg-green-600 font-engineer"
                : "bg-green-600 hover:bg-green-700 font-formal rounded-md shadow-sm transition-colors"
            }`}
          >
            {preview
              ? (isComic ? "Apply! ✅" : isEngineer ? "Apply! ✅" : "Apply")
              : (isComic ? "Upload First 📤" : isEngineer ? "Upload First 📤" : "Upload First")
            }
          </button>
        </div>
      </div>
    </div>
  );
}
