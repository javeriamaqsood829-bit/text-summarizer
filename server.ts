import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const AVATAR_FILE = path.join(PUBLIC_DIR, 'javeria-official-avatar.jpg');
const CONFIG_FILE = path.join(process.cwd(), 'avatar-config.json');

app.use(express.json({ limit: '25mb' }));

// In-memory pending email verifications with TTL
interface PendingVerification {
  name: string;
  email: string;
  passwordHash: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

// In-memory pending password reset requests with TTL
interface PendingPasswordReset {
  email: string;
  code: string;
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

const pendingVerifications = new Map<string, PendingVerification>();
const pendingPasswordResets = new Map<string, PendingPasswordReset>();

// Clean up expired verification & reset codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [email, item] of pendingVerifications.entries()) {
    if (now > item.expiresAt) {
      pendingVerifications.delete(email);
    }
  }
  for (const [email, item] of pendingPasswordResets.entries()) {
    if (now > item.expiresAt) {
      pendingPasswordResets.delete(email);
    }
  }
}, 5 * 60 * 1000);

// Common fake/throwaway/disposable email domains to block
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'trashmail.com',
  'yopmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'fakeinbox.com',
  'generator.email',
  'temp-mail.org',
  'throwawaymail.com',
  'mohmal.com',
  'crazymailing.com',
  'fake.com',
  'test.com',
  'example.com',
]);

/**
 * Validates that an email is legitimate and its domain can receive mail.
 */
async function validateEmailDeliverability(
  email: string
): Promise<{ valid: boolean; reason?: string }> {
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, reason: 'Invalid email address format. Please enter a valid email.' };
  }

  const parts = email.split('@');
  const domain = parts[1].toLowerCase();

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Temporary or disposable email addresses are not permitted. Please use your real email.',
    };
  }

  // Check MX records for the domain
  try {
    const mx = await dns.promises.resolveMx(domain);
    if (!mx || mx.length === 0) {
      return {
        valid: false,
        reason: `The domain "${domain}" cannot receive emails. Please provide a valid email address.`,
      };
    }
  } catch (err: any) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      return {
        valid: false,
        reason: `The email domain "${domain}" does not exist. Please check your spelling.`,
      };
    }
    // Allow well-known email providers if DNS times out
    const popular = [
      'gmail.com',
      'yahoo.com',
      'outlook.com',
      'hotmail.com',
      'icloud.com',
      'live.com',
      'proton.me',
      'protonmail.com',
    ];
    if (!popular.includes(domain)) {
      console.warn(`DNS lookup warning for ${domain}:`, err.message);
    }
  }

  return { valid: true };
}

/**
 * Dispatches real verification email to user inbox via SMTP or Resend
 */
