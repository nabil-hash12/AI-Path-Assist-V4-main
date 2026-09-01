"use client";

import { ReactNode } from "react";

export default function Modal({
  open,
  onClose,
  title,
  children,
  icon = "info",
  widthClass = "max-w-lg",
  bodyClassName = "p-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  icon?: string;
  widthClass?: string;
  bodyClassName?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative glass-panel bg-surface-container rounded-xl border border-surface-container-highest shadow-2xl w-full ${widthClass} max-h-[90dvh] flex flex-col overflow-hidden`}
      >
        <div className="flex items-center justify-between px-lg py-md border-b border-outline-variant flex-shrink-0">
          <div className="flex items-center gap-sm min-w-0">
            <span className="material-symbols-outlined text-primary flex-shrink-0">{icon}</span>
            <h2 className="font-headline-sm text-headline-sm text-on-surface truncate">{title}</h2>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className={`${bodyClassName} overflow-y-auto min-h-0`}>{children}</div>
      </div>
    </div>
  );
}
