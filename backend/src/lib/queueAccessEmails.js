const { sendEmail } = require("./otp");

const FRONTEND_ORIGIN = () => process.env.FRONTEND_ORIGIN || "http://localhost:3000";

function wrapHtml({ heading, bodyHtml }) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f5f5f5;margin:0;padding:24px">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">
    <div style="background:#1a2b4c;padding:24px 32px">
      <p style="margin:0;color:#9ecfff;font-size:12px;letter-spacing:1px;text-transform:uppercase">AI-Path Assist</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;font-weight:600">${heading}</h1>
    </div>
    <div style="padding:32px">${bodyHtml}</div>
    <div style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee">
      <p style="margin:0;color:#bbb;font-size:11px">AI-Path Assist — Clinical Pathology Intelligence Platform</p>
    </div>
  </div>
</body>
</html>`;
}

/** Notify admins that a researcher has requested queue-data access for a date range. */
async function sendQueueAccessRequestEmail(adminEmails, { researcherName, researcherEmail, startDate, endDate, reason }) {
  if (!adminEmails || adminEmails.length === 0) return;
  const appUrl = FRONTEND_ORIGIN();

  await sendEmail({
    to: adminEmails.join(","),
    subject: `Action required — queue data access request from ${researcherEmail}`,
    text: [
      `A researcher has requested access to processing-queue data for a specific date range.`,
      ``,
      `Researcher: ${researcherName} (${researcherEmail})`,
      `Requested range: ${startDate} to ${endDate}`,
      reason ? `Reason: ${reason}` : null,
      ``,
      `Review and approve or deny this request from Admin Control → Queue Access:`,
      `${appUrl}/admin`,
      ``,
      `— AI-Path Assist Security`,
    ].filter(Boolean).join("\n"),
    html: wrapHtml({
      heading: "Queue Data Access Request",
      bodyHtml: `
        <p style="margin:0 0 20px;color:#444;font-size:15px">A researcher is requesting access to processing-queue data for a bounded date range:</p>
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td style="padding:6px 0;color:#999;font-size:13px;width:140px">Researcher</td><td style="padding:6px 0;color:#222;font-size:14px">${researcherName} (${researcherEmail})</td></tr>
          <tr><td style="padding:6px 0;color:#999;font-size:13px">Date range</td><td style="padding:6px 0;color:#222;font-size:14px">${startDate} → ${endDate}</td></tr>
          ${reason ? `<tr><td style="padding:6px 0;color:#999;font-size:13px">Reason</td><td style="padding:6px 0;color:#222;font-size:14px">${reason}</td></tr>` : ""}
        </table>
        <a href="${appUrl}/admin" style="display:inline-block;background:#1a2b4c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">Review in Admin Control</a>
        <p style="margin:20px 0 0;color:#999;font-size:12px">Queue data for this range stays hidden from the researcher until approved.</p>
      `,
    }),
  });
}

/** Tell a researcher their queue-data access request was approved. */
async function sendQueueAccessApprovedEmail(toEmail, name, { startDate, endDate }) {
  const appUrl = FRONTEND_ORIGIN();
  await sendEmail({
    to: toEmail,
    subject: `Approved — queue data access for ${startDate} to ${endDate}`,
    text: [
      `Hi ${name},`,
      ``,
      `Your request to view processing-queue data from ${startDate} to ${endDate} has been approved.`,
      `You can now view this data from the Queue Access page.`,
      ``,
      `${appUrl}/queue-access`,
      ``,
      `— AI-Path Assist Security`,
    ].join("\n"),
    html: wrapHtml({
      heading: "Queue Data Access Approved",
      bodyHtml: `
        <p style="margin:0 0 20px;color:#444;font-size:15px">Hi ${name}, your request to view processing-queue data from <strong>${startDate}</strong> to <strong>${endDate}</strong> has been approved.</p>
        <a href="${appUrl}/queue-access" style="display:inline-block;background:#1a2b4c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:600">View Queue Data</a>
      `,
    }),
  });
}

/** Tell a researcher their queue-data access request was denied. */
async function sendQueueAccessDeniedEmail(toEmail, name, { startDate, endDate, note }) {
  await sendEmail({
    to: toEmail,
    subject: `Your queue data access request was not approved`,
    text: [
      `Hi ${name},`,
      ``,
      `Your request to view processing-queue data from ${startDate} to ${endDate} was not approved by an administrator.`,
      note ? `Note from admin: ${note}` : null,
      ``,
      `— AI-Path Assist Security`,
    ].filter(Boolean).join("\n"),
    html: wrapHtml({
      heading: "Queue Data Access Request Update",
      bodyHtml: `
        <p style="margin:0 0 12px;color:#444;font-size:15px">Hi ${name}, your request to view processing-queue data from <strong>${startDate}</strong> to <strong>${endDate}</strong> was not approved.</p>
        ${note ? `<p style="margin:0 0 12px;color:#666;font-size:13px">Note from admin: ${note}</p>` : ""}
      `,
    }),
  });
}

module.exports = {
  sendQueueAccessRequestEmail,
  sendQueueAccessApprovedEmail,
  sendQueueAccessDeniedEmail,
};
