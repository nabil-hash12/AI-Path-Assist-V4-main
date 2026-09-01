import { ReactNode } from "react";

export default function MetricCard({
  label,
  value,
  icon,
  footnote,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  icon: string;
  footnote?: string;
  tone?: "primary" | "secondary" | "error" | "neutral";
}) {
  const toneClass = {
    primary: "text-primary",
    secondary: "text-secondary",
    error: "text-error",
    neutral: "text-on-surface-variant",
  }[tone];

  return (
    <div className="flex flex-col gap-sm bg-surface-container rounded-xl border border-surface-container-highest p-lg">
      <div className="flex items-center justify-between">
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase tracking-wider">{label}</span>
        <span className="material-symbols-outlined text-on-surface-variant opacity-60">{icon}</span>
      </div>
      <span className="font-display text-3xl font-bold text-on-surface">{value}</span>
      {footnote && <span className={`font-data-mono text-xs ${toneClass}`}>{footnote}</span>}
    </div>
  );
}
