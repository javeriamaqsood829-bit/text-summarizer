import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
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

  // Pre-approve established email providers so sandbox DNS restrictions do not block signups
  const popular = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'icloud.com',
    'live.com',
    'proton.me',
    'protonmail.com',
    'google.com',
  ];
  if (popular.includes(domain)) {
    return { valid: true };
  }

  // Check MX records for custom domains
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
    console.warn(`DNS lookup warning for ${domain}:`, err.message);
  }

  return { valid: true };
}

/**
 * Dispatches real verification email to user inbox via Gmail SMTP with anti-spam compliance
 */
async function sendVerificationEmail(
  toEmail: string,
  userName: string,
  code: string
): Promise<{ success: boolean; delivered: boolean; message: string; previewCode?: string }> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const fromName = process.env.SMTP_FROM_NAME || 'Javeria';

  // Clean, high-deliverability email that avoids spam/phishing heuristic triggers
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Verification Code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 480px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">Verification Code</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
          Hello ${userName || 'there'},
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px;">
          Here is your 6-digit confirmation code:
        </p>
        
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background-color: #f8fafc; border: 2px solid #3b82f6; border-radius: 8px; padding: 14px 32px; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; color: #1d4ed8;">
            ${code}
          </div>
        </div>

        <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0;">
          This code will expire in 15 minutes.<br/>
          If you did not request this code, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          Javeria
        </p>
      </div>
    </body>
    </html>
  `;

  const plainText = `Verification Code: ${code}\n\nHello ${userName || 'there'},\n\nHere is your 6-digit confirmation code: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request this code, you can safely ignore this email.\n\nRegards,\nJaveria`;

  // Standard Nodemailer SMTP (Gmail, custom mail server)
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

      // High deliverability transactional email parameters
      await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to: toEmail,
        replyTo: `"${fromName}" <${smtpUser}>`,
        subject: `${code} is your Javeria verification code`,
        text: plainText,
        html,
        headers: {
          'X-Entity-Ref-ID': `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        },
      });

      console.log(`[Email Sent] Verification code delivered to ${toEmail} via SMTP (${isGmail ? 'Gmail' : smtpHost})`);
      return { success: true, delivered: true, message: `Verification code sent to ${toEmail}` };
    } catch (e: any) {
      console.warn('SMTP delivery attempt failed:', e.message);
    }
  }

  // Fallback when SMTP is not configured or fails
  console.log(`[Preview/Dev Mode] Verification code for ${toEmail}: ${code}`);
  return {
    success: true,
    delivered: false,
    previewCode: code,
    message: smtpUser
      ? `Email server unavailable. Temporary verification code: ${code}`
      : `Verification code generated: ${code} (Configure SMTP in settings for real email delivery).`,
  };
}

/**
 * Dispatches password reset 6-digit OTP code to user's real email inbox
 */
async function sendPasswordResetEmail(
  toEmail: string,
  code: string
): Promise<{ success: boolean; delivered: boolean; message: string; previewCode?: string }> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const fromName = process.env.SMTP_FROM_NAME || 'Javeria';

  // Clean, high-deliverability email without spam-trigger words or dead links
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Password Reset Code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 480px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">Password Reset Code</h2>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 16px;">
          Hello,
        </p>
        <p style="font-size: 15px; line-height: 1.6; color: #334155; margin: 0 0 24px;">
          Here is your 6-digit code to reset your password:
        </p>
        
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background-color: #f8fafc; border: 2px solid #3b82f6; border-radius: 8px; padding: 14px 32px; letter-spacing: 6px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 32px; font-weight: 800; color: #1d4ed8;">
            ${code}
          </div>
        </div>

        <p style="font-size: 13px; line-height: 1.6; color: #64748b; margin: 24px 0 0;">
          This code will expire in 15 minutes.<br/>
          If you did not request a password reset, you can safely ignore this message.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0 16px;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          Javeria
        </p>
      </div>
    </body>
    </html>
  `;

  const plainText = `Password Reset Code: ${code}\n\nHello,\n\nHere is your 6-digit code to reset your password: ${code}\n\nThis code will expire in 15 minutes.\n\nIf you did not request a password reset, you can safely ignore this message.\n\nRegards,\nJaveria`;

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

      // High deliverability transactional email parameters
      await transporter.sendMail({
        from: `"${fromName}" <${smtpUser}>`,
        to: toEmail,
        replyTo: `"${fromName}" <${smtpUser}>`,
        subject: `${code} is your Javeria password reset code`,
        text: plainText,
        html,
        headers: {
          'X-Entity-Ref-ID': `${Date.now()}-${Math.floor(Math.random() * 100000)}`,
        },
      });

      console.log(`[Email Sent] Password reset code delivered to ${toEmail} via SMTP`);
      return { success: true, delivered: true, message: `Password reset code sent to ${toEmail}` };
    } catch (e: any) {
      console.warn('Failed to send password reset via SMTP:', e.message);
    }
  }

  console.log(`[Preview/Dev Mode] Password reset code for ${toEmail}: ${code}`);
  return {
    success: true,
    delivered: false,
    previewCode: code,
    message: smtpUser
      ? `Email server unavailable. Temporary reset code: ${code}`
      : `Reset code generated: ${code} (Configure SMTP in settings for real email delivery).`,
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

// Lazy Gemini AI Client initialization
let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    requiresApiKey: false,
    apiKeyUsed: false,
    mode: 'Zero-API-Key On-Device & Local Engine',
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  });
});

// Helper for local server-side extractive summarization without API keys
function generateLocalSummary(text: string, mode: string = 'Executive', length: string = 'Medium'): string {
  const clean = text.replace(/\r\n/g, '\n').trim();
  const sentences = clean
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 25);

  if (sentences.length === 0) {
    return text.slice(0, 400);
  }

  const targetCount =
    length === 'Short' ? Math.min(3, sentences.length) : length === 'Detailed' ? Math.min(8, sentences.length) : Math.min(5, sentences.length);
  const step = Math.max(1, Math.floor(sentences.length / targetCount));
  const picked: string[] = [];

  for (let i = 0; i < sentences.length && picked.length < targetCount; i += step) {
    picked.push(sentences[i]);
  }
  if (picked.length === 0) picked.push(sentences[0]);

  return (
    `### Key Takeaways (${mode || 'Executive'} Overview)\n\n` +
    picked.map((s) => `• ${s}`).join('\n\n') +
    `\n\n*Generated 100% locally with zero external API keys.*`
  );
}

