"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { Role } from "@/lib/types";
import { api } from "@/lib/api";
import { ThemeToggleIcon } from "@/components/ThemeToggle";

const STEPS = ["Identity", "Credentials", "Security"];

export default function RegisterPage() {
  const { applySession } = useAuth();
  const [step, setStep] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    npi: "",
    role: "pathologist" as Role,
    institution: "",
    password: "",
    hipaaAck: false,
  });
  const [otpMode, setOtpMode] = useState(false);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [approvalPending, setApprovalPending] = useState(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = () => {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => { if (c <= 1) { clearInterval(cooldownRef.current!); return 0; } return c - 1; });
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.npi || !form.institution || !form.password) {
      setError("Fill in every field to continue registration.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!form.hipaaAck) {
      setError("You must acknowledge the HIPAA compliance terms to register.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post<{ pending?: boolean; _devOtp?: string }>(
        "/api/auth/register",
        { name: form.fullName, email: form.email, password: form.password, role: form.role, institution: form.institution }
      );
      setRegisteredEmail(form.email);
      if (res._devOtp) setOtpCode(res._devOtp.split(""));
      setOtpMode(true);
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpCode.join("");
    if (otp.length < 6) { setError("Enter the full 6-digit code sent to your email."); return; }
    setError("");
    setVerifying(true);
    try {
      const res = await api.post<{
        token?: string;
        user?: import("@/lib/types").SessionUser;
        pending?: boolean;
        approvalPending?: boolean;
        message?: string;
      }>("/api/auth/verify-otp", { email: registeredEmail, otp });
      if (res.approvalPending) {
        // Email confirmed, but the account still needs admin sign-off —
        // don't log the user in, show the "awaiting approval" screen.
        setApprovalPending(true);
      } else if (res.token && res.user) {
        applySession(res.token, res.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    try {
      const res = await api.post<{ _devOtp?: string }>("/api/auth/resend-otp", { email: registeredEmail });
      if (res._devOtp) setOtpCode(res._devOtp.split(""));
      startCooldown();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend code.");
    }
  };

  const handleOtpChange = (i: number, v: string) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otpCode]; next[i] = v; setOtpCode(next);
    if (v && i < 5) document.getElementById(`reg-otp-${i + 1}`)?.focus();
  };

  const update = (key: keyof typeof form, value: string | boolean) => setForm((f) => ({ ...f, [key]: value }));
  const passwordStrength = form.password.length === 0 ? 0 : form.password.length < 6 ? 1 : form.password.length < 10 ? 2 : 4;
  const strengthLabel = ["No password", "Weak", "Medium Strength", "Good", "Strong Strength"][passwordStrength];

  return (
    <div className="min-h-dvh flex items-center justify-center font-body-md p-margin pb-16">
      <ThemeToggleIcon className="!fixed top-4 right-4 z-20 bg-surface-container-lowest border border-outline-variant shadow-sm" />
      {approvalPending ? (
        <main className="w-full max-w-md bg-surface-container rounded-xl p-xl shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary mb-md">
            <span className="material-symbols-outlined" style={{ fontSize: 32 }}>hourglass_top</span>
          </div>
          <h2 className="font-headline-md mb-2">Awaiting Admin Approval</h2>
          <p className="font-body-md text-on-surface-variant mb-lg">
            Your email is verified and your registration has been sent to your institution&apos;s administrator.
            You&apos;ll receive an email at <strong>{registeredEmail}</strong> as soon as your account is approved,
            and you&apos;ll be able to sign in from that point on.
          </p>
          <Link
            href="/login"
            className="w-full inline-flex justify-center items-center gap-sm bg-primary text-on-primary rounded-DEFAULT py-sm font-headline-sm hover:bg-primary-fixed transition-colors"
          >
            Return to Login
          </Link>
        </main>
      ) : otpMode ? (
        <main className="w-full max-w-md bg-surface-container rounded-xl p-xl shadow-2xl">
          <div className="flex flex-col items-center text-center mb-lg">
            <div className="w-16 h-16 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary mb-md">
              <span className="material-symbols-outlined" style={{ fontSize: 32 }}>mark_email_read</span>
            </div>
            <h2 className="font-headline-md mb-1">Verify Your Email</h2>
            <p className="font-body-md text-on-surface-variant">We sent a 6-digit code to <strong>{registeredEmail}</strong>. It expires in 10 minutes.</p>
          </div>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span> {error}
            </div>
          )}
          <div className="flex justify-center gap-2 sm:gap-3 mb-lg">
            {otpCode.map((d, i) => (
              <input
                key={i}
                id={`reg-otp-${i}`}
                maxLength={1}
                value={d}
                onChange={(e) => handleOtpChange(i, e.target.value)}
                onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) document.getElementById(`reg-otp-${i - 1}`)?.focus(); }}
                className="w-11 h-14 bg-surface border border-outline-variant rounded-lg text-center font-data-mono text-xl text-on-surface focus:border-primary outline-none transition-all"
                inputMode="numeric"
                autoFocus={i === 0}
              />
            ))}
          </div>
          <button
            onClick={handleVerifyOtp}
            disabled={verifying}
            className="w-full bg-primary text-on-primary rounded-DEFAULT py-sm font-headline-sm hover:bg-primary-fixed transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-sm"
          >
            {verifying ? "Verifying…" : "Verify Email"}
            {!verifying && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>}
          </button>
          <div className="flex justify-between text-sm mt-sm">
            <button onClick={() => setOtpMode(false)} className="text-on-surface-variant hover:text-on-surface">← Back</button>
            <button onClick={handleResendOtp} disabled={resendCooldown > 0} className="text-primary hover:text-primary-fixed font-medium disabled:opacity-50">
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        </main>
      ) : (
      <main className="w-full max-w-[600px] glass-panel bg-surface-container rounded-xl p-xl shadow-2xl relative overflow-hidden">
        <div className="absolute top-[-50px] left-[-50px] w-64 h-64 bg-secondary opacity-10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-50px] right-[-50px] w-64 h-64 bg-primary opacity-5 blur-[80px] rounded-full pointer-events-none" />

        <div className="flex flex-col items-center mb-xl text-center z-10 relative">
          <div className="inline-flex items-center gap-sm bg-surface-container-high px-md py-xs rounded-full border border-secondary mb-lg">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>verified_user</span>
            <span className="font-label-caps text-secondary uppercase tracking-widest">Secure Portal</span>
          </div>
          <h1 className="font-display text-display text-on-surface mb-xs">AI-Path Assist</h1>
          <p className="font-body-lg text-on-surface-variant">Clinical Pathology Registration</p>
        </div>

        <div className="flex justify-between items-center mb-xl px-md relative">
          <div className="absolute left-md right-md h-[2px] bg-surface-container-highest top-1/2 -translate-y-1/2 z-0" />
          <div
            className="absolute left-md h-[2px] bg-primary top-1/2 -translate-y-1/2 z-0 transition-all"
            style={{ width: `calc(${(step / (STEPS.length - 1)) * 100}% - ${step === STEPS.length - 1 ? 0 : 0}px)`, right: step === STEPS.length - 1 ? "1rem" : undefined }}
          />
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-col items-center gap-xs z-10 relative">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  i < step
                    ? "bg-primary border-surface text-on-primary"
                    : i === step
                    ? "bg-surface-container-high border-primary text-primary font-headline-sm"
                    : "bg-surface-container-highest border-outline-variant text-on-surface-variant font-headline-sm"
                }`}
              >
                {i < step ? <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span> : i + 1}
              </div>
              <span className={`font-label-caps ${i <= step ? "text-primary" : "text-on-surface-variant"}`}>{label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
            {error}
          </div>
        )}

        <form className="space-y-lg relative z-10" onSubmit={handleSubmit}>
          {step === 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div className="flex flex-col gap-xs">
                  <label className="font-label-caps text-on-surface-variant" htmlFor="fullName">Full Name (Legal)</label>
                  <input id="fullName" className="input-outline bg-surface border border-outline-variant text-on-surface rounded px-md py-sm font-body-md" placeholder="Dr. Jane Doe" value={form.fullName} onChange={(e) => update("fullName", e.target.value)} />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="font-label-caps text-on-surface-variant" htmlFor="instEmail">Institutional Email</label>
                  <input id="instEmail" type="email" className="input-outline bg-surface border border-outline-variant text-on-surface rounded px-md py-sm font-body-md" placeholder="jane.doe@hospital.edu" value={form.email} onChange={(e) => update("email", e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-xs mt-md">
                <label className="font-label-caps text-on-surface-variant" htmlFor="institution">Institution Name</label>
                <input id="institution" className="input-outline bg-surface border border-outline-variant text-on-surface rounded px-md py-sm font-body-md" placeholder="General Hospital Pathology Dept" value={form.institution} onChange={(e) => update("institution", e.target.value)} />
              </div>
            </>
          )}

          {step === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
              <div className="flex flex-col gap-xs">
                <label className="font-label-caps text-on-surface-variant" htmlFor="npi">Medical License / NPI</label>
                <input id="npi" className="input-outline bg-surface border border-outline-variant text-on-surface rounded px-md py-sm font-data-mono" placeholder="1234567890" value={form.npi} onChange={(e) => update("npi", e.target.value)} />
              </div>
              <div className="flex flex-col gap-xs">
                <label className="font-label-caps text-on-surface-variant" htmlFor="role">Primary Role</label>
                <select id="role" className="input-outline bg-surface border border-outline-variant text-on-surface rounded px-md py-sm font-body-md" value={form.role} onChange={(e) => update("role", e.target.value)}>
                  <option value="pathologist">Pathologist</option>
                  <option value="lab_tech">Lab Technician</option>
                  <option value="researcher">Researcher</option>
                </select>
              </div>
            </div>
          )}

          {step === 2 && (
            <>
              <div className="flex flex-col gap-xs">
                <label className="font-label-caps text-on-surface-variant" htmlFor="password">Create Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="input-outline bg-surface border border-outline-variant text-on-surface rounded px-md py-sm font-body-md w-full pr-xl"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-md top-1/2 -translate-y-1/2 text-outline hover:text-on-surface">
                    <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
                <div className="mt-2">
                  <div className="flex gap-1 h-1 w-full mb-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className={`flex-1 ${i < passwordStrength ? "bg-secondary" : "bg-surface-container-highest"} ${i === 0 ? "rounded-l-full" : ""} ${i === 3 ? "rounded-r-full" : ""}`} />
                    ))}
                  </div>
                  <p className="font-label-caps text-secondary text-right">{strengthLabel}</p>
                </div>
              </div>
              <div className="p-md bg-surface-container-low border border-outline-variant rounded flex items-start gap-md mt-lg">
                <div className="pt-1">
                  <input id="hipaa" type="checkbox" className="w-4 h-4" checked={form.hipaaAck} onChange={(e) => update("hipaaAck", e.target.checked)} />
                </div>
                <div className="flex flex-col gap-xs">
                  <label className="font-headline-sm text-[14px] leading-tight text-on-surface cursor-pointer" htmlFor="hipaa">HIPAA Compliance &amp; Terms of Service</label>
                  <p className="font-body-md text-[12px] leading-relaxed text-on-surface-variant">
                    I acknowledge that I am accessing a secure clinical system. I agree to handle all Patient Health Information (PHI) in accordance with HIPAA regulations and institution policy.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="pt-md flex flex-col gap-md">
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(s + 1, STEPS.length - 1))}
                className="w-full bg-primary hover:bg-primary-fixed-dim text-on-primary font-headline-sm py-sm rounded transition-colors flex justify-center items-center gap-sm"
              >
                Continue Registration
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-primary hover:bg-primary-fixed-dim text-on-primary font-headline-sm py-sm rounded transition-colors flex justify-center items-center gap-sm disabled:opacity-60"
              >
                {submitting ? "Creating account..." : "Complete Registration"}
                {!submitting && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check</span>}
              </button>
            )}
            {step > 0 && (
              <button type="button" onClick={() => setStep((s) => s - 1)} className="text-center font-label-caps text-on-surface-variant hover:text-on-surface transition-colors">
                Back
              </button>
            )}
            <Link href="/login" className="text-center font-label-caps text-primary hover:text-primary-fixed-dim underline transition-colors">
              Return to Login
            </Link>
          </div>
        </form>
      </main>
      )}
    </div>
  );
}