async function sendVerificationEmail(
  toEmail: string,
  userName: string,
  code: string
): Promise<{ success: boolean; delivered: boolean; message: string; previewCode?: string }> {
  const smtpUser = process.env.SMTP_USER || 'javeriamaqsood829@gmail.com';
  const smtpPass = process.env.SMTP_PASS || 'szucqdhqdwilfcne';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const fromName = process.env.SMTP_FROM_NAME || 'Javeria AI';
  const resendApiKey = process.env.RESEND_API_KEY;

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0e14; margin: 0; padding: 32px 16px; color: #f8fafc;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #13161f; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
        <tr>
          <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #a855f7, #6366f1); border-radius: 12px; font-weight: 900; font-size: 22px; color: #ffffff; text-align: center; margin-bottom: 12px;">J</div>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 6px;">Verify Your Email</h1>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">Javeria AI Platform Security</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 32px 24px;">
            <p style="color: #e2e8f0; font-size: 15px; margin: 0 0 16px; line-height: 1.5;">
              Hello <strong>${userName}</strong>,
            </p>
            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
              Please use the 6-digit confirmation code below to verify your email address (<strong>${toEmail}</strong>) and activate your account:
            </p>
            
            <div style="text-align: center; margin: 24px 0;">
              <div style="display: inline-block; background: #07090e; border: 1.5px solid #3b82f6; border-radius: 12px; padding: 16px 28px; letter-spacing: 8px; font-family: monospace; font-size: 32px; font-weight: 800; color: #60a5fa;">
                ${code}
              </div>
            </div>

            <p style="color: #64748b; font-size: 12px; margin: 20px 0 0; text-align: center;">
              ⏱️ This code will expire in <strong>15 minutes</strong>.<br/>
              If you did not request this code, no action is needed.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 32px; background-color: #090b10; border-top: 1px solid rgba(255,255,255,0.04); text-align: center;">
            <p style="color: #475569; font-size: 11px; margin: 0; line-height: 1.5;">
              This is an automated security email from Javeria AI.<br/>
              © ${new Date().getFullYear()} Javeria AI Platform. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  // 1. Resend API
  if (resendApiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <onboarding@resend.dev>`,
          to: toEmail,
          subject: `${code} is your Javeria AI verification code`,
          html,
        }),
      });
      if (response.ok) {
        console.log(`[Email Sent] Verification delivered to ${toEmail} via Resend`);
        return { success: true, delivered: true, message: `Verification code sent to ${toEmail}` };
      }
    } catch (e: any) {
      console.error('Failed to send via Resend API:', e);
    }
  }

  // 2. Nodemailer SMTP (Gmail, Brevo, SendGrid, etc.)
  if (smtpUser && smtpPass) {
    try {
      const cleanPass = smtpPass.replace(/\s+/g, '');
      const isGmail = smtpHost.toLowerCase().includes('gmail');
      const transporter = isGmail
        ? nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: smtpUser,
              pass: cleanPass,
            },
          })
        : nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: cleanPass,
            },
          });

      await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to: toEmail,
        subject: `${code} is your Javeria AI verification code`,
        text: `Hello ${userName},\n\nYour 6-digit verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nRegards,\nJaveria AI`,
        html,
      });

      console.log(`[Email Sent] Verification code delivered to ${toEmail} via SMTP (${isGmail ? 'Gmail' : smtpHost})`);
      return { success: true, delivered: true, message: `Verification code sent to ${toEmail}` };
    } catch (e: any) {
      console.error('Failed to send via SMTP:', e);
      return {
        success: false,
        delivered: false,
        message: `Email delivery failed: ${e.message || 'SMTP Authentication failed. Please check your Gmail App Password in Settings.'}`,
      };
    }
  }

  // 3. Fallback when SMTP is not configured in settings
  console.warn(`[Email Alert] Cannot send code to ${toEmail} because SMTP_USER and SMTP_PASS are not configured.`);
  return {
    success: false,
    delivered: false,
    message:
      'Email deliver nahi ho saki kyunke email server (SMTP) connect nahi hai. Settings mein SMTP_USER aur SMTP_PASS (Gmail App Password) add karein taake users ko inbox mein verification code receive ho sake.',
  };
}

/**
 * Dispatches password reset 6-digit OTP code to user's real email inbox
 */
async function sendPasswordResetEmail(
  toEmail: string,
  code: string
): Promise<{ success: boolean; delivered: boolean; message: string }> {
  const smtpUser = process.env.SMTP_USER || 'javeriamaqsood829@gmail.com';
  const smtpPass = process.env.SMTP_PASS || 'szucqdhqdwilfcne';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const fromName = process.env.SMTP_FROM_NAME || 'Javeria AI';

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0c0e14; margin: 0; padding: 32px 16px; color: #f8fafc;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #13161f; border-radius: 16px; border: 1px solid rgba(255,255,255,0.08); overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
        <tr>
          <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06);">
            <div style="display: inline-block; width: 44px; height: 44px; line-height: 44px; background: linear-gradient(135deg, #ec4899, #8b5cf6); border-radius: 12px; font-weight: 900; font-size: 22px; color: #ffffff; text-align: center; margin-bottom: 12px;">🔒</div>
            <h1 style="color: #ffffff; font-size: 22px; font-weight: 700; margin: 0 0 6px;">Reset Your Password</h1>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">Javeria AI Account Security</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 32px 24px;">
            <p style="color: #e2e8f0; font-size: 15px; margin: 0 0 16px; line-height: 1.5;">
              Hello,
            </p>
            <p style="color: #94a3b8; font-size: 14px; margin: 0 0 24px; line-height: 1.6;">
              We received a request to reset your Javeria AI password for <strong>${toEmail}</strong>. Use the 6-digit security code below to set your new password:
            </p>
            
            <div style="text-align: center; margin: 24px 0;">
              <div style="display: inline-block; background: #07090e; border: 1.5px solid #ec4899; border-radius: 12px; padding: 16px 28px; letter-spacing: 8px; font-family: monospace; font-size: 32px; font-weight: 800; color: #f472b6;">
                ${code}
              </div>
            </div>

            <p style="color: #64748b; font-size: 12px; margin: 20px 0 0; text-align: center;">
              ⏱️ This code will expire in <strong>15 minutes</strong>.<br/>
              If you did not request a password reset, you can safely ignore this email. Your current password remains secure.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding: 20px 32px; background-color: #090b10; border-top: 1px solid rgba(255,255,255,0.04); text-align: center;">
            <p style="color: #475569; font-size: 11px; margin: 0; line-height: 1.5;">
              This is an automated security email from Javeria AI.<br/>
              © ${new Date().getFullYear()} Javeria AI Platform. All rights reserved.
            </p>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  if (smtpUser && smtpPass) {
    try {
      const cleanPass = smtpPass.replace(/\s+/g, '');
      const isGmail = smtpHost.toLowerCase().includes('gmail');
      const transporter = isGmail
        ? nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: smtpUser,
              pass: cleanPass,
            },
          })
        : nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: {
              user: smtpUser,
              pass: cleanPass,
            },
          });

      await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to: toEmail,
        subject: `${code} is your Javeria AI password reset code`,
        text: `Your Javeria AI password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nRegards,\nJaveria AI`,
        html,
      });

      console.log(`[Email Sent] Password reset code delivered to ${toEmail} via SMTP`);
      return { success: true, delivered: true, message: `Password reset code sent to ${toEmail}` };
    } catch (e: any) {
      console.error('Failed to send password reset via SMTP:', e);
      return {
        success: false,
        delivered: false,
        message: `Email delivery failed: ${e.message || 'SMTP Authentication failed.'}`,
      };
    }
  }

  return {
    success: false,
    delivered: false,
    message: 'SMTP credentials not configured.',
  };
}

// Helper to get avatar metadata
function getAvatarMeta(): { updatedAt: number; version: number } {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      return { updatedAt: data.updatedAt || Date.now(), version: data.version || 1 };
    }
  } catch (e) {
    console.error('Error reading avatar config:', e);
  }
  return { updatedAt: 1789885813348, version: 1 };
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
});

// GET /api/avatar - Public endpoint returning official avatar for ALL users & visitors
app.get('/api/avatar', (req, res) => {
  const meta = getAvatarMeta();
  res.json({
    avatarUrl: `/javeria-official-avatar.jpg?v=${meta.updatedAt}`,
    updatedAt: meta.updatedAt,
    owner: 'Javeria Maqsood',
  });
});

// POST /api/avatar - Restricted endpoint: ONLY Javeria can update the global public avatar
app.post('/api/avatar', (req, res) => {
  try {
    const { imageBase64, email } = req.body;

    // Strict validation: Only Javeria can update the public avatar
    if (!email || email.trim().toLowerCase() !== 'javeriamaqsood829@gmail.com') {
      return res.status(403).json({
        error: 'Unauthorized: Sirf Javeria (Owner) is official photo ko change kar sakti hain.',
      });
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Invalid image data provided.' });
    }

    // Decode Base64 data URL
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(imageBase64, 'base64');

    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    fs.writeFileSync(AVATAR_FILE, buffer);

    const distPublicFile = path.join(process.cwd(), 'dist', 'javeria-official-avatar.jpg');
    if (fs.existsSync(path.join(process.cwd(), 'dist'))) {
      try {
        fs.writeFileSync(distPublicFile, buffer);
      } catch (distErr) {
        console.warn('Could not write to dist folder:', distErr);
      }
    }

    const updatedAt = Date.now();
    fs.writeFileSync(
      CONFIG_FILE,
      JSON.stringify(
        {
          updatedAt,
          version: updatedAt,
          updatedBy: email,
          updatedAtISO: new Date().toISOString(),
        },
        null,
        2
      )
    );

    const newUrl = `/javeria-official-avatar.jpg?v=${updatedAt}`;
    return res.json({
      success: true,
      avatarUrl: newUrl,
      updatedAt,
      message: 'Official avatar updated globally for all users.',
    });
  } catch (err: any) {
    console.error('Failed to update official avatar:', err);
    return res.status(500).json({ error: err.message || 'Failed to save avatar image' });
  }
});

// POST /api/auth/send-verification - Real email delivery & validation
app.post('/api/auth/send-verification', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      return res.status(400).json({ error: 'Please enter your full name (at least 2 characters).' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    // Strictly validate real email deliverability
    const emailCheck = await validateEmailDeliverability(cleanEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.reason });
    }

    // Generate random 6-digit verification code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();

    // Store in server memory (valid for 15 minutes)
    pendingVerifications.set(cleanEmail, {
      name: cleanName,
      email: cleanEmail,
      passwordHash: password,
      code,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
      attempts: 0,
    });

    // Send real email to the user's inbox
    const emailResult = await sendVerificationEmail(cleanEmail, cleanName, code);

    if (!emailResult.delivered) {
      // Remove pending verification if email couldn't be sent
      pendingVerifications.delete(cleanEmail);
      return res.status(503).json({
        success: false,
        delivered: false,
        error: emailResult.message,
      });
    }

    return res.json({
      success: true,
      email: cleanEmail,
      delivered: true,
      message: `A 6-digit verification code has been delivered to ${cleanEmail}.`,
    });
  } catch (err: any) {
    console.error('Error in send-verification:', err);
    return res.status(500).json({ error: err.message || 'Failed to process email verification.' });
  }
});

// POST /api/auth/verify-code - Verify code sent to user email
app.post('/api/auth/verify-code', (req, res) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    const pending = pendingVerifications.get(cleanEmail);
    if (!pending) {
      return res.status(400).json({
        error: 'No active verification found for this email. Please request a new code.',
      });
    }

    if (Date.now() > pending.expiresAt) {
      pendingVerifications.delete(cleanEmail);
      return res.status(400).json({
        error: 'Verification code has expired. Please click "Resend Code".',
      });
    }

    pending.attempts += 1;
    if (pending.attempts > 5) {
      pendingVerifications.delete(cleanEmail);
      return res.status(429).json({
        error: 'Too many failed attempts. Please request a new verification code.',
      });
    }

    if (pending.code !== cleanCode) {
      return res.status(400).json({
        error: 'Invalid verification code. Please check your email inbox and try again.',
      });
    }

    // Code is correct! Remove pending verification
    pendingVerifications.delete(cleanEmail);

    const isOwnerUser = cleanEmail === 'javeriamaqsood829@gmail.com';
    const user = {
      id: `usr-${Date.now()}`,
      name: pending.name,
      email: cleanEmail,
      plan: 'Free',
      isEmailVerified: true,
      createdAt: new Date().toISOString(),
      avatarUrl: isOwnerUser ? '/javeria-official-avatar.jpg' : undefined,
    };

    return res.json({
      success: true,
      user,
      message: 'Email successfully verified.',
    });
  } catch (err: any) {
    console.error('Error in verify-code:', err);
    return res.status(500).json({ error: err.message || 'Verification failed.' });
  }
});

// POST /api/auth/resend-code - Resend code to user email
app.post('/api/auth/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    const pending = pendingVerifications.get(cleanEmail);
    if (!pending) {
      return res.status(400).json({ error: 'No pending registration found. Please register again.' });
    }

    // Regenerate code
    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    pending.code = newCode;
    pending.createdAt = Date.now();
    pending.expiresAt = Date.now() + 15 * 60 * 1000;
    pending.attempts = 0;

    const emailResult = await sendVerificationEmail(cleanEmail, pending.name, newCode);

    if (!emailResult.delivered) {
      return res.status(503).json({
        success: false,
        delivered: false,
        error: emailResult.message,
      });
    }

    return res.json({
      success: true,
      delivered: true,
      message: `A new 6-digit code has been delivered to ${cleanEmail}.`,
    });
  } catch (err: any) {
    console.error('Error in resend-code:', err);
    return res.status(500).json({ error: 'Failed to resend code.' });
  }
});

// POST /api/auth/forgot-password - Send password reset OTP code
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail) {
      return res.status(400).json({ error: 'Please enter your registered email address.' });
    }

    const emailCheck = await validateEmailDeliverability(cleanEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.reason });
    }

    // Generate random 6-digit reset code
    const resetCode = String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();

    pendingPasswordResets.set(cleanEmail, {
      email: cleanEmail,
      code: resetCode,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
      attempts: 0,
    });

    const emailResult = await sendPasswordResetEmail(cleanEmail, resetCode);

    if (!emailResult.delivered) {
      pendingPasswordResets.delete(cleanEmail);
      return res.status(503).json({
        success: false,
        delivered: false,
        error: emailResult.message,
      });
    }

    return res.json({
      success: true,
      delivered: true,
      email: cleanEmail,
      message: `A 6-digit password reset code has been delivered to ${cleanEmail}.`,
    });
  } catch (err: any) {
    console.error('Error in forgot-password:', err);
    return res.status(500).json({ error: err.message || 'Failed to send reset code.' });
  }
});

// POST /api/auth/verify-reset-code - Validate the reset OTP code
app.post('/api/auth/verify-reset-code', (req, res) => {
  try {
    const { email, code } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    const pending = pendingPasswordResets.get(cleanEmail);
    if (!pending) {
      return res.status(400).json({
        error: 'No active password reset request found for this email. Please request a new code.',
      });
    }

    if (Date.now() > pending.expiresAt) {
      pendingPasswordResets.delete(cleanEmail);
      return res.status(400).json({
        error: 'Password reset code has expired. Please request a new code.',
      });
    }

    pending.attempts += 1;
    if (pending.attempts > 5) {
      pendingPasswordResets.delete(cleanEmail);
      return res.status(429).json({
        error: 'Too many invalid attempts. Please request a new code.',
      });
    }

    if (pending.code !== cleanCode) {
      return res.status(400).json({
        error: 'Invalid verification code. Please check your email inbox.',
      });
    }

    return res.json({
      success: true,
      message: 'Code verified successfully. You can now set your new password.',
    });
  } catch (err: any) {
    console.error('Error in verify-reset-code:', err);
    return res.status(500).json({ error: err.message || 'Verification failed.' });
  }
});

// POST /api/auth/complete-reset-password - Verify OTP & clear reset request
app.post('/api/auth/complete-reset-password', (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanCode = (code || '').trim();

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const pending = pendingPasswordResets.get(cleanEmail);
    if (!pending) {
      return res.status(400).json({
        error: 'Reset session expired. Please request a new password reset code.',
      });
    }

    if (Date.now() > pending.expiresAt) {
      pendingPasswordResets.delete(cleanEmail);
      return res.status(400).json({
        error: 'Password reset code has expired. Please request a new code.',
      });
    }

    if (pending.code !== cleanCode) {
      return res.status(400).json({
        error: 'Invalid verification code. Please check your email inbox.',
      });
    }

    // Password reset verified and completed!
    pendingPasswordResets.delete(cleanEmail);

    return res.json({
      success: true,
      email: cleanEmail,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    });
  } catch (err: any) {
    console.error('Error in complete-reset-password:', err);
    return res.status(500).json({ error: err.message || 'Failed to complete password reset.' });
  }
});

// POST /api/extract-file - Multi-format Document & Image text extractor
app.post('/api/extract-file', async (req, res) => {
  try {
    const { fileName, mimeType, fileBase64 } = req.body;

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'No file data provided' });
    }

    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const cleanMime = (mimeType || '').toLowerCase();
    const cleanFileName = (fileName || 'document.txt').toLowerCase();
    const ext = cleanFileName.split('.').pop() || '';

    // Check if it's plain text or code file
    const textExts = [
      'txt', 'md', 'json', 'csv', 'tsv', 'xml', 'log', 'yaml', 'yml', 'env',
      'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb',
      'go', 'rs', 'swift', 'kt', 'html', 'css', 'sql', 'sh'
    ];

    // Direct UTF-8 decode for text, code, configuration, markdown, etc.
    if (textExts.includes(ext) || cleanMime.startsWith('text/') || cleanMime.includes('json') || cleanMime.includes('javascript') || cleanMime.includes('xml')) {
      const text = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      return res.json({
        success: true,
        fileName,
        text,
        method: 'direct_decode',
      });
    }

    // Binary files (Image, PDF) are processed with local client-side OCR & PDF extraction without any API key
    return res.json({
      success: false,
      fileName,
      useLocalOcr: true,
      message: 'Binary file detected; client-side local OCR engine will extract text privately without API keys.',
    });
  } catch (err: any) {
    console.error('Error in /api/extract-file:', err);
    return res.status(500).json({ error: err.message || 'File extraction failed' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
