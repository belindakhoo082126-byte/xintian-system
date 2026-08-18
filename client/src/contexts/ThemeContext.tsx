import React, { createContext, useContext, useEffect, useState } from "react";

/**
 * XLCS Design System — Admin Theme Types
 * - "nature" = 🌿 Xintian Nature (default light, sage green / cream)
 * - "dark"   = 🌙 Dark Mode (deep forest-night)
 *
 * The mall has its own independent theme system and does NOT use this context.
 * All admin/packing/AI/customer-tracking pages share this theme globally.
 */
type AdminTheme = "nature" | "dark";

interface ThemeContextType {
  theme: AdminTheme;
  setTheme: (theme: AdminTheme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const STORAGE_KEY = "xlcs-admin-theme";

export function ThemeProvider({
  children,
  defaultTheme = "nature",
}: {
  children: React.ReactNode;
  defaultTheme?: AdminTheme;
}) {
  const [theme, setThemeState] = useState<AdminTheme>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "nature" || stored === "dark") return stored;
    }
    return defaultTheme;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const setTheme = (t: AdminTheme) => setThemeState(t);
  const toggleTheme = () => setThemeState(prev => (prev === "nature" ? "dark" : "nature"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
