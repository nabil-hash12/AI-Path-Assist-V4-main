"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode, useCallback } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "aipath.theme";

interface ThemeContextValue {
  /** What the user picked — may be "system". */
  theme: ThemePreference;
  /** What's actually applied right now — always "light" or "dark". */
  resolvedTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
  /** Convenience: flips between light and dark (system → the opposite of
   * whatever system currently resolves to). */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyThemeClass(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initial state is only used for the very first client render before the
  // effect below runs — the inline script in <head> (see layout.tsx) has
  // already set the correct class on <html> synchronously, so there's no
  // flash regardless of what we start with here.
  const [theme, setThemeState] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("dark");

  // Read the persisted preference once on mount.
  useEffect(() => {
    let stored: ThemePreference = "system";
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      // localStorage unavailable (private mode, etc.) — fall back to system.
    }
    setThemeState(stored);
    const resolved: ResolvedTheme = stored === "system" ? (getSystemPrefersDark() ? "dark" : "light") : stored;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  // Track the OS-level preference so "system" stays live if the user
  // flips their OS theme while this tab is open.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolvedTheme(resolved);
      applyThemeClass(resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — theme just won't persist across reloads
    }
    const resolved: ResolvedTheme = next === "system" ? (getSystemPrefersDark() ? "dark" : "light") : next;
    setResolvedTheme(resolved);
    applyThemeClass(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [resolvedTheme, setTheme]);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme, toggleTheme }), [theme, resolvedTheme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
