const crypto = require("crypto");
const nodemailer = require("nodemailer");
const { createConnection } = require("../queue/connection");

// Redis client for OTP storage (separate from BullMQ connections so OTP ops
// don't interfere with job queue operations).
let redisClient = null;
function getRedis() {
  if (!redisClient) {
    redisClient = createConnection();
    redisClient.on("error", (err) => {
      // eslint-disable-next-line no-console
      console.error("[otp] Redis error:", err.message);
    });
  }
  return redisClient;
}

// ─── Nodemailer transporter (lazy-init so server starts even if Gmail creds
// aren't configured yet — jobs will fail gracefully with a clear error) ──────
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass || user.startsWith("your_gmail")) {
    return null; // not configured yet
  }
  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return transporter;
}

// ─── OTP helpers ──────────────────────────────────────────────────────────

const OTP_EXPIRY = Number(process.env.OTP_EXPIRY_SECONDS || 600);
const OTP_PREFIX = "aipath:otp:";
const RESET_PREFIX = "aipath:pwreset:";

/** Generate a cryptographically secure random 6-digit OTP. */
function generateOTP() {
  return String(crypto.randomInt(100000, 1000000));
}

/** Store OTP in Redis with TTL. Returns the generated code. */
async function storeOTP(email, code) {
  const redis = getRedis();
  await redis.set(`${OTP_PREFIX}${email.toLowerCase()}`, code, "EX", OTP_EXPIRY);
  return code;
}

/** Verify a submitted OTP against the stored value. Deletes it on success. */
async function verifyOTP(email, submitted) {
  const redis = getRedis();
  const key = `${OTP_PREFIX}${email.toLowerCase()}`;
  const stored = await redis.get(key);
  if (!stored) return { ok: false, reason: "expired" };
  if (stored !== String(submitted).trim()) return { ok: false, reason: "invalid" };
  await redis.del(key);
  return { ok: true };
}

// ─── Password-reset OTP helpers (kept in a separate Redis namespace so a
// pending login OTP and a pending password-reset OTP never collide) ────────

/** Store a password-reset OTP in Redis with TTL. Returns the generated code. */
async function storePasswordResetOTP(email, code) {
  const redis = getRedis();
  await redis.set(`${RESET_PREFIX}${email.toLowerCase()}`, code, "EX", OTP_EXPIRY);
  return code;
}

/** Verify a submitted password-reset OTP. Deletes it on success so it can't be reused. */
async function verifyPasswordResetOTP(email, submitted) {
  const redis = getRedis();
  const key = `${RESET_PREFIX}${email.toLowerCase()}`;
  const stored = await redis.get(key);
  if (!stored) return { ok: false, reason: "expired" };
  if (stored !== String(submitted).trim()) return { ok: false, reason: "invalid" };
  await redis.del(key);
  return { ok: true };
}

