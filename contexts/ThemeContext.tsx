"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "app_theme";
export type Theme = "comic" | "formal" | "engineer" | "christmas";

export function isChristmasSeason(date: Date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return (
    (month === 11 && day >= 16) ||
    month === 12 ||
    (month === 1 && day <= 5)
  );
}

type ThemeContextType = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  isChristmasAvailable: boolean;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: "formal",
  setTheme: () => {},
  isChristmasAvailable: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("formal");
  const [isChristmasAvailable, setIsChristmasAvailable] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const syncThemeWithSeason = () => {
      const christmasAvailable = isChristmasSeason(new Date());
      setIsChristmasAvailable(christmasAvailable);

      try {
        const savedTheme = localStorage.getItem(STORAGE_KEY) as Theme | null;
        const isValidTheme =
          savedTheme === "comic" ||
          savedTheme === "formal" ||
          savedTheme === "engineer" ||
          savedTheme === "christmas";

        if (!christmasAvailable && savedTheme === "christmas") {
          localStorage.removeItem(STORAGE_KEY);
          setThemeState("formal");
        } else if (isValidTheme) {
          setThemeState(savedTheme);
        } else {
          setThemeState(christmasAvailable ? "christmas" : "formal");
        }
      } catch {
        setThemeState(christmasAvailable ? "christmas" : "formal");
      }

      setMounted(true);
    };

    syncThemeWithSeason();
    const intervalId = window.setInterval(syncThemeWithSeason, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const setTheme = (newTheme: Theme) => {
    const availableTheme =
      newTheme === "christmas" && !isChristmasSeason(new Date())
        ? "formal"
        : newTheme;
    setThemeState(availableTheme);
    try {
      localStorage.setItem(STORAGE_KEY, availableTheme);
    } catch {}
  };

  // Prevent hydration mismatch by rendering children only after mount
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: "formal", setTheme, isChristmasAvailable }}>
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isChristmasAvailable }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
