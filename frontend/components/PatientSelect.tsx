// components/PatientSelect.tsx
import { useState, useRef, useEffect } from "react";

interface Patient {
  id: string;
  patientId: string;
  patientName: string;
}

interface PatientSelectProps {
  value: string | null;                 // selected patient id
  onChange: (patientId: string) => void;
  patients: Patient[];
  disabled?: boolean;
  placeholder?: string;
}

export default function PatientSelect({
  value,
  onChange,
  patients,
  disabled = false,
  placeholder = "Select patient…",
}: PatientSelectProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const selectedPatient = patients.find((p) => p.id === value);

  // Filter patients by ID or name
  const filtered = patients.filter(
    (p) =>
      p.patientId.toLowerCase().includes(query.toLowerCase()) ||
      p.patientName.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (patientId: string) => {
    onChange(patientId);
    setIsOpen(false);
    setQuery("");
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative min-w-[200px]">
      {/* Trigger */}
      <div
        className={`bg-surface border border-outline-variant rounded px-2 py-1 text-sm text-on-surface cursor-pointer flex items-center justify-between ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className="truncate">
          {selectedPatient
            ? `${selectedPatient.patientId} · ${selectedPatient.patientName}`
            : placeholder}
        </span>
        <span
          className="material-symbols-outlined text-on-surface-variant"
          style={{ fontSize: 16 }}
        >
          expand_more
        </span>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full bg-surface border border-outline-variant rounded shadow-lg max-h-60 overflow-auto">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search patients…"
            className="w-full px-2 py-1 border-b border-outline-variant bg-surface text-sm focus:outline-none"
            autoFocus
          />
          {filtered.length === 0 ? (
            <div className="px-2 py-1 text-sm text-on-surface-variant">
              No patients found
            </div>
          ) : (
            filtered.map((p) => (
              <div
                key={p.id}
                className={`px-2 py-1 text-sm cursor-pointer hover:bg-surface-container-highest ${
                  p.id === value ? "bg-surface-container-highest" : ""
                }`}
                onClick={() => handleSelect(p.id)}
              >
                {p.patientId} · {p.patientName}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}