"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { SessionUser } from "@/lib/types";
import { api, ApiError } from "@/lib/api";
import { ThemeToggleIcon } from "@/components/ThemeToggle";

export default function LoginPage() {
  const { applySession } = useAuth();

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Step 1: send credentials → server sends OTP to registered email ──────
  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter your institutional email and password to continue.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post<{ pending: boolean; message: string; _devOtp?: string }>(
        "/api/auth/login",
        { email, password }
      );
      // In dev mode the server returns the OTP in the response so you can
      // log in without real Gmail credentials configured.
      if (res._devOtp) {
        setCode(res._devOtp.split(""));
        setInfo(`DEV MODE — code auto-filled: ${res._devOtp}`);
      } else {
        setInfo(res.message || `Verification code sent to ${email}`);
      }
      setStep("mfa");
      startResendCooldown();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 2: verify OTP → receive JWT → navigate ───────────────────────────
  const handleVerify = async () => {
    const otp = code.join("");
    if (otp.length < 6) {
      setError("Enter the full 6-digit verification code sent to your email.");
      return;
    }
    setError("");
    setVerifying(true);
    try {
      const res = await api.post<{ token: string; user: SessionUser }>("/api/auth/verify-otp", { email, otp });
      applySession(res.token, res.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Verification failed. Please try again.");
      setVerifying(false);
    }
  };

  // ── Resend OTP with 30-second cooldown ────────────────────────────────────
  const startResendCooldown = () => {
    setResendCooldown(30);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((c) => {
        if (c <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      const res = await api.post<{ ok: boolean; message: string; _devOtp?: string }>(
        "/api/auth/resend-otp",
        { email }
      );
      if (res._devOtp) {
        setCode(res._devOtp.split(""));
        setInfo(`DEV MODE — new code auto-filled: ${res._devOtp}`);
      } else {
        setInfo(res.message || "New code sent.");
      }
      startResendCooldown();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    if (value && index < 5) document.getElementById(`mfa-${index + 1}`)?.focus();
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) setCode(pasted.split(""));
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4">
      <header className="absolute top-0 left-0 w-full flex items-center justify-between p-4 sm:px-8 border-b border-surface-container-high bg-background/80 backdrop-blur-sm z-10">
        <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary-fixed transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          <span className="font-label-caps uppercase tracking-wider">Return to Main</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center text-on-primary-container">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>biotech</span>
          </div>
          <span className="font-headline-sm text-on-background tracking-tight">AI-Path Assist</span>
        </div>
        <div className="flex items-center gap-4">
          <a className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors text-sm font-medium" href="/support">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>help</span>
            <span className="hidden sm:inline">Technical Support</span>
          </a>
          <ThemeToggleIcon />
        </div>
      </header>

      <main className="w-full max-w-md mt-16">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 mb-6 rounded-full bg-surface-container-high border-2 border-primary/20 flex items-center justify-center shadow-lg">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 36 }}>biotech</span>
          </div>
          <h1 className="font-display text-display text-center mb-2">Secure Portal Login</h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container/20 border border-secondary-container/30 text-secondary-fixed">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified_user</span>
            <span className="font-label-caps">Two-Factor Authentication</span>
          </div>
        </div>

        <div className="bg-surface-container rounded-xl border border-surface-container-highest shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-secondary" />
          <div className="p-8">
            {error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-error/40 bg-error-container/10 px-3 py-2 text-sm text-error">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>error</span>
                {error}
              </div>
            )}
            {info && !error && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-secondary/40 bg-secondary-container/10 px-3 py-2 text-sm text-secondary">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>mail</span>
                {info}
              </div>
            )}

            {step === "credentials" ? (
              <form className="flex flex-col gap-6" onSubmit={handleContinue}>
                <div className="space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="font-body-md font-medium text-on-surface-variant">Institutional Email</span>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">mail</span>
                      <input
                        className="w-full h-12 bg-surface border border-outline-variant rounded-lg pl-10 pr-4 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/50 font-body-md"
                        placeholder="user@institution.edu"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                  </label>
                  <label className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-body-md font-medium text-on-surface-variant">Password</span>
                      <Link href="/forgot-password" className="text-sm text-primary font-medium hover:text-primary-fixed">Forgot password?</Link>
                    </div>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">lock</span>
                      <input
                        className="w-full h-12 bg-surface border border-outline-variant rounded-lg pl-10 pr-10 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/50 font-body-md"
                        placeholder="••••••••"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{showPassword ? "visibility" : "visibility_off"}</span>
                      </button>
                    </div>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 mt-2 bg-primary text-on-primary rounded-lg font-headline-sm hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>{submitting ? "Sending verification code…" : "Continue"}</span>
                  {!submitting && <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>}
                </button>

                {/* <p className="text-center text-xs text-on-surface-variant font-data-mono">
                  Demo: admin@aipath.edu · ashiqur.rahman@aipath.edu · nusrat.nabila@aipath.edu (password: password123)
                </p> */}
                <p className="text-center text-sm text-on-surface-variant">
                  New to AI-Path Assist?{" "}
                  <Link href="/register" className="text-primary font-medium hover:text-primary-fixed">Register your institution</Link>
                </p>
              </form>
            ) : (
              <div className="flex flex-col gap-6">
                <div className="text-center mb-2">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined" style={{ fontSize: 32 }}>mark_email_read</span>
                  </div>
                  <h2 className="font-headline-md mb-1">Check Your Email</h2>
                  <p className="font-body-md text-on-surface-variant">
                    We sent a 6-digit code to{" "}
                    <span className="text-on-surface font-medium">{email}</span>
                  </p>
                  <p className="font-body-md text-on-surface-variant text-sm mt-1">It expires in 10 minutes.</p>
                </div>

                <div className="flex justify-center gap-2 sm:gap-3" onPaste={handleCodePaste}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      id={`mfa-${i}`}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !digit && i > 0) {
                          document.getElementById(`mfa-${i - 1}`)?.focus();
                        }
                      }}
                      className="w-10 sm:w-12 h-14 bg-surface border border-outline-variant rounded-lg text-center font-data-mono text-xl text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      inputMode="numeric"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleVerify}
                    disabled={verifying}
                    className="w-full h-12 bg-primary text-on-primary rounded-lg font-headline-sm hover:bg-primary-fixed transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {verifying ? "Verifying…" : "Verify & Sign In"}
                    {!verifying && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>}
                  </button>
                  <div className="flex items-center justify-between text-sm">
                    <button onClick={() => { setStep("credentials"); setCode(["","","","","",""]); setError(""); setInfo(""); }} className="text-on-surface-variant hover:text-on-surface transition-colors">
                      ← Use different account
                    </button>
                    <button
                      onClick={handleResend}
                      disabled={resending || resendCooldown > 0}
                      className="text-primary hover:text-primary-fixed font-medium transition-colors disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : resending ? "Sending…" : "Resend code"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="bg-surface-container-low p-4 border-t border-surface-container-highest text-center">
            <p className="font-body-md text-on-surface-variant text-xs">
              Protected by two-factor authentication. Code sent to your registered email.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
