"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";
import { ThemeToggleIcon } from "@/components/ThemeToggle";

export default function TopBar({
  title,
  showSearch = true,
  showExport = true,
  onExport,
  exporting = false,
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search patient ID...",
}: {
  title: string;
  showSearch?: boolean;
  showExport?: boolean;
  onExport?: () => void;
  exporting?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const { openMobile } = useSidebar();
  const [shareState, setShareState] = useState<"idle" | "copied" | "error">("idle");
  const initials = (user?.name ?? "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `AI-Path Assist — ${title}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState("copied");
      setTimeout(() => setShareState("idle"), 2000);
    } catch {
      // User cancelled navigator.share, or clipboard write failed.
      try {
        await navigator.clipboard.writeText(url);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
      } catch {
        setShareState("error");
        setTimeout(() => setShareState("idle"), 2000);
      }
    }
  };

  return (
    <header className="bg-surface/80 backdrop-blur-md sticky top-0 z-30 border-b border-outline-variant flex justify-between items-center w-full px-margin h-16 flex-shrink-0">
      <div className="flex items-center gap-md min-w-0">
        <button
          onClick={openMobile}
          className="lg:hidden p-xs -ml-xs text-on-surface-variant hover:text-on-surface rounded-DEFAULT hover:bg-surface-container-high flex-shrink-0"
          aria-label="Open navigation"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <h1 className="font-headline-md text-headline-md text-on-surface font-semibold tracking-tight truncate">{title}</h1>
      </div>
      <div className="flex items-center gap-lg">
        {showSearch && (
          <div className="relative hidden lg:block">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant" style={{ fontSize: 18 }}>
              search
            </span>
            <input
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="bg-surface-container border border-outline-variant rounded-DEFAULT py-xs pl-xl pr-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none w-64 placeholder-on-surface-variant transition-colors"
              placeholder={searchPlaceholder}
              type="text"
            />
          </div>
        )}
        <div className="flex items-center gap-sm">
          <ThemeToggleIcon />
          <button
            onClick={handleShare}
            title={shareState === "copied" ? "Link copied!" : shareState === "error" ? "Couldn't copy link" : "Share this page"}
            className="p-xs text-on-surface-variant hover:text-primary transition-all rounded-DEFAULT hover:bg-surface-container-high relative"
          >
            <span className="material-symbols-outlined">
              {shareState === "copied" ? "check" : shareState === "error" ? "error" : "ios_share"}
            </span>
          </button>
          <button
            onClick={() => router.push("/settings")}
            title="Settings"
            className="p-xs text-on-surface-variant hover:text-primary transition-all rounded-DEFAULT hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>
        {showExport && (
          <button
            onClick={onExport}
            disabled={exporting}
            title="Export patient &amp; AI analysis data as CSV"
            className="bg-primary text-on-primary px-md py-xs rounded-DEFAULT font-body-md font-medium hover:opacity-90 transition-opacity flex items-center gap-xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className={`material-symbols-outlined ${exporting ? "animate-spin" : ""}`} style={{ fontSize: 18 }}>
              {exporting ? "progress_activity" : "download"}
            </span>
            {exporting ? "Exporting…" : "Export"}
          </button>
        )}
        <div className="w-9 h-9 rounded-full bg-surface-container-highest border border-outline-variant overflow-hidden flex items-center justify-center text-xs font-bold text-primary">
          {initials}
        </div>
      </div>
    </header>
  );
}
