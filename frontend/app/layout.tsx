import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { PatientsProvider } from "@/lib/patients-context";
import { SocketProvider } from "@/lib/socket-context";
import { ThemeProvider } from "@/lib/theme-context";
import { SidebarProvider } from "@/lib/sidebar-context";

export const metadata: Metadata = {
  title: "AI-Path Assist | Precision Pathology at Scale",
  description: "Multi-modal clinical pathology intelligence platform — AI-assisted IHC biomarker prediction, Grad-CAM explainability, and secure diagnostic workflows.",
};

// Runs before React hydrates so the correct theme class is on <html> from
// the very first paint — avoids a flash of the wrong theme on load.
const NO_FLASH_THEME_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('aipath.theme');
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored === 'dark' || (stored !== 'light' && systemDark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-on-background min-h-dvh">
        <ThemeProvider>
          <AuthProvider>
            <SocketProvider>
              <PatientsProvider>
                <SidebarProvider>{children}</SidebarProvider>
              </PatientsProvider>
            </SocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
