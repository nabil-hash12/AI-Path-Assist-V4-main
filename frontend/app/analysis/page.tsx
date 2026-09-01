"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import StatusChip from "@/components/StatusChip";
import { usePatients } from "@/lib/patients-context";
import { useAuth } from "@/lib/auth-context";

export default function AnalysisListPage() {
  const router = useRouter();
  const { patients, loading } = usePatients();
  const { user } = useAuth();
  const isResearcher = user?.role === "researcher";
  const [query, setQuery] = useState("");

  const filtered = patients.filter(
    (c) =>
      c.patientId.toLowerCase().includes(query.toLowerCase()) ||
      c.patientName.toLowerCase().includes(query.toLowerCase()) ||
      c.specimenType.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AppShell allow={["admin", "pathologist", "researcher"]}>
      <TopBar
        title="Analysis"
        showExport={false}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search patient ID, name, or specimen..."
      />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[1200px] mx-auto flex flex-col gap-lg">
          <p className="text-on-surface-variant">
            {isResearcher
              ? "Specimens within your admin-approved queue-access date ranges are listed below."
              : "Select a specimen to open the AI inference viewer and Grad-CAM explainability panel."}
          </p>

          {isResearcher && !loading && patients.length === 0 && (
            <div className="flex flex-col items-center text-center gap-md bg-surface-container-lowest border border-surface-container-highest rounded-xl p-xl">
              <div className="w-14 h-14 rounded-full bg-surface-container-highest flex items-center justify-center">
                <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 28 }}>lock_clock</span>
              </div>
              <div>
                <h3 className="font-headline-sm mb-1">No data available yet</h3>
                <p className="text-on-surface-variant text-sm max-w-md">
                  You don&apos;t have any approved queue-access date ranges, or no specimens fall within them. Request access
                  to a date range and, once an admin approves it, specimens from that range will appear here.
                </p>
              </div>
              <button
                onClick={() => router.push("/queue-access")}
                className="flex items-center gap-2 text-sm bg-primary text-on-primary rounded-DEFAULT px-md py-sm font-medium hover:bg-primary-fixed transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                Request Queue Access
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-lg">
            {patients.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/analysis/${c.id}`)}
                className="text-left flex flex-col gap-md bg-surface-container rounded-xl border border-surface-container-highest p-lg hover:border-primary/50 hover:bg-surface-container-high transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-data-mono text-primary text-sm">{c.id}</span>
                  <StatusChip status={c.status} />
                </div>
                <div>
                  <p className="font-semibold text-on-surface">{c.patientName}</p>
                  <p className="font-semibold text-on-surface">{c.patientId}</p>
                  <p className="text-on-surface-variant text-sm">{c.specimenType}</p>
                </div>
                <div className="flex items-center justify-between text-xs text-on-surface-variant font-data-mono pt-2 border-t border-outline-variant">
                  <span>{c.dateAdded}</span>
                  <span className="flex items-center gap-1 text-primary">
                    Open viewer
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </AppShell>
  );
}
