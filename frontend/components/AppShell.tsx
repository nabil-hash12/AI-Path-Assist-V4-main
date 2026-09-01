"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import Sidebar from "@/components/Sidebar";
import { Role } from "@/lib/types";

export default function AppShell({
  children,
  allow,
}: {
  children: ReactNode;
  allow?: Role[];
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (allow && !allow.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, loading, allow, router]);

  if (loading || !user || (allow && !allow.includes(user.role))) {
    return (
      <div className="min-h-dvh w-full flex items-center justify-center bg-background text-on-surface-variant">
        <div className="flex items-center gap-sm font-body-md">
          <span className="material-symbols-outlined animate-spin">progress_activity</span>
          Loading secure session…
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background text-on-surface">
      <Sidebar />
      {/* No left margin on small/medium screens — the nav is an off-canvas
          drawer there. From lg up it's a permanent rail, so content is
          pushed over to make room for it. */}
      <div className="flex-grow flex flex-col min-h-dvh w-full lg:ml-72 min-w-0">{children}</div>
    </div>
  );
}
