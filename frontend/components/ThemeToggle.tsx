"use client";

import { ThemePreference, useTheme } from "@/lib/theme-context";

const ICONS: Record<ThemePreference, string> = {
  light: "light_mode",
  dark: "dark_mode",
  system: "brightness_auto",
};

const LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const CYCLE: ThemePreference[] = ["light", "dark", "system"];

/**
 * Compact icon button for headers/toolbars — click cycles
 * Light → Dark → System → Light… Shows the currently applied appearance.
 */
export function ThemeToggleIcon({ className = "" }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleClick = () => {
    const next = CYCLE[(CYCLE.indexOf(theme) + 1) % CYCLE.length];
    setTheme(next);
  };

  return (
    <button
      onClick={handleClick}
      title={`Appearance: ${LABELS[theme]}${theme === "system" ? ` (${resolvedTheme})` : ""} — click to change`}
      aria-label="Toggle color theme"
      className={`p-xs text-on-surface-variant hover:text-primary transition-all rounded-DEFAULT hover:bg-surface-container-high ${className}`}
    >
      <span className="material-symbols-outlined">{ICONS[theme]}</span>
    </button>
  );
}

/**
 * Three-way segmented control (Light / Dark / System) for Settings pages
 * where the user wants explicit, discoverable control.
 */
export function ThemeToggleSegmented() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="inline-flex items-center rounded-DEFAULT border border-outline-variant bg-surface-container overflow-hidden">
      {CYCLE.map((option) => {
        const active = theme === option;
        return (
          <button
            key={option}
            onClick={() => setTheme(option)}
            aria-pressed={active}
            className={`flex items-center gap-xs px-md py-sm text-sm font-medium transition-colors ${
              active ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
              {ICONS[option]}
            </span>
            {LABELS[option]}
          </button>
        );
      })}
    </div>
  );
}
