// Sends email via SMTP when SMTP_HOST is set. Otherwise it logs the message
// to the server console so local development works with no mail setup.
let transporter = null;

function isConfigured() {
  return Boolean(process.env.SMTP_HOST);
}

async function sendMail({ to, subject, text }) {
  if (!isConfigured()) {
    console.log(`[mail disabled — SMTP_HOST not set] To: ${to}\nSubject: ${subject}\n${text}`);
    return { sent: false };
  }
  if (!transporter) {
    const nodemailer = require("nodemailer");
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
  return { sent: true };
}

module.exports = { sendMail, isConfigured };
