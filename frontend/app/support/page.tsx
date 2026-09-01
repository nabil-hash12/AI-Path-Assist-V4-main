"use client";

import AppShell from "@/components/AppShell";
import TopBar from "@/components/TopBar";
import Footer from "@/components/Footer";

const FAQS = [
  { q: "Why did a slide fail ingestion?", a: "Corrupted DICOM/TIFF headers are the most common cause — re-export the slide from your scanner software and re-upload it to the Queue." },
  { q: "How is the Grad-CAM overlay generated?", a: "It's produced by the dual-branch ViT-B/16 inference service at report time, highlighting the regions most influential to each biomarker score." },
  { q: "Can I share a case outside my institution?", a: "Tumor Board Share creates a view-only, encrypted, time-boxed link — external reviewers never get edit access to the original slide." },
  { q: "Who can see the audit log?", a: "Administrators only. It's an immutable record of every clinically significant action for HIPAA compliance." },
];

export default function SupportPage() {
  return (
    <AppShell>
      <TopBar title="Support" showSearch={false} showExport={false} />
      <main className="flex-grow p-xl overflow-y-auto">
        <div className="max-w-[800px] mx-auto flex flex-col gap-lg">
          <section className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg">
            <h2 className="font-headline-sm mb-md">Frequently Asked Questions</h2>
            <div className="flex flex-col divide-y divide-outline-variant">
              {FAQS.map((f) => (
                <details key={f.q} className="py-md group">
                  <summary className="cursor-pointer font-medium text-on-surface flex items-center justify-between">
                    {f.q}
                    <span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
                  </summary>
                  <p className="text-on-surface-variant text-sm mt-2">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          <section className="bg-surface-container-lowest border border-surface-container-highest rounded-xl p-lg flex flex-col gap-md">
            <h2 className="font-headline-sm">Contact Technical Support</h2>
            <p className="text-on-surface-variant text-sm">Our clinical systems team responds within 1 business hour for HIPAA-critical issues.</p>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-on-surface-variant">Email: <span className="font-data-mono text-on-surface">rnicrosoftr@gmail.com</span></span>
              <span className="text-on-surface-variant">On-call line: <span className="font-data-mono text-on-surface">+880 (0) 1575375639</span></span>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </AppShell>
  );
}