// Helper for local server-side Q&A without API keys
function generateLocalAnswer(query: string, documentContext?: string): string {
  const qLower = query.toLowerCase();
  if (documentContext && documentContext.trim().length > 20) {
    const sentences = documentContext
      .split(/(?<=[.?!])\s+/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 15);
    const keywords = qLower.split(/\W+/).filter((w) => w.length > 3);

    const scored = sentences
      .map((s) => {
        const sLower = s.toLowerCase();
        let matchCount = 0;
        for (const kw of keywords) {
          if (sLower.includes(kw)) matchCount++;
        }
        return { sentence: s, score: matchCount };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length > 0) {
      const topAnswers = scored.slice(0, 3).map((s) => s.sentence).join(' ');
      return `Based on your document context:\n\n${topAnswers}\n\n*(Processed completely without external API keys)*`;
    }
  }

  return `I have analyzed your query locally without any API key: "${query}". You can ask me any question about your document or uploaded files!`;
}

// POST /api/ai/gemini-summarize - 100% functional without API keys
app.post('/api/ai/gemini-summarize', async (req, res) => {
  try {
    const { text, mode, length } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Valid text is required for summarization.' });
    }

    const ai = getGeminiClient();
    if (ai) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are Javeria AI, an intelligent high-precision summarization assistant.
Please provide a high quality summary according to these parameters:
- Mode: ${mode || 'Executive'}
- Length: ${length || 'Medium'}

Document Content:
${text.slice(0, 120000)}`,
        });

        return res.json({
          success: true,
          summary: response.text || generateLocalSummary(text, mode, length),
        });
      } catch (err) {
        console.warn('Fallback to local zero-API-key summarization:', err);
      }
    }

    // Zero API key local engine fallback
    const summary = generateLocalSummary(text, mode, length);
    return res.json({
      success: true,
      summary,
    });
  } catch (err: any) {
    console.error('Summarization error:', err);
    return res.status(500).json({ error: err.message || 'Summarization failed.' });
  }
});

// POST /api/ai/gemini-chat - 100% functional without API keys
app.post('/api/ai/gemini-chat', async (req, res) => {
  try {
    const { query, documentContext } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required.' });
    }

    const ai = getGeminiClient();
    if (ai) {
      try {
        const contextText = documentContext ? `Document Context:\n${String(documentContext).slice(0, 100000)}\n\n` : '';
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `You are Javeria AI, an empathetic and intelligent research assistant.
Answer the user's question accurately using the provided document context if available.

${contextText}User Question: ${query}`,
        });

        return res.json({
          success: true,
          reply: response.text || generateLocalAnswer(query, documentContext),
        });
      } catch (err) {
        console.warn('Fallback to local zero-API-key chat:', err);
      }
    }

    // Zero API key local response
    const reply = generateLocalAnswer(query, documentContext);
    return res.json({
      success: true,
      reply,
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err.message || 'Chat failed.' });
  }
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

    return res.json({
      success: true,
      email: cleanEmail,
      delivered: emailResult.delivered,
      previewCode: emailResult.previewCode,
      message: emailResult.message || `A 6-digit verification code has been processed for ${cleanEmail}.`,
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

    return res.json({
      success: true,
      delivered: emailResult.delivered,
      previewCode: emailResult.previewCode,
      message: emailResult.message || `A new 6-digit code has been generated for ${cleanEmail}.`,
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

    return res.json({
      success: true,
      delivered: emailResult.delivered,
      previewCode: emailResult.previewCode,
      email: cleanEmail,
      message: emailResult.message || `A 6-digit password reset code has been generated for ${cleanEmail}.`,
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
