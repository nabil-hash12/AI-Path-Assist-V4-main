const STYLES: Record<string, string> = {
  Completed: "bg-secondary-container/20 text-secondary border border-secondary-container/40",
  Processing: "bg-primary-container/20 text-primary border border-primary-container/40",
  Failed: "bg-error-container/20 text-error border border-error/40",
  "Pending Review": "bg-tertiary-container/20 text-tertiary border border-tertiary-container/40",
  Queued: "bg-surface-variant text-on-surface-variant border border-outline-variant",
  Active: "text-secondary",
  Invited: "text-on-surface-variant",
};

export default function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium font-data-mono ${
        STYLES[status] ?? "bg-surface-variant text-on-surface-variant border border-outline-variant"
      }`}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 14 }}
      >
        {status === "Completed" || status === "Active"
          ? "check_circle"
          : status === "Failed"
          ? "error"
          : status === "Processing"
          ? "autorenew"
          : "schedule"}
      </span>
      {status}
    </span>
  );
}
