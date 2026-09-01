"use client";

import { useState } from "react";
import Modal from "./Modal";

export default function Footer({ offset = true }: { offset?: boolean }) {
  const [open, setOpen] = useState<"encryption" | "privacy" | null>(null);

  return (
    <>
      <footer
        className={`bg-surface-container-lowest border-t border-outline-variant flex justify-between items-center px-lg py-xs z-30 ${
          offset ? "sticky bottom-0 left-0 w-full" : "w-full"
        }`}
      >
        <span className="font-label-caps text-label-caps text-on-surface-variant">HIPAA Compliant Session</span>
        <div className="flex gap-lg">
          <button
            type="button"
            onClick={() => setOpen("encryption")}
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-opacity"
          >
            Encrypted Connection
          </button>
          <button
            type="button"
            onClick={() => setOpen("privacy")}
            className="font-label-caps text-label-caps text-on-surface-variant hover:text-primary transition-opacity"
          >
            Privacy Policy
          </button>
        </div>
      </footer>

      <Modal open={open === "encryption"} onClose={() => setOpen(null)} title="Encrypted Connection" icon="lock">
        <div className="flex flex-col gap-md text-sm text-on-surface-variant">
          <p>
            This session is served over TLS, so traffic between your browser and AI-Path Assist is encrypted in transit.
          </p>
          <ul className="flex flex-col gap-sm">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>check_circle</span>
              <span>Session tokens are JWT-based and expire automatically after 12 hours.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>check_circle</span>
              <span>Passwords are hashed with bcrypt and never stored in plain text.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>check_circle</span>
              <span>Two-factor authentication (email OTP) is required at every login.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>check_circle</span>
              <span>Tumor board share links are token-based and expire automatically after 72 hours.</span>
            </li>
          </ul>
          <p className="text-xs text-on-surface-variant/80 font-data-mono">
            This is a demo/academic build. Production HIPAA compliance would additionally require encryption at rest,
            BAAs with hosting providers, and formal access review processes — see Admin → Compliance &amp; Policy.
          </p>
        </div>
      </Modal>

      <Modal open={open === "privacy"} onClose={() => setOpen(null)} title="Privacy Policy" icon="privacy_tip">
        <div className="flex flex-col gap-md text-sm text-on-surface-variant">
          <p>
            AI-Path Assist processes patient health information (PHI) solely to support pathology review and diagnostic
            reporting for the institution operating this instance.
          </p>
          <ul className="flex flex-col gap-sm">
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>info</span>
              <span>Access to patient records is restricted by role (Admin, Pathologist, Lab Technician, Researcher).</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>info</span>
              <span>Researchers only see specimen data within admin-approved queue-access date ranges.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>info</span>
              <span>Every clinically significant action is written to an immutable audit log, visible to administrators.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>info</span>
              <span>Slide images and generated reports are retained for the case's lifetime unless deleted by an administrator.</span>
            </li>
          </ul>
          <p className="text-xs text-on-surface-variant/80 font-data-mono">
            For questions about how your institution handles PHI under this deployment, contact Technical Support.
          </p>
        </div>
      </Modal>
    </>
  );
}
