// Small dependency-free CSV helpers used by every "Export" button in the app.
// Keeping this in one place means every export produces consistently
// escaped, Excel-friendly CSV (UTF-8 BOM + CRLF line endings).

export type CSVCell = string | number | boolean | null | undefined;

/** Escape a single field per RFC 4180: wrap in quotes if it contains a
 * comma, quote, or newline, and double up any embedded quotes. */
function escapeCSVField(value: CSVCell): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Build a full CSV string (header row + data rows) from plain arrays. */
export function buildCSV(headers: string[], rows: CSVCell[][]): string {
  const lines = [headers.map(escapeCSVField).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCSVField).join(","));
  }
  return lines.join("\r\n");
}

/** Trigger a browser download of the given CSV content. */
export function downloadCSV(filename: string, csvContent: string) {
  // Leading BOM so Excel opens UTF-8 CSVs (e.g. patient names with accents)
  // without mangling the characters.
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Turn an AI biomarker metrics array into one readable summary cell, e.g.
 * "Ki-67 Index: 42 % [Elevated] | p53 Status: Positive [High]". */
export function summarizeMetrics(
  metrics: { label: string; value: string; unit?: string; tag?: string }[] | undefined | null
): string {
  if (!metrics || metrics.length === 0) return "";
  return metrics
    .map((m) => `${m.label}: ${m.value}${m.unit ? ` ${m.unit}` : ""}${m.tag ? ` [${m.tag}]` : ""}`)
    .join(" | ");
}

/** Timestamp suffix for export filenames, e.g. "2026-08-26_1142". */
export function exportTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}
