"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { ThemeToggleIcon } from "@/components/ThemeToggle";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ── Step 1: request a reset code sent to the registered email ────────────
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Enter the email address for your account.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post<{ pending: boolean; message: string; _devOtp?: string }>(
        "/api/auth/forgot-password",
        { email }
      );
      if (res._devOtp) {
        setCode(res._devOtp.split(""));
        setInfo(`DEV MODE — code auto-filled: ${res._devOtp}`);
      } else {
        setInfo(res.message || `If an account exists for ${email}, a reset code has been sent.`);
      }
      setStep("reset");
      startResendCooldown();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Resend reset code with 30-second cooldown ─────────────────────────────
  const handleResend = async () => {
    setError("");
    setResending(true);
    try {
      const res = await api.post<{ pending: boolean; message: string; _devOtp?: string }>(
        "/api/auth/forgot-password",
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

  // ── Step 2: verify code + set a new password ──────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = code.join("");
    if (otp.length < 6) {
      setError("Enter the full 6-digit code sent to your email.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setResetting(true);
    try {
      await api.post<{ ok: boolean; message: string }>("/api/auth/reset-password", {
        email,
        otp,
        newPassword,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to reset your password. Please try again.");
    } finally {
      setResetting(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...code];
    next[index] = value;
    setCode(next);
    if (value && index < 5) document.getElementById(`reset-otp-${index + 1}`)?.focus();
  };

  const handleCodePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) setCode(pasted.split(""));
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-4">
      <header className="absolute top-0 left-0 w-full flex items-center justify-between p-4 sm:px-8 border-b border-surface-container-high bg-background/80 backdrop-blur-sm z-10">
        <Link href="/login" className="flex items-center gap-2 text-primary hover:text-primary-fixed transition-colors">
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_back</span>
          <span className="font-label-caps uppercase tracking-wider">Back to Sign In</span>
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
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 36 }}>
              {step === "done" ? "task_alt" : "lock_reset"}
            </span>
          </div>
          <h1 className="font-display text-display text-center mb-2">
            {step === "request" && "Reset Your Password"}
            {step === "reset" && "Enter Code & New Password"}
            {step === "done" && "Password Reset"}
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-container/20 border border-secondary-container/30 text-secondary-fixed">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified_user</span>
            <span className="font-label-caps">Secure Password Recovery</span>
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

            {step === "request" && (
              <form className="flex flex-col gap-6" onSubmit={handleRequestCode}>
                <p className="font-body-md text-on-surface-variant">
                  Enter your institutional email and we&apos;ll send you a 6-digit code to reset your password.
                </p>
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

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 mt-2 bg-primary text-on-primary rounded-lg font-headline-sm hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  <span>{submitting ? "Sending reset code…" : "Send Reset Code"}</span>
                  {!submitting && <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>}
                </button>

                <p className="text-center text-sm text-on-surface-variant">
                  Remembered your password?{" "}
                  <Link href="/login" className="text-primary font-medium hover:text-primary-fixed">Back to sign in</Link>
                </p>
              </form>
            )}

            {step === "reset" && (
              <form className="flex flex-col gap-6" onSubmit={handleReset}>
                <div className="text-center mb-2">
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
                      id={`reset-otp-${i}`}
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !digit && i > 0) {
                          document.getElementById(`reset-otp-${i - 1}`)?.focus();
                        }
                      }}
                      className="w-10 sm:w-12 h-14 bg-surface border border-outline-variant rounded-lg text-center font-data-mono text-xl text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                      inputMode="numeric"
                      autoFocus={i === 0}
                    />
                  ))}
                </div>

                <div className="space-y-4">
                  <label className="flex flex-col gap-2">
                    <span className="font-body-md font-medium text-on-surface-variant">New Password</span>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">lock</span>
                      <input
                        className="w-full h-12 bg-surface border border-outline-variant rounded-lg pl-10 pr-10 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/50 font-body-md"
                        placeholder="••••••••"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                      <button type="button" onClick={() => setShowPassword((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{showPassword ? "visibility" : "visibility_off"}</span>
                      </button>
                    </div>
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="font-body-md font-medium text-on-surface-variant">Confirm New Password</span>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">lock</span>
                      <input
                        className="w-full h-12 bg-surface border border-outline-variant rounded-lg pl-10 pr-4 text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-outline/50 font-body-md"
                        placeholder="••••••••"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    </div>
                  </label>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={resetting}
                    className="w-full h-12 bg-primary text-on-primary rounded-lg font-headline-sm hover:bg-primary-fixed transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {resetting ? "Resetting…" : "Reset Password"}
                    {!resetting && <span className="material-symbols-outlined" style={{ fontSize: 18 }}>check_circle</span>}
                  </button>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => { setStep("request"); setCode(["", "", "", "", "", ""]); setError(""); setInfo(""); }}
                      className="text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      ← Use different email
                    </button>
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={resending || resendCooldown > 0}
                      className="text-primary hover:text-primary-fixed font-medium transition-colors disabled:opacity-50"
                    >
                      {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : resending ? "Sending…" : "Resend code"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {step === "done" && (
              <div className="flex flex-col gap-6 items-center text-center">
                <div className="w-16 h-16 rounded-full bg-secondary-container/20 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined" style={{ fontSize: 32 }}>task_alt</span>
                </div>
                <div>
                  <h2 className="font-headline-md mb-1">You&apos;re all set</h2>
                  <p className="font-body-md text-on-surface-variant">
                    Your password has been reset. You can now sign in with your new password.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="w-full h-12 bg-primary text-on-primary rounded-lg font-headline-sm hover:bg-primary-fixed transition-colors flex items-center justify-center gap-2"
                >
                  <span>Back to Sign In</span>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
                </Link>
              </div>
            )}
          </div>
          <div className="bg-surface-container-low p-4 border-t border-surface-container-highest text-center">
            <p className="font-body-md text-on-surface-variant text-xs">
              For your security, reset codes expire after 10 minutes and can only be used once.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
