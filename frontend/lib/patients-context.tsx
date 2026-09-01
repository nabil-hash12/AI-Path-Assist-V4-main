"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from "react";
import { CaseNote, Gender, PatientCase, UploadStatus } from "./types";
import { api } from "./api";
import { useSocket } from "./socket-context";

export interface NewPatientInput {
  patientId?: string;
  patientName: string;
  age: number;
  gender: Gender;
  specimenType: string;
  assignedTo?: string;
}

interface UploadResult {
  jobId: string;
  case: PatientCase;
}

interface PatientsContextValue {
  patients: PatientCase[];
  loading: boolean;
  refresh: () => Promise<void>;
  getById: (id: string) => PatientCase | undefined;
  fetchById: (id: string) => Promise<PatientCase | undefined>;
  addPatient: (input: NewPatientInput) => Promise<PatientCase>;
  updateBasicInfo: (id: string, info: { patientName?: string; age?: number; gender?: Gender }) => Promise<void>;
  updateCaseRecord: (id: string, fields: Partial<Pick<PatientCase, "specimenType" | "assignedTo" | "status" | "diagnosisStatus">>) => Promise<void>;
  addNote: (id: string, note: Omit<CaseNote, "id" | "time">) => Promise<void>;
  uploadScans: (id: string, files: FileList | File[]) => Promise<UploadResult[]>;
  setUploadStatus: (id: string, status: UploadStatus) => Promise<void>;
  approveReport: (id: string) => Promise<void>;
  removePatient: (id: string) => Promise<void>;
}

const PatientsContext = createContext<PatientsContextValue | undefined>(undefined);

export function PatientsProvider({ children }: { children: ReactNode }) {
  const [patients, setPatients] = useState<PatientCase[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<{ cases: PatientCase[] }>("/api/cases");
      setPatients(res.cases);
    } catch {
      // If unauthenticated or backend unreachable, leave list empty; pages
      // that require auth will redirect via AppShell.
    } finally {
      setLoading(false);
    }
  }, []);

  const { onCasesChanged } = useSocket();

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Real-time: when any case changes (status update, new analysis, etc.)
  // refresh just that case in the list so the UI reflects the latest state
  // immediately without a full page reload.
  useEffect(() => {
    const off = onCasesChanged(({ caseCode }) => {
      fetchById(caseCode).catch(() => {});
    });
    return off;
  }, [onCasesChanged]);

  const getById = (id: string) => patients.find((p) => p.id === id);

  const fetchById = async (id: string) => {
    try {
      const res = await api.get<{ case: PatientCase }>(`/api/cases/${id}`);
      setPatients((prev) => {
        const exists = prev.some((p) => p.id === id);
        return exists ? prev.map((p) => (p.id === id ? res.case : p)) : [res.case, ...prev];
      });
      return res.case;
    } catch {
      return undefined;
    }
  };

  const addPatient: PatientsContextValue["addPatient"] = async (input) => {
    const res = await api.post<{ case: PatientCase }>("/api/cases", input);
    setPatients((prev) => [res.case, ...prev]);
    return res.case;
  };

  const updateBasicInfo: PatientsContextValue["updateBasicInfo"] = async (id, info) => {
    const res = await api.patch<{ case: PatientCase }>(`/api/cases/${id}/basic-info`, info);
    setPatients((prev) => prev.map((p) => (p.id === id ? res.case : p)));
  };

  const updateCaseRecord: PatientsContextValue["updateCaseRecord"] = async (id, fields) => {
    const res = await api.patch<{ case: PatientCase }>(`/api/cases/${id}/record`, fields);
    setPatients((prev) => prev.map((p) => (p.id === id ? res.case : p)));
  };

  const addNote: PatientsContextValue["addNote"] = async (id, note) => {
    const res = await api.post<{ case: PatientCase }>(`/api/cases/${id}/notes`, { text: note.text });
    setPatients((prev) => prev.map((p) => (p.id === id ? res.case : p)));
  };

  const uploadScans: PatientsContextValue["uploadScans"] = async (id, files) => {
    const results: UploadResult[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.upload<UploadResult>(`/api/cases/${id}/images`, formData);
      results.push(res);
      setPatients((prev) => prev.map((p) => (p.id === id ? res.case : p)));
    }
    return results;
  };

  const setUploadStatus: PatientsContextValue["setUploadStatus"] = async (id, status) => {
    const res = await api.patch<{ case: PatientCase }>(`/api/cases/${id}/upload-status`, { uploadStatus: status });
    setPatients((prev) => prev.map((p) => (p.id === id ? res.case : p)));
  };

  const approveReport: PatientsContextValue["approveReport"] = async (id) => {
    const res = await api.post<{ case: PatientCase }>(`/api/cases/${id}/approve-report`);
    setPatients((prev) => prev.map((p) => (p.id === id ? res.case : p)));
  };

  const removePatient: PatientsContextValue["removePatient"] = async (id) => {
    await api.delete(`/api/cases/${id}`);
    setPatients((prev) => prev.filter((p) => p.id !== id));
  };

  const value = useMemo(
    () => ({
      patients, loading, refresh, getById, fetchById, addPatient, updateBasicInfo, updateCaseRecord,
      addNote, uploadScans, setUploadStatus, approveReport, removePatient,
    }),
    [patients, loading]
  );

  return <PatientsContext.Provider value={value}>{children}</PatientsContext.Provider>;
}

export function usePatients() {
  const ctx = useContext(PatientsContext);
  if (!ctx) throw new Error("usePatients must be used within PatientsProvider");
  return ctx;
}
