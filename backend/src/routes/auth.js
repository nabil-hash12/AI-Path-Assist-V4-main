const express = require("express");
const jwt = require("jsonwebtoken");
const users = require("../models/users");
const misc = require("../models/misc");
const { signToken, requireAuth, JWT_SECRET } = require("../middleware/auth");
const {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTPEmail,
  storePasswordResetOTP,
  verifyPasswordResetOTP,
  sendPasswordResetEmail,
  sendAdminApprovalRequestEmail,
} = require("../lib/otp");

const router = express.Router();

const VALID_ROLES = ["admin", "pathologist", "lab_tech", "researcher"];

// ─── Step 1: validate credentials, store OTP, send email ──────────────────
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email and password are required." });

  const user = await users.findByEmail(email);
  if (!user || !users.verifyPassword(user, password)) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  if (user.status === "Deactivated") {
    return res.status(403).json({ error: "This account has been deactivated. Contact your administrator." });
  }
  if (user.status === "Pending") {
    return res.status(403).json({
      error: "Your account is awaiting administrator approval. You'll receive an email once it's approved.",
    });
  }

  const code = generateOTP();
  await storeOTP(email, code);

  try {
    await sendOTPEmail(email, code);
  } catch (err) {
    // If email is not configured (dev environment), return the code in the
    // response body so the developer can still log in and test without
    // actual Gmail credentials. In production, remove this fallback.
    const devMode = err.message.startsWith("Email is not configured");
    if (devMode) {
      // eslint-disable-next-line no-console
      console.warn(`[2FA] Email not configured. DEV MODE — OTP for ${email}: ${code}`);
      return res.json({
        pending: true,
        message: `Verification code sent to ${email}`,
        // Only exposed in dev — remove in production:
        _devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
      });
    }
    // Real email error (e.g. wrong App Password) — surface it clearly.
    // eslint-disable-next-line no-console
    console.error("[2FA] Failed to send OTP email:", err.message);
    return res.status(502).json({ error: `Failed to send verification email: ${err.message}` });
  }

  res.json({
    pending: true,
    message: `Verification code sent to ${email}`,
  });
});

// ─── Step 2: verify OTP → issue full JWT (or, for a still-Pending self-
// registration, confirm the email and notify admins instead of logging in) ─
router.post("/verify-otp", async (req, res) => {
  const { email, otp } = req.body || {};
  if (!email || !otp) return res.status(400).json({ error: "email and otp are required." });

  const result = await verifyOTP(email, otp);
  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "Verification code has expired. Please sign in again."
        : "Incorrect verification code. Please try again.";
    return res.status(401).json({ error: message });
  }

  const user = await users.findByEmail(email);
  if (!user) return res.status(401).json({ error: "User not found." });

  // Self-registered accounts sit in "Pending" until an admin approves them.
  // Verifying the OTP here just confirms the email address is real — it
  // does not grant a session. Notify admins so they can review the request.
  if (user.status === "Pending") {
    await misc.logAction({ actorId: user.id, actorName: user.name, action: "Verified email (awaiting admin approval)", target: "Auth" });

    try {
      const admins = await users.listAdmins();
      await sendAdminApprovalRequestEmail(
        admins.map((a) => a.email),
        { name: user.name, email: user.email, role: user.role, institution: user.institution }
      );
    } catch (err) {
      // Don't fail the user's flow if the admin-notification email can't be
      // sent (e.g. email not configured in dev) — just log it.
      // eslint-disable-next-line no-console
      console.warn("[Registration] Failed to notify admins of pending approval:", err.message);
    }

    return res.json({
      pending: true,
      approvalPending: true,
      message: "Email verified. Your account is now awaiting administrator approval. You'll receive an email once it's approved.",
    });
  }

  await users.touchLogin(user.id);
  await misc.logAction({ actorId: user.id, actorName: user.name, action: "Logged in (2FA verified)", target: "Auth" });

  const token = signToken(user);
  res.json({ token, user: users.toPublic(user) });
});