/** Send a password-reset OTP to the user's registered email address via Gmail. */
async function sendPasswordResetEmail(toEmail, code) {
  const t = getTransporter();
  if (!t) {
    throw new Error(
      "Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to backend/.env. " +
        "Get an App Password at: myaccount.google.com → Security → 2-Step Verification → App passwords"
    );
  }

  const fromName = process.env.OTP_FROM_NAME || "AI-Path Assist";
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;
  const expiryMinutes = Math.round(OTP_EXPIRY / 60);

  await t.sendMail({
    from,
    to: toEmail,
    subject: `${code} — Reset your AI-Path Assist password`,
    text: [
      `We received a request to reset your AI-Path Assist password.`,
      ``,
      `Your password reset code is:`,
      ``,
      `  ${code}`,
      ``,
      `This code expires in ${expiryMinutes} minutes.`,
      `If you did not request a password reset, you can safely ignore this email — your password will not be changed.`,
      ``,
      `— AI-Path Assist Security`,
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1a2b4c;padding:24px 32px">
      <p style="margin:0;color:#9ecfff;font-size:12px;letter-spacing:1px;text-transform:uppercase">AI-Path Assist</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:600">Password Reset Request</h1>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 24px;color:#444;font-size:15px">Use this code to reset your password:</p>
      <div style="text-align:center;margin:0 0 28px">
        <span style="display:inline-block;font-size:40px;font-weight:700;letter-spacing:10px;color:#1a2b4c;font-family:monospace;background:#f0f4ff;padding:16px 28px;border-radius:10px;border:2px solid #d0deff">${code}</span>
      </div>
      <p style="margin:0 0 8px;color:#666;font-size:13px">This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
      <p style="margin:0;color:#999;font-size:12px">If you did not request a password reset, please ignore this email — your password will remain unchanged.</p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
      <p style="margin:0;color:#bbb;font-size:11px">AI-Path Assist — Clinical Pathology Intelligence Platform</p>
    </div>
  </div>
</body>
</html>`,
  });
}

/** Generic transactional email sender, reused by feature-specific notification templates. */
async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    throw new Error(
      "Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to backend/.env."
    );
  }
  const fromName = process.env.OTP_FROM_NAME || "AI-Path Assist";
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;
  await t.sendMail({ from, to, subject, text, html });
}

/** Send the OTP to the user's registered email address via Gmail. */
async function sendOTPEmail(toEmail, code) {
  const t = getTransporter();
  if (!t) {
    throw new Error(
      "Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to backend/.env. " +
        "Get an App Password at: myaccount.google.com → Security → 2-Step Verification → App passwords"
    );
  }

  const fromName = process.env.OTP_FROM_NAME || "AI-Path Assist";
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;
  const expiryMinutes = Math.round(OTP_EXPIRY / 60);

  await t.sendMail({
    from,
    to: toEmail,
    subject: `${code} — Your AI-Path Assist verification code`,
    text: [
      `Your AI-Path Assist two-factor authentication code is:`,
      ``,
      `  ${code}`,
      ``,
      `This code expires in ${expiryMinutes} minutes.`,
      `If you did not request this, someone may be attempting to sign in to your account.`,
      ``,
      `— AI-Path Assist Security`,
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1a2b4c;padding:24px 32px">
      <p style="margin:0;color:#9ecfff;font-size:12px;letter-spacing:1px;text-transform:uppercase">AI-Path Assist</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:600">Two-Factor Verification</h1>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 24px;color:#444;font-size:15px">Use this code to complete your sign-in:</p>
      <div style="text-align:center;margin:0 0 28px">
        <span style="display:inline-block;font-size:40px;font-weight:700;letter-spacing:10px;color:#1a2b4c;font-family:monospace;background:#f0f4ff;padding:16px 28px;border-radius:10px;border:2px solid #d0deff">${code}</span>
      </div>
      <p style="margin:0 0 8px;color:#666;font-size:13px">This code expires in <strong>${expiryMinutes} minutes</strong>.</p>
      <p style="margin:0;color:#999;font-size:12px">If you did not attempt to sign in, please ignore this email and consider changing your password.</p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
      <p style="margin:0;color:#bbb;font-size:11px">AI-Path Assist — Clinical Pathology Intelligence Platform</p>
    </div>
  </div>
</body>
</html>`,
  });
}

// ─── Admin approval workflow emails ────────────────────────────────────────

/**
 * Notify admins that a newly self-registered account (email already
 * verified) is waiting for approval before it can sign in.
 */
async function sendAdminApprovalRequestEmail(adminEmails, applicant) {
  const t = getTransporter();
  if (!t) {
    throw new Error(
      "Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to backend/.env."
    );
  }
  if (!adminEmails || adminEmails.length === 0) return;

  const fromName = process.env.OTP_FROM_NAME || "AI-Path Assist";
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;
  const appUrl = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

  await t.sendMail({
    from,
    to: adminEmails.join(","),
    subject: `Action required — approve new account: ${applicant.email}`,
    text: [
      `A new user has registered and verified their email. Their account is on hold until an administrator approves it.`,
      ``,
      `Name: ${applicant.name}`,
      `Email: ${applicant.email}`,
      `Requested role: ${applicant.role}`,
      `Institution: ${applicant.institution}`,
      ``,
      `Review and approve or reject this request from Admin Control → User Management:`,
      `${appUrl}/admin`,
      ``,
      `— AI-Path Assist Security`,
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1a2b4c;padding:24px 32px">
      <p style="margin:0;color:#9ecfff;font-size:12px;letter-spacing:1px;text-transform:uppercase">AI-Path Assist</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:600">New Account Awaiting Approval</h1>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 20px;color:#444;font-size:15px">A new user has verified their email and is requesting access:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr><td style="padding:6px 0;color:#999;font-size:13px;width:120px">Name</td><td style="padding:6px 0;color:#222;font-size:14px">${applicant.name}</td></tr>
        <tr><td style="padding:6px 0;color:#999;font-size:13px">Email</td><td style="padding:6px 0;color:#222;font-size:14px">${applicant.email}</td></tr>
        <tr><td style="padding:6px 0;color:#999;font-size:13px">Role</td><td style="padding:6px 0;color:#222;font-size:14px">${applicant.role}</td></tr>
        <tr><td style="padding:6px 0;color:#999;font-size:13px">Institution</td><td style="padding:6px 0;color:#222;font-size:14px">${applicant.institution}</td></tr>
      </table>
      <a href="${appUrl}/admin" style="display:inline-block;background:#1a2b4c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">Review in Admin Control</a>
      <p style="margin:20px 0 0;color:#999;font-size:12px">This account cannot sign in until an administrator approves it.</p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
      <p style="margin:0;color:#bbb;font-size:11px">AI-Path Assist — Clinical Pathology Intelligence Platform</p>
    </div>
  </div>
</body>
</html>`,
  });
}

/** Tell a user their account has been approved and they can now sign in. */
async function sendAccountApprovedEmail(toEmail, name) {
  const t = getTransporter();
  if (!t) {
    throw new Error(
      "Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to backend/.env."
    );
  }

  const fromName = process.env.OTP_FROM_NAME || "AI-Path Assist";
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;
  const appUrl = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

  await t.sendMail({
    from,
    to: toEmail,
    subject: `You're approved — welcome to AI-Path Assist`,
    text: [
      `Hi ${name},`,
      ``,
      `Your AI-Path Assist account has been approved by an administrator. You can now sign in with your email and password.`,
      ``,
      `Sign in: ${appUrl}/login`,
      ``,
      `— AI-Path Assist Security`,
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1a2b4c;padding:24px 32px">
      <p style="margin:0;color:#9ecfff;font-size:12px;letter-spacing:1px;text-transform:uppercase">AI-Path Assist</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:600">Account Approved</h1>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 20px;color:#444;font-size:15px">Hi ${name}, your account has been approved by an administrator. You can now sign in.</p>
      <a href="${appUrl}/login" style="display:inline-block;background:#1a2b4c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">Sign In</a>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
      <p style="margin:0;color:#bbb;font-size:11px">AI-Path Assist — Clinical Pathology Intelligence Platform</p>
    </div>
  </div>
</body>
</html>`,
  });
}

/** Tell a user their account request was declined. */
async function sendAccountRejectedEmail(toEmail, name) {
  const t = getTransporter();
  if (!t) {
    throw new Error(
      "Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to backend/.env."
    );
  }

  const fromName = process.env.OTP_FROM_NAME || "AI-Path Assist";
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;

  await t.sendMail({
    from,
    to: toEmail,
    subject: `Your AI-Path Assist account request`,
    text: [
      `Hi ${name},`,
      ``,
      `An administrator has reviewed your AI-Path Assist registration request and it was not approved.`,
      `If you believe this is a mistake, please contact your institution's administrator.`,
      ``,
      `— AI-Path Assist Security`,
    ].join("\n"),
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1a2b4c;padding:24px 32px">
      <p style="margin:0;color:#9ecfff;font-size:12px;letter-spacing:1px;text-transform:uppercase">AI-Path Assist</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:600">Account Request Update</h1>
    </div>
    <div style="padding:32px">
      <p style="margin:0 0 12px;color:#444;font-size:15px">Hi ${name}, an administrator reviewed your registration request and it was not approved.</p>
      <p style="margin:0;color:#999;font-size:12px">If you believe this is a mistake, please contact your institution's administrator.</p>
    </div>
    <div style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
      <p style="margin:0;color:#bbb;font-size:11px">AI-Path Assist — Clinical Pathology Intelligence Platform</p>
    </div>
  </div>
</body>
</html>`,
  });
}

// ─── Admin-issued invite email ─────────────────────────────────────────────

/** Tell a newly-invited user their account was created and how to sign in. */
async function sendUserInviteEmail(toEmail, name, tempPassword, role) {
  const t = getTransporter();

  if (!t) {
    throw new Error(
      "Email is not configured. Add GMAIL_USER and GMAIL_APP_PASSWORD to backend/.env."
    );
  }

  const fromName = process.env.OTP_FROM_NAME || "AI-Path Assist";
  const from = `"${fromName}" <${process.env.GMAIL_USER}>`;
  const appUrl = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

  const roleLabel = {
    admin: "Administrator",
    pathologist: "Pathologist",
    lab_tech: "Lab Technician",
    researcher: "Researcher",
  }[role] || role;

  await t.sendMail({
    from,
    to: toEmail,
    subject: "You've been invited to AI-Path Assist",

    text: [
      `Hi ${name},`,
      ``,
      `An administrator has created an AI-Path Assist account for you as a ${roleLabel}.`,
      ``,
      `AI-Path Assist is an AI-powered clinical pathology platform that helps pathologists, laboratory professionals, and researchers analyze pathology data, collaborate efficiently, and generate insights for improved diagnostic and research workflows.`,
      ``,
      `Sign in with:`,
      `  Email: ${toEmail}`,
      `  Temporary password: ${tempPassword}`,
      ``,
      `Sign in: ${appUrl}/login`,
      `We recommend changing your password after your first sign-in.`,
      ``,
      `— AI-Path Assist Security`,
    ].join("\n"),

    html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:#1a2b4c;padding:24px 32px">
      <p style="margin:0;color:#9ecfff;font-size:12px;letter-spacing:1px;text-transform:uppercase">
        AI-Path Assist
      </p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:600">
        You've Been Invited
      </h1>
    </div>

    <!-- Content -->
    <div style="padding:32px">

      <p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6">
        Hi <strong>${name}</strong>,
      </p>

      <p style="margin:0 0 16px;color:#444;font-size:15px;line-height:1.6">
        An administrator has created an AI-Path Assist account for you as a
        <strong>${roleLabel}</strong>.
      </p>

      <!-- Platform Description -->
      <div style="background:#f8faff;border-left:4px solid #1a2b4c;padding:16px 18px;margin:20px 0;border-radius:6px">
        <p style="margin:0;color:#555;font-size:14px;line-height:1.7">
          <strong>About AI-Path Assist</strong><br>
          AI-Path Assist is an AI-powered clinical pathology intelligence platform
          designed to support pathologists, laboratory professionals, and researchers.
          The platform streamlines pathology workflows, enables collaboration,
          assists with data analysis, and helps generate actionable insights for
          diagnostics and research.
        </p>
      </div>

      <p style="margin:0 0 16px;color:#444;font-size:15px">
        Use the credentials below to sign in:
      </p>

      <!-- Credentials Box -->
      <table
        style="
          width:100%;
          border-collapse:collapse;
          margin-bottom:24px;
          background:#f0f4ff;
          border:1px solid #d0deff;
          border-radius:10px;
          overflow:hidden;
        "
      >
        <tr>
          <td
            style="
              padding:14px 18px;
              color:#888;
              font-size:13px;
              width:160px;
            "
          >
            Email
          </td>
          <td
            style="
              padding:14px 18px;
              color:#222;
              font-size:14px;
              font-family:monospace;
            "
          >
            ${toEmail}
          </td>
        </tr>

        <tr>
          <td
            style="
              padding:14px 18px;
              color:#888;
              font-size:13px;
              border-top:1px solid #d0deff;
            "
          >
            Temporary Password
          </td>
          <td
            style="
              padding:14px 18px;
              color:#1a2b4c;
              font-size:16px;
              font-family:monospace;
              font-weight:700;
              border-top:1px solid #d0deff;
            "
          >
            ${tempPassword}
          </td>
        </tr>
      </table>

      <!-- Login Button -->
      <a
        href="${appUrl}/login"
        style="
          display:inline-block;
          background:#1a2b4c;
          color:#ffffff;
          text-decoration:none;
          padding:12px 24px;
          border-radius:8px;
          font-size:14px;
          font-weight:600;
        "
      >
        Sign In
      </a>

      <p style="margin:20px 0 0;color:#777;font-size:13px;line-height:1.6">
        For security reasons, we strongly recommend changing your password after
        your first successful sign-in.
      </p>

    </div>

    <!-- Footer -->
    <div style="background:#f9f9f9;padding:18px 32px;border-top:1px solid #eeeeee">
      <p style="margin:0;color:#999;font-size:12px">
        AI-Path Assist — Clinical Pathology Intelligence Platform
      </p>
    </div>

  </div>
</body>
</html>
`,
  });
}

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  sendOTPEmail,
  storePasswordResetOTP,
  verifyPasswordResetOTP,
  sendPasswordResetEmail,
  sendAdminApprovalRequestEmail,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendUserInviteEmail,
  sendEmail,
};