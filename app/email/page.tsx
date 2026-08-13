"use client";

import { Suspense } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { useWallpaper } from "@/contexts/WallpaperContext";
import { EmailShell } from "@/components/email/email-shell";
import { Loader2 } from "lucide-react";

export default function EmailPage() {
  const { theme } = useTheme();
  const { wallpaper } = useWallpaper();
  const isEngineer = theme === "engineer";

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      {/* ── DESKTOP HEADER ── */}
      <div className="hidden md:flex flex-col gap-3 px-6 pt-6 pb-3 shrink-0 bg-white/80 backdrop-blur-md border-b">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Email</h1>
        </div>
      </div>

      {/* ── MOBILE HEADER ── */}
      <div className="md:hidden shrink-0 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 pt-5 pb-3">
        <h1 className="text-lg font-bold text-gray-900">Email</h1>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className={`flex flex-1 min-h-0 w-full overflow-hidden ${
        isEngineer && !wallpaper ? "engineer-blueprint-bg" : ""
      }`}>
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        }>
          <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
            <EmailShell />
          </div>
        </Suspense>
      </div>
    </div>
  );
}

