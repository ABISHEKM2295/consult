const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendMail = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.log('[EMAIL] Skipped — EMAIL_USER/EMAIL_PASS not set in .env');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `"Premier Textile Dyers" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('[EMAIL] Sent:', info.messageId);
  } catch (err) {
    console.error('[EMAIL] Failed:', err.message);
  }
};

const sendBatchApprovalEmail = (batch, toEmail) => {
  const subject = `✅ Batch ${batch.batchId || batch._id} Approved — Premier Textile Dyers`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <div style="background:#1e3a5f;color:white;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">Premier Textile Dyers</h2>
        <p style="margin:4px 0 0;opacity:0.8">Quality Approval Notification</p>
      </div>
      <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p>Dear Client,</p>
        <p>Your batch has been <strong style="color:#10b981">approved</strong> and is ready for dispatch.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Batch ID</td><td style="padding:8px">${batch.batchId}</td></tr>
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Party</td><td style="padding:8px">${batch.party}</td></tr>
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Color</td><td style="padding:8px">${batch.color}</td></tr>
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Quantity</td><td style="padding:8px">${batch.quantity} kg</td></tr>
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600">ΔE Result</td><td style="padding:8px">${batch.deltaE ?? '—'}</td></tr>
          <tr><td style="padding:8px;background:#f9fafb;font-weight:600">Efficiency</td><td style="padding:8px">${batch.efficiency}%</td></tr>
        </table>
        <p style="color:#6b7280;font-size:13px">— Premier Textile Dyers Quality Team</p>
      </div>
    </div>
  `;
  return sendMail({ to: toEmail, subject, html });
};

const sendLowStockAlert = (item, toEmail) => {
  const subject = `⚠️ Low Stock Alert: ${item.name} — Premier Textile Dyers`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px">
      <div style="background:#b91c1c;color:white;padding:16px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0">⚠️ Low Stock Alert</h2>
      </div>
      <div style="padding:20px;border:1px solid #fecaca;border-top:none;border-radius:0 0 8px 8px">
        <p><strong>${item.name}</strong> stock is critically low.</p>
        <p>Current Stock: <strong style="color:#ef4444">${item.stock} kg</strong></p>
        <p>Please place a purchase order immediately to avoid production delays.</p>
        <p style="color:#6b7280;font-size:13px">— Premier Textile Dyers System</p>
      </div>
    </div>
  `;
  return sendMail({ to: toEmail, subject, html });
};

module.exports = { sendBatchApprovalEmail, sendLowStockAlert };