// ─── Resend OTP ───────────────────────────────────────────────────────────
router.post("/resend-otp", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email is required." });

  const user = await users.findByEmail(email);
  if (!user) return res.status(404).json({ error: "No account found for this email." });

  const code = generateOTP();
  await storeOTP(email, code);

  try {
    await sendOTPEmail(email, code);
  } catch (err) {
    const devMode = err.message.startsWith("Email is not configured");
    if (devMode) {
      // eslint-disable-next-line no-console
      console.warn(`[2FA] Resend — DEV MODE OTP for ${email}: ${code}`);
      return res.json({
        ok: true,
        message: `New code sent to ${email}`,
        _devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
      });
    }
    return res.status(502).json({ error: `Failed to send verification email: ${err.message}` });
  }

  res.json({ ok: true, message: `New verification code sent to ${email}` });
});

// ─── Register ─────────────────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  const { name, email, password, role, institution } = req.body || {};
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "name, email, password, and role are required." });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(", ")}` });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }
  if (await users.findByEmail(email)) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const user = await users.create({ name, email, password, role, institution, status: "Pending" });
  await misc.logAction({ actorId: user.id, actorName: user.name, action: "Registered new account (pending approval)", target: user.email });

  // After registration, verify the email address via a one-time code before
  // the account is even visible to admins for approval. The account remains
  // "Pending" — and cannot sign in — until an administrator approves it.
  const code = generateOTP();
  await storeOTP(email, code);

  try {
    await sendOTPEmail(email, code);
  } catch (err) {
    const devMode = err.message.startsWith("Email is not configured");
    if (devMode) {
      // eslint-disable-next-line no-console
      console.warn(`[2FA] Registration — DEV MODE OTP for ${email}: ${code}`);
      return res.status(201).json({
        pending: true,
        message: `Account created. Verification code sent to ${email}`,
        _devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
      });
    }
    return res.status(502).json({ error: `Account created but failed to send verification email: ${err.message}` });
  }

  res.status(201).json({ pending: true, message: `Account created. Verification code sent to ${email}` });
});

// ─── Forgot password: Step 1 — send a reset code to the registered email ──
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: "email is required." });

  const user = await users.findByEmail(email);
  // Always respond with the same generic message whether or not the account
  // exists, so this endpoint can't be used to enumerate registered emails.
  const genericResponse = {
    pending: true,
    message: `If an account exists for ${email}, a password reset code has been sent.`,
  };

  if (!user) return res.json(genericResponse);
  if (user.status === "Deactivated") return res.json(genericResponse);

  const code = generateOTP();
  await storePasswordResetOTP(email, code);

  try {
    await sendPasswordResetEmail(email, code);
  } catch (err) {
    const devMode = err.message.startsWith("Email is not configured");
    if (devMode) {
      // eslint-disable-next-line no-console
      console.warn(`[Password Reset] Email not configured. DEV MODE — reset code for ${email}: ${code}`);
      return res.json({
        ...genericResponse,
        // Only exposed in dev — remove in production:
        _devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
      });
    }
    // eslint-disable-next-line no-console
    console.error("[Password Reset] Failed to send reset email:", err.message);
    return res.status(502).json({ error: `Failed to send reset email: ${err.message}` });
  }

  res.json(genericResponse);
});

// ─── Forgot password: Step 2 — verify the code and set a new password ─────
router.post("/reset-password", async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: "email, otp, and newPassword are required." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  const result = await verifyPasswordResetOTP(email, otp);
  if (!result.ok) {
    const message =
      result.reason === "expired"
        ? "Reset code has expired. Please request a new one."
        : "Incorrect reset code. Please try again.";
    return res.status(401).json({ error: message });
  }

  const user = await users.findByEmail(email);
  if (!user) return res.status(404).json({ error: "No account found for this email." });

  await users.updatePassword(user.id, newPassword);
  await misc.logAction({ actorId: user.id, actorName: user.name, action: "Reset password", target: "Auth" });

  res.json({ ok: true, message: "Your password has been reset. You can now sign in." });
});

// ─── Me (verify active session) ───────────────────────────────────────────
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: users.toPublic(req.user) });
});

module.exports = router;
