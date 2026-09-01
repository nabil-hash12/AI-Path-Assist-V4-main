"use client";

import { createContext, useContext, useMemo, useState, ReactNode, useCallback } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

interface SidebarContextValue {
  /** Whether the off-canvas nav drawer is open on small/medium screens. */
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer automatically on navigation so it never lingers open
  // over the new page on mobile.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);

  const value = useMemo(
    () => ({ mobileOpen, openMobile, closeMobile, toggleMobile }),
    [mobileOpen, openMobile, closeMobile, toggleMobile]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider");
  return ctx;
}
