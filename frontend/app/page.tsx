'use client';

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
import { ThemeToggleIcon } from "@/components/ThemeToggle";

const CAPABILITIES = [
  {
    icon: "biotech",
    title: "Dual-Branch ViT Inference",
    body: "Multi-magnification Vision Transformer models predict IHC biomarker expression directly from H&E whole-slide images.",
    tone: "text-secondary bg-secondary/10",
  },
  {
    icon: "visibility",
    title: "Explainable Visualizers",
    body: "Real-time Grad-CAM heatmap overlays for transparent diagnostics and peer review.",
    tone: "text-secondary bg-secondary/10",
  },
  {
    icon: "lock",
    title: "HIPAA-Compliant Security",
    body: "End-to-end encryption and enforced 2FA securing PHI at rest and in transit.",
    tone: "text-tertiary bg-tertiary/10",
  },
  {
    icon: "account_tree",
    title: "Seamless Integration",
    body: "Native DICOM, TIFF, and PNG support with robust asynchronous batch processing pipelines.",
    tone: "text-primary-container bg-primary-container/10",
  },
];

const ROLES = [
  { icon: "medical_information", title: "Pathologists", tone: "text-primary", body: "Enhance diagnostic accuracy with AI-assisted insights, triage critical cases faster, and conduct rapid, confident case reviews." },
  { icon: "biotech", title: "Lab Technicians", tone: "text-secondary", body: "Automate slide ingestion and seamlessly batch process high-resolution whole slide images (WSI) with zero-touch workflows." },
  { icon: "admin_panel_settings", title: "Administrators", tone: "text-tertiary", body: "Monitor system usage telemetry, enforce strict HIPAA compliance policies, and manage granular role-based access controls." },
];

