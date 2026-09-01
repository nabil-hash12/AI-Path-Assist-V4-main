"use client";

export default function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  id: string;
}) {
  return (
    <div className="relative inline-block w-10 h-6 align-middle select-none">
      <input
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-2 border-outline-variant appearance-none cursor-pointer z-10 top-0.5 left-0.5 transition-all duration-200"
        id={id}
        type="checkbox"
      />
      <label
        className="toggle-label block overflow-hidden h-6 rounded-full bg-surface-container cursor-pointer border border-outline-variant transition-colors"
        htmlFor={id}
      />
    </div>
  );
}
