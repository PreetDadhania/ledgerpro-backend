const nodemailer = require('nodemailer');

const brandName  = 'LedgerPro';
const brandColor = '#3b6ef5';

// ── Create transporter using explicit SMTP (more reliable than service:'gmail') ──
function createTransporter() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
}

// ── Test connection on startup — prints result clearly in terminal ──
async function testEmailConnection() {
  try {
    const t = createTransporter();
    await t.verify();
    console.log('✅ Gmail SMTP connected — emails will be sent automatically');
    return true;
  } catch (err) {
    console.log('');
    console.log('⚠️  ─────────────────────────────────────────────────────');
    console.log('⚠️  Gmail SMTP NOT connected. Reason:', err.message);
    console.log('⚠️  Emails will NOT be sent to inbox.');
    console.log('⚠️  BUT: verification links are printed here in the terminal.');
    console.log('⚠️  You can still register and login using those links.');
    console.log('⚠️  ─────────────────────────────────────────────────────');
    console.log('');
    return false;
  }
}

// ── Base HTML template ──
function baseEmail(title, content) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f2f8;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">
    <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 32px;text-align:center;">
      <span style="font-size:28px;">📒</span>
      <span style="font-size:22px;font-weight:800;color:#fff;vertical-align:middle;margin-left:8px;">${brandName}</span>
      <p style="color:#64748b;margin:6px 0 0;font-size:13px;">Customer Ledger Manager</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;color:#0f172a;">${title}</h2>
      ${content}
    </div>
    <div style="background:#f8faff;padding:18px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} ${brandName}. Automated email.</p>
    </div>
  </div>
</body>
</html>`;
}

// ── Try to send email — on failure, print link to terminal (never crash) ──
async function trySend(mailOptions, fallbackMsg) {
  try {
    const t = createTransporter();
    await t.sendMail(mailOptions);
    console.log(`✅ Email sent to: ${mailOptions.to}`);
  } catch (err) {
    console.log('');
    console.log('📧 ─────────────────────────────────────────────────────');
    console.log(`📧 Email to ${mailOptions.to} could NOT be sent.`);
    console.log(`📧 Reason: ${err.message}`);
    console.log('📧');
    console.log(`📧 ${fallbackMsg}`);
    console.log('📧 ─────────────────────────────────────────────────────');
    console.log('');
    // Do NOT throw — let the registration succeed regardless
  }
}

// ── Send verification email ──
async function sendVerificationEmail(email, name, token) {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  // ALWAYS print to terminal — works even when email fails
  console.log('');
  console.log('🔗 ─────────────────────────────────────────────────────');
  console.log(`🔗 VERIFY LINK for ${name} (${email}):`);
  console.log(`🔗 ${url}`);
  console.log('🔗 Copy-paste this link into your browser to verify.');
  console.log('🔗 ─────────────────────────────────────────────────────');
  console.log('');

  const content = `
    <p style="color:#475569;font-size:15px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
    <p style="color:#475569;font-size:15px;line-height:1.7;">Welcome to LedgerPro! Click the button below to verify your email and activate your account.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="background:${brandColor};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;">
        ✉️ Verify Email Address
      </a>
    </div>
    <p style="color:#94a3b8;font-size:13px;text-align:center;">This link expires in <strong>24 hours</strong>.</p>
    <p style="color:#94a3b8;font-size:12px;text-align:center;word-break:break-all;">Or paste in browser:<br>${url}</p>`;

  await trySend(
    {
      from: `"${brandName}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${brandName} — Verify your email address`,
      html: baseEmail('Verify Your Email', content),
    },
    `MANUAL VERIFY: Open this in your browser → ${url}`
  );
}

// ── Send password reset email ──
async function sendPasswordResetEmail(email, name, token) {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  console.log('');
  console.log('🔗 ─────────────────────────────────────────────────────');
  console.log(`🔗 PASSWORD RESET LINK for ${name} (${email}):`);
  console.log(`🔗 ${url}`);
  console.log('🔗 ─────────────────────────────────────────────────────');
  console.log('');

  const content = `
    <p style="color:#475569;font-size:15px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
    <p style="color:#475569;font-size:15px;line-height:1.7;">We received a request to reset your password.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${url}" style="background:#ef4444;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;">
        🔑 Reset Password
      </a>
    </div>
    <p style="color:#94a3b8;font-size:13px;text-align:center;">Expires in <strong>1 hour</strong>.</p>
    <p style="color:#94a3b8;font-size:12px;text-align:center;word-break:break-all;">Or paste in browser:<br>${url}</p>`;

  await trySend(
    {
      from: `"${brandName}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `${brandName} — Password Reset`,
      html: baseEmail('Reset Your Password', content),
    },
    `MANUAL RESET: Open this in your browser → ${url}`
  );
}

// ── Send welcome email (non-critical, always silent on failure) ──
async function sendWelcomeEmail(email, name) {
  const content = `
    <p style="color:#475569;font-size:15px;line-height:1.7;">Hi <strong>${name}</strong>,</p>
    <p style="color:#475569;font-size:15px;line-height:1.7;">🎉 Your email has been verified! Your account is now fully active.</p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${process.env.CLIENT_URL}" style="background:${brandColor};color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:15px;display:inline-block;">
        🚀 Open LedgerPro
      </a>
    </div>`;

  await trySend(
    {
      from: `"${brandName}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Welcome to ${brandName}! 🎉`,
      html: baseEmail('Welcome to LedgerPro!', content),
    },
    '' // welcome email failure is completely silent
  );
}

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  testEmailConnection,
};
