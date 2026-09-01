"use client";

import { useState } from "react";
import Modal from "./Modal";
import { usePatients } from "@/lib/patients-context";
import { Gender } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";

export default function NewPatientModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated?: (id: string) => void }) {
  const { addPatient } = usePatients();
  const { user } = useAuth();
  const [form, setForm] = useState({
    patientId: "",
    patientName: "",
    age: "",
    gender: "Female" as Gender,
    specimenType: "",
    assignedTo: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const reset = () => setForm({ patientId: "", patientName: "", age: "", gender: "Female", specimenType: "", assignedTo: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.patientName.trim() || !form.age.trim()) {
      setError("Patient name and age are required.");
      return;
    }
    const ageNum = Number(form.age);
    if (Number.isNaN(ageNum) || ageNum <= 0) {
      setError("Enter a valid age.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const record = await addPatient({
        patientId: form.patientId || undefined,
        patientName: form.patientName.trim(),
        age: ageNum,
        gender: form.gender,
        specimenType: form.specimenType.trim() || "Unspecified",
        assignedTo: form.assignedTo.trim() || undefined,
      });
      reset();
      onCreated?.(record.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create patient record.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New Patient" icon="person_add">
      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
          {error}
        </div>
      )}
      <form className="flex flex-col gap-md" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Patient Name</span>
            <input
              className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface"
              placeholder="Fatima Islam"
              value={form.patientName}
              onChange={(e) => update("patientName", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Patient ID (optional)</span>
            <input
              className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface font-data-mono"
              placeholder="Auto-generated if blank"
              value={form.patientId}
              onChange={(e) => update("patientId", e.target.value)}
            />
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Age</span>
            <input
              type="number"
              min={0}
              className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface"
              placeholder="54"
              value={form.age}
              onChange={(e) => update("age", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-label-caps text-on-surface-variant">Gender</span>
            <select
              className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface"
              value={form.gender}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-on-surface-variant">Specimen Type</span>
          <input
            className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface"
            placeholder="Breast Tissue (Core Biopsy)"
            value={form.specimenType}
            onChange={(e) => update("specimenType", e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-label-caps text-on-surface-variant">Assign Pathologist (optional)</span>
          <input
            className="input-outline bg-surface border border-outline-variant rounded px-md py-sm text-on-surface"
            placeholder="Dr. Ashiqur Rahman"
            value={form.assignedTo}
            onChange={(e) => update("assignedTo", e.target.value)}
          />
        </label>
        <p className="text-xs text-on-surface-variant font-data-mono">Created by {user?.name ?? "current user"} · status set to Queued / Uploaded</p>
        <button type="submit" className="w-full bg-primary text-on-primary rounded-DEFAULT py-sm font-headline-sm hover:bg-primary-fixed transition-colors mt-2">
          Create Patient Record
        </button>
      </form>
    </Modal>
  );
}
