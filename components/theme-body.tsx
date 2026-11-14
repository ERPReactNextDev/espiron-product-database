"use client";

import { useTheme } from "@/contexts/ThemeContext";
import { GeistSans, GeistMono } from "geist/font";

export function ThemeBody({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  const themeClass =
    theme === "comic"
      ? "comic font-comic"
      : theme === "engineer"
        ? "engineer font-engineer"
        : theme === "christmas"
          ? "christmas font-formal"
          : "formal font-formal";

  return (
    <body
      className={`
        ${GeistSans.variable}
        ${GeistMono.variable}
        ${themeClass}
        antialiased
        min-h-svh
        overscroll-none
      `}
    >
      {children}
    </body>
  );
}
