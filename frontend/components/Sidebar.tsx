"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/lib/sidebar-context";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: Array<"admin" | "pathologist" | "lab_tech" | "researcher">;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", roles: ["admin", "pathologist", "researcher"] },
  { href: "/analysis", label: "Queue", icon: "smb_share", roles: ["admin", "pathologist", "researcher"] },
  { href: "/queue", label: "Analysis", icon: "view_list", roles: ["admin", "pathologist", "lab_tech"] },
  { href: "/patients", label: "Patient Registry", icon: "groups", roles: ["admin", "pathologist", "lab_tech"] },
  { href: "/queue-access", label: "Queue Access", icon: "lock_clock", roles: ["researcher"] },
  { href: "/reports", label: "Reports", icon: "description", roles: ["admin", "pathologist"] },
  { href: "/admin", label: "Admin Control", icon: "admin_panel_settings", roles: ["admin"] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { mobileOpen, closeMobile } = useSidebar();
  const role = user?.role ?? "pathologist";
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const roleLabel =
    role === "admin" ? "Administrator Access" : role === "lab_tech" ? "Lab Technician Access" : role === "researcher" ? "Research Access" : "Pathologist Access";

  return (
    <>
      {/* Backdrop — only ever rendered while the drawer is open on <lg screens */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <nav
        className={`bg-surface w-72 h-dvh fixed left-0 top-0 border-r border-outline-variant flex flex-col py-lg px-md z-50 flex-shrink-0 transition-transform duration-200 ease-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="mb-xl flex items-center gap-sm px-xs">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: 30 }}>
            biotech
          </span>
          <div className="flex flex-col flex-grow min-w-0">
            <span className="font-display text-display font-semibold text-primary leading-tight" style={{ fontSize: 20 }}>
              AI-Path Assist
            </span>
            <span className="font-label-caps text-label-caps text-on-surface-variant">{roleLabel}</span>
          </div>
          <button
            onClick={closeMobile}
            className="lg:hidden p-xs text-on-surface-variant hover:text-on-surface rounded-DEFAULT hover:bg-surface-container-high flex-shrink-0"
            aria-label="Close navigation"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

      <ul className="flex flex-col gap-sm flex-grow">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-md px-md py-sm rounded-DEFAULT font-medium transition-colors ${
                  active
                    ? "text-primary font-bold border-r-2 border-primary bg-surface-container-low"
                    : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                }`}
              >
                <span
                  className="material-symbols-outlined"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-outline-variant pt-md flex flex-col gap-sm">
        <Link
          href="/settings"
          className="flex items-center gap-md px-md py-sm rounded-DEFAULT text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined">settings</span>
          <span>Settings</span>
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-md px-md py-sm rounded-DEFAULT text-on-surface-variant font-medium hover:bg-surface-container-high transition-colors"
        >
          <span className="material-symbols-outlined">help</span>
          <span>Support</span>
        </Link>
        <button
          onClick={logout}
          className="mt-sm flex items-center justify-center gap-sm px-md py-sm border border-outline-variant rounded-DEFAULT text-on-surface hover:bg-surface-container-high transition-colors w-full"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            logout
          </span>
          Logout
        </button>
      </div>
      </nav>
    </>
  );
}