export default function LandingPage() {
  const [consultForm, setConsultForm] = useState({ firstName: "", lastName: "", email: "" });
  const [consultError, setConsultError] = useState("");
  const [consultSubmitted, setConsultSubmitted] = useState(false);

  const handleConsultSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consultForm.firstName.trim() || !consultForm.lastName.trim() || !consultForm.email.trim()) {
      setConsultError("Please fill in your name and institutional email.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(consultForm.email)) {
      setConsultError("Please enter a valid email address.");
      return;
    }
    setConsultError("");
    setConsultSubmitted(true);
  };

  return (
    <div className="flex flex-col min-h-dvh">
      <motion.header
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="flex items-center justify-between whitespace-nowrap border-b border-surface-container-highest px-10 py-3 bg-surface sticky top-0 z-50"
      >
        <div className="flex items-center gap-4 text-primary">
          <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
            biotech
          </span>
          <h2 className="text-on-surface text-lg font-bold leading-tight tracking-[-0.015em]">AI-Path Assist</h2>
        </div>
        <div className="flex flex-1 justify-end gap-8">
          <nav className="hidden md:flex items-center gap-9">
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium" href="#capabilities">Capabilities</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium" href="#roles">Roles</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium" href="#security">Security</a>
            <a className="text-on-surface-variant hover:text-primary transition-colors text-sm font-medium" href="#contact">Contact</a>
          </nav>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Link
              href="/login"
              className="flex min-w-[84px] items-center justify-center rounded h-10 px-4 bg-primary-container hover:bg-primary transition-colors text-on-primary-container text-sm font-bold"
            >
              Login
            </Link>
          </motion.div>
          <ThemeToggleIcon />
        </div>
      </motion.header>

      <main className="flex-1 flex flex-col w-full max-w-[1200px] mx-auto px-4 md:px-8">
        <section className="py-16 md:py-24">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
            <motion.div
              initial={{ opacity: 0, x: -60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="flex flex-col gap-6 lg:w-1/2"
            >
              <h1 className="text-on-surface text-4xl font-black leading-tight tracking-[-0.033em] md:text-5xl lg:text-6xl">
                Precision Pathology at Scale
              </h1>
              <p className="text-on-surface-variant text-base md:text-lg max-w-xl leading-relaxed">
                AI-Path Assist is a multi-modal clinical pathology intelligence platform: dual-branch Vision Transformers
                predict IHC biomarker expression from H&amp;E images, with Grad-CAM explainability built in for every call.
              </p>
              <div className="flex gap-4">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link href="/register" className="rounded h-12 px-6 bg-primary text-on-primary font-bold flex items-center hover:bg-primary-fixed transition-colors">
                    Request Access
                  </Link>
                </motion.div>
                <a href="#capabilities" className="rounded h-12 px-6 border border-outline-variant text-on-surface font-bold flex items-center hover:bg-surface-container-high transition-colors">
                  Explore Capabilities
                </a>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:w-1/2 flex items-center justify-center"
            >
              <div className="w-full aspect-video rounded-2xl border border-surface-container-highest bg-surface-container flex items-center justify-center relative overflow-hidden">
                <span className="z-10">
                  <Image
                    src="/Image/Home.png"
                    alt="VIM-Polyp"
                    width={550}
                    height={30}
                    className="object-contain"
                  />
                </span>
              </div>
            </motion.div>
          </div>
        </section>

        <section className="py-16 border-t border-surface-container-low" id="capabilities">
          <div className="text-center mb-12">
            <h2 className="text-on-surface text-3xl md:text-4xl font-bold">
              Core Capabilities
            </h2>

            <p className="text-on-surface-variant text-lg mt-4 max-w-3xl mx-auto">
              AI-Path Assist combines advanced Vision Transformers, explainable AI,
              enterprise-grade security, and seamless integration to deliver accurate,
              scalable, and trustworthy digital pathology solutions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CAPABILITIES.map((c, index) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.15,
                }}
                whileHover={{
                  y: -8,
                  scale: 1.03,
                }}
                className="flex flex-col gap-4 rounded-xl border border-surface-container-highest bg-surface-container p-6"
              >
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${c.tone}`}>
                  <span className="material-symbols-outlined text-2xl">{c.icon}</span>
                </div>
                <div className="flex flex-col gap-2">
                  <h3 className="text-on-surface text-lg font-semibold leading-tight">{c.title}</h3>
                  <p className="text-on-surface-variant text-sm leading-relaxed">{c.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="py-16 border-t border-surface-container-low" id="roles">
          <div className="flex flex-col gap-12">
            <div className="flex flex-col gap-4 text-center">
              <h2 className="text-on-surface text-3xl font-bold leading-tight md:text-4xl">Built for Healthcare Teams</h2>
              <p className="text-on-surface-variant text-base max-w-2xl mx-auto">
                Streamlined workflows optimized for every member of your pathology department.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {ROLES.map((r, index) => (
                <motion.div
                  key={r.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{
                    duration: 0.5,
                    delay: index * 0.2,
                  }}
                  whileHover={{
                    y: -8,
                    scale: 1.03,
                  }}
                  className="flex flex-col items-center text-center gap-4 bg-surface-container-lowest p-8 rounded-2xl border border-surface-container-highest"
                >
                  <div className="w-16 h-16 rounded-full bg-surface-container flex items-center justify-center mb-2">
                    <span className={`material-symbols-outlined text-3xl ${r.tone}`}>{r.icon}</span>
                  </div>
                  <h3 className="text-on-surface text-xl font-bold">{r.title}</h3>
                  <p className="text-on-surface-variant text-sm">{r.body}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <motion.section
          id="security"
          className="py-16 border-t border-surface-container-low"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
        >
          <div className="bg-surface-container rounded-3xl p-8 md:p-12 border border-surface-container-highest relative overflow-hidden">
            <div className="absolute -right-20 -top-20 opacity-10 pointer-events-none text-primary">
              <span className="material-symbols-outlined" style={{ fontSize: 300 }}>verified_user</span>
            </div>
            <div className="relative z-10 flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1 flex flex-col gap-6">
                <h2 className="text-on-surface text-3xl font-bold leading-tight md:text-4xl">Institutional Trust &amp; Security</h2>
                <p className="text-on-surface-variant text-lg leading-relaxed">
                  Adhering to the highest standards of data integrity and patient privacy. Our infrastructure is designed
                  from the ground up for the rigorous demands of enterprise healthcare.
                </p>
                <div className="flex flex-col gap-4 mt-4">
                  {["SOC 2 Type II Certified Data Centers", "Strict HIPAA & GDPR Regulatory Compliance", "Cryptographic Validation of Diagnostic Reports"].map((t) => (
                    <div key={t} className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-secondary">check_circle</span>
                      <span className="text-on-surface font-medium">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="w-full md:w-1/3 flex justify-center">
                <div className="w-64 h-64 rounded-full border-4 border-surface-container-highest shadow-lg bg-surface-container-lowest flex items-center justify-center overflow-hidden">
                  <motion.div
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                    }}
                  >
                    <Image
                      src="/Image/security.png"
                      alt="Security"
                      width={220}
                      height={220}
                      className="object-contain"
                    />
                  </motion.div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>
      </main>

      <motion.footer
        id="contact"
        className="bg-surface-container-lowest border-t border-surface-container-highest mt-auto py-16"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 flex flex-col md:flex-row justify-between gap-12">
          <div className="flex flex-col gap-4 md:w-1/2">
            <div className="flex items-center gap-4 text-primary">
              <span className="material-symbols-outlined" style={{ fontSize: 32 }}>
                biotech
              </span>
              <h2 className="text-on-surface text-lg font-bold leading-tight tracking-[-0.015em]">AI-Path Assist</h2>
            </div>
            <p className="text-on-surface-variant text-sm max-w-md">
              Transforming pathology workflows with secure, scalable, and explainable artificial intelligence.
            </p>
            <div className="mt-4 text-xs text-outline font-data-mono">© 2026 AI-Path Systems. All rights reserved.</div>
          </div>
          <div className="md:w-1/2 bg-surface-container p-6 rounded-xl border border-surface-container-highest">
            <h3 className="text-on-surface text-lg font-bold mb-4">Request a Consultation</h3>
            {consultSubmitted ? (
              <div className="flex flex-col items-center text-center gap-2 py-4">
                <span className="material-symbols-outlined text-secondary" style={{ fontSize: 32 }}>check_circle</span>
                <p className="text-on-surface font-medium">Thanks, {consultForm.firstName}!</p>
                <p className="text-on-surface-variant text-sm">
                  We&apos;ll reach out to {consultForm.email} to schedule your consultation.
                </p>
              </div>
            ) : (
              <form className="flex flex-col gap-4" onSubmit={handleConsultSubmit}>
                {consultError && (
                  <div className="flex items-center gap-2 rounded-md border border-error/40 bg-error-container/10 px-3 py-2 text-xs text-error">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                    {consultError}
                  </div>
                )}
                <div className="flex gap-4">
                  <input
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-md px-4 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="First Name"
                    type="text"
                    value={consultForm.firstName}
                    onChange={(e) => setConsultForm((f) => ({ ...f, firstName: e.target.value }))}
                  />
                  <input
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-md px-4 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                    placeholder="Last Name"
                    type="text"
                    value={consultForm.lastName}
                    onChange={(e) => setConsultForm((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
                <input
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-md px-4 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                  placeholder="Institutional Email"
                  type="email"
                  value={consultForm.email}
                  onChange={(e) => setConsultForm((f) => ({ ...f, email: e.target.value }))}
                />
                <button className="w-full bg-primary text-on-primary rounded-md px-4 py-2 text-sm font-bold mt-2 hover:bg-primary-fixed transition-colors" type="submit">
                  Submit Request
                </button>
              </form>
            )}
          </div>
        </div>
      </motion.footer>
    </div>
  );
}