"use client";

import { useState } from "react";
import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";
import Toggle from "@/components/Toggle";
import { ThemeToggleSegmented } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const { user } = useAuth();
  const [twoFA, setTwoFA] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [autoLock, setAutoLock] = useState(true);

  return (
    <AppShell>
      <TopBar title="Settings" showSearch={false} showExport={false} />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[800px] mx-auto flex flex-col gap-lg">
          <section className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg">
            <h2 className="font-headline-sm mb-md">Account</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="flex flex-col gap-1">
                <span className="font-label-caps text-on-surface-variant">Full Name</span>
                <span className="text-on-surface font-medium">{user?.name}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-label-caps text-on-surface-variant">Institutional Email</span>
                <span className="text-on-surface font-medium font-data-mono text-sm">{user?.email}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-label-caps text-on-surface-variant">Role</span>
                <span className="text-on-surface font-medium capitalize">{user?.role.replace("_", " ")}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-label-caps text-on-surface-variant">Institution</span>
                <span className="text-on-surface font-medium">{user?.institution}</span>
              </div>
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg flex flex-col gap-md">
            <h2 className="font-headline-sm">Appearance</h2>
            <div className="flex items-center justify-between flex-wrap gap-md">
              <div>
                <p className="text-on-surface font-medium">Theme</p>
                <p className="text-on-surface-variant text-sm">Choose how AI-Path Assist looks on this device.</p>
              </div>
              <ThemeToggleSegmented />
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg flex flex-col gap-md">
            <h2 className="font-headline-sm">Security</h2>
            <div className="flex items-center justify-between border-b border-outline-variant pb-md">
              <div>
                <p className="text-on-surface font-medium">Two-Factor Authentication</p>
                <p className="text-on-surface-variant text-sm">Require a verification code at every login.</p>
              </div>
              <Toggle id="settings-2fa" checked={twoFA} onChange={setTwoFA} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-on-surface font-medium">Auto-lock idle sessions</p>
                <p className="text-on-surface-variant text-sm">Lock the workspace after 15 minutes of inactivity.</p>
              </div>
              <Toggle id="settings-autolock" checked={autoLock} onChange={setAutoLock} />
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg flex flex-col gap-md">
            <h2 className="font-headline-sm">Notifications</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-on-surface font-medium">Email on batch completion</p>
                <p className="text-on-surface-variant text-sm">Get notified when a queued batch finishes processing.</p>
              </div>
              <Toggle id="settings-email" checked={emailNotif} onChange={setEmailNotif} />
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </AppShell>
  );
}
