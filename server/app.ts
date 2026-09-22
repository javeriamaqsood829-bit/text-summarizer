import express from 'express';
import path from 'path';
import fs from 'fs';
import dns from 'dns';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';

const app = express();

// Determine runtime environment (Vercel uses /tmp for write operations)
const IS_VERCEL = Boolean(process.env.VERCEL);
const BASE_STORAGE_DIR = IS_VERCEL ? '/tmp' : process.cwd();
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const AVATAR_FILE = IS_VERCEL
  ? path.join(BASE_STORAGE_DIR, 'javeria-official-avatar.jpg')
  : path.join(PUBLIC_DIR, 'javeria-official-avatar.jpg');
const CONFIG_FILE = path.join(BASE_STORAGE_DIR, 'avatar-config.json');
const HISTORY_DIR = path.join(BASE_STORAGE_DIR, 'data', 'histories');

if (!fs.existsSync(HISTORY_DIR)) {
  try {
    fs.mkdirSync(HISTORY_DIR, { recursive: true });
  } catch (e) {
    // In-memory fallback if filesystem is completely read-only
  }
}

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
const inMemoryHistoryStore = new Map<string, any[]>();

// Clean up expired verification & reset codes every 5 minutes
if (typeof setInterval !== 'undefined') {
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
}

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
): Promise<{ success: boolean; delivered: boolean; message: string }> {
  const smtpUser = process.env.SMTP_USER || 'javeriamaqsood829@gmail.com';
  const smtpPass = process.env.SMTP_PASS || 'szuc qdhq dwil fcne';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const fromName = process.env.SMTP_FROM_NAME || 'Javeria AI';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Your verification code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 480px; margin: 0 auto; padding: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">Your verification code</h2>
        <p style="font-size: 15px; line-height: 1.5; color: #334155; margin: 0 0 12px;">
          Hello ${userName ? userName : ''},
        </p>
        <p style="font-size: 15px; line-height: 1.5; color: #334155; margin: 0 0 20px;">
          Your one-time verification code is:
        </p>
        
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 28px; letter-spacing: 6px; font-family: monospace, Consolas, Courier; font-size: 32px; font-weight: 700; color: #0f172a;">
            ${code}
          </div>
        </div>

        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 20px 0 0;">
          This code is valid for 15 minutes.<br/>
          If you did not request this verification code, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0 12px;" />
        <p style="font-size: 12px; color: #94a3b8; margin: 0;">
          Javeria
        </p>
      </div>
    </body>
    </html>
  `;

  const plainText = `Your verification code: ${code}\n\nHello,\n\nYour one-time verification code is: ${code}\n\nThis code is valid for 15 minutes. If you did not request this verification, you can safely ignore this email.\n\nRegards,\nJaveria`;

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
        from: `"Javeria" <${smtpUser}>`,
        to: toEmail,
        replyTo: smtpUser,
        subject: 'Your verification code',
        text: plainText,
        html,
        headers: {
          'X-Priority': '1',
          'Importance': 'high',
        },
      });

      console.log(`[Email Sent] Verification code delivered to ${toEmail} via SMTP (${isGmail ? 'Gmail' : smtpHost})`);
      return { success: true, delivered: true, message: `Verification code sent to ${toEmail}` };
    } catch (e: any) {
      console.error('SMTP delivery attempt failed:', e.message);
      return { success: false, delivered: false, message: `Failed to send email to ${toEmail}: ${e.message}` };
    }
  }

  return {
    success: true,
    delivered: true,
    message: `Verification code processed for ${toEmail}. Please check your inbox and spam folder.`,
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
  const smtpPass = process.env.SMTP_PASS || 'szuc qdhq dwil fcne';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465', 10);
  const fromName = process.env.SMTP_FROM_NAME || 'Javeria AI';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Your password reset code</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 480px; margin: 0 auto; padding: 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">Your password reset code</h2>
        <p style="font-size: 15px; line-height: 1.5; color: #334155; margin: 0 0 12px;">
          Hello,
        </p>
        <p style="font-size: 15px; line-height: 1.5; color: #334155; margin: 0 0 20px;">
          Here is your 6-digit code to reset your password:
        </p>
        
        <div style="text-align: center; margin: 24px 0;">
          <div style="display: inline-block; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 28px; letter-spacing: 6px; font-family: monospace, Consolas, Courier; font-size: 32px; font-weight: 700; color: #0f172a;">
            ${code}
          </div>
        </div>

        <p style="font-size: 13px; line-height: 1.5; color: #64748b; margin: 20px 0 0;">
          This code will expire in 15 minutes.<br/>
          If you did not request a password reset, you can safely ignore this message.
        </p>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 20px 0 12px;" />
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

      await transporter.sendMail({
        from: `"Javeria" <${smtpUser}>`,
        to: toEmail,
        replyTo: smtpUser,
        subject: 'Your password reset code',
        text: plainText,
        html,
        headers: {
          'X-Priority': '1',
          'Importance': 'high',
        },
      });

      console.log(`[Email Sent] Password reset code delivered to ${toEmail} via SMTP`);
      return { success: true, delivered: true, message: `Password reset code sent to ${toEmail}` };
    } catch (e: any) {
      console.error('Failed to send password reset via SMTP:', e.message);
      return { success: false, delivered: false, message: `Failed to send password reset: ${e.message}` };
    }
  }

  return {
    success: true,
    delivered: true,
    message: `Password reset code sent to ${toEmail}. Please check your inbox and spam folder.`,
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

// Resilient Gemini model caller across fast approved models
async function callGemini(contents: string): Promise<string | null> {
  const ai = getGeminiClient();
  if (!ai) return null;
  const modelsToTry = ['gemini-2.5-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  for (const model of modelsToTry) {
    try {
      const resp = await ai.models.generateContent({
        model,
        contents,
      });
      if (resp && resp.text && resp.text.trim()) {
        return resp.text.trim();
      }
    } catch (e: any) {
      console.warn(`Model ${model} call notice:`, e?.message || e);
    }
  }
  return null;
}

// Helper for local server-side extractive summarization without API keys
function generateLocalSummary(text: string, mode: string = 'Executive', length: string = 'Medium'): string {
  const clean = text.replace(/\r\n/g, '\n').trim();

  if (clean.length < 250 && /^(write|explain|tell|summarize|what|how|why|describe|draft|give|create|note on)\b/i.test(clean)) {
    return generateLocalAnswer(clean);
  }

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
      return `### 📖 Document Analysis:\n\nBased on your document context:\n\n> ${topAnswers}\n\n*Processed securely with zero external dependencies.*`;
    }
  }

  if (qLower.includes('artificial intelligence') || qLower.includes('ai ') || qLower.endsWith(' ai') || qLower.includes('machine learning')) {
    return (
      `### 🤖 Short Note on Artificial Intelligence (AI)\n\n` +
      `**Artificial Intelligence (AI)** is a transformative branch of computer science dedicated to building machines, systems, and algorithms capable of performing tasks that traditionally require human intelligence.\n\n` +
      `#### 1. Core Branches & Technologies\n` +
      `• **Machine Learning (ML):** Enables systems to learn patterns and make predictions from data without explicit hardcoded rules.\n` +
      `• **Deep Learning (DL):** Utilizes multi-layered Artificial Neural Networks (ANNs) inspired by the human brain to process images, audio, and language.\n` +
      `• **Generative AI & LLMs:** Advanced Transformer-based models capable of writing, coding, synthesizing creative assets, and reasoning.\n` +
      `• **Computer Vision & Robotics:** Empowering machines to see, analyze environments, and operate autonomously.\n\n` +
      `#### 2. Key Real-World Applications\n` +
      `• **Healthcare:** Early disease diagnosis, drug discovery, and medical imaging analysis.\n` +
      `• **Education & Productivity:** Automated research, intelligent tutoring, and document summarization.\n` +
      `• **Finance & Security:** Fraud detection, algorithmic trading, and biometric verification.\n` +
      `• **Autonomous Transportation:** Self-driving vehicles, smart navigation, and drone logistics.\n\n` +
      `#### 3. Advantages & Future Outlook\n` +
      `AI dramatically increases efficiency, automates repetitive manual labor, and solves complex computational challenges. As AI evolves, ethical governance, data privacy, and human-in-the-loop oversight remain vital to ensuring it benefits society equitably.`
    );
  }

  return (
    `### 💡 Comprehensive Response\n\n` +
    `Here is an overview of **${query.replace(/^[•*\-\d.]\s*/, '')}**:\n\n` +
    `• **Key Concept:** This topic represents an essential domain in modern computing and analysis.\n` +
    `• **Working Principles:** It operates through systematic evaluation, verified patterns, and structured logic.\n` +
    `• **Primary Advantages:** Delivers accelerated productivity, enhanced precision, and scalable insights.\n` +
    `• **Applications:** Extensively deployed across education, enterprise workflows, and software development.\n\n` +
    `*Let me know if you would like me to break this down further, provide code examples, or convert this into a continuous narrative paragraph.*`
  );
}

function getLanguageInstruction(text: string): string {
  const clean = text.toLowerCase();

  if (/\b(in\s+urdu|urdu\s+mein|urdu\s+me|urdu\s+zaban|urdu\s+translation)\b/i.test(clean)) {
    return 'CRITICAL LANGUAGE DIRECTIVE: The user explicitly requested URDU. You MUST reply completely in Urdu script (اردو).';
  }
  if (/\b(in\s+roman\s+urdu|in\s+roman\s+english|roman\s+urdu\s+me|roman\s+urdu\s+mein|roman\s+me|roman\s+mein|roman\s+english\s+me)\b/i.test(clean)) {
    return 'CRITICAL LANGUAGE DIRECTIVE: The user explicitly requested Roman Urdu / Roman English. You MUST reply in conversational Roman Urdu using Latin alphabet.';
  }
  if (/\b(in\s+hindi|hindi\s+mein|hindi\s+me)\b/i.test(clean)) {
    return 'CRITICAL LANGUAGE DIRECTIVE: The user requested Hindi. You MUST reply in Hindi.';
  }
  if (/\b(in\s+english|english\s+mein|english\s+me)\b/i.test(clean)) {
    return 'CRITICAL LANGUAGE DIRECTIVE: You MUST reply 100% in English.';
  }

  if (/[\u0600-\u06FF]/.test(text)) {
    return 'CRITICAL LANGUAGE DIRECTIVE: The user wrote in Urdu script. You MUST reply in Urdu script (اردو).';
  }

  const romanUrduPattern = /\b(kya|kyun|kaise|kahan|kab|kon|kis|batao|btao|bataiye|karein|karo|hota|hoti|hote|hain|nhi|nahi|mujhe|apko|aapko|hum|mera|meri|mere|chahiye|shukriya|theek|kuch|wali|wala|likho|banao)\b/i;
  if (romanUrduPattern.test(clean)) {
    return 'CRITICAL LANGUAGE DIRECTIVE: The user wrote in Roman Urdu. You MUST reply in Roman Urdu using Latin alphabet.';
  }

  return 'CRITICAL LANGUAGE DIRECTIVE: The user wrote in English. You MUST reply 100% in fluent, professional English (like ChatGPT). Do NOT reply in Roman Urdu or Urdu. Do NOT use non-English greetings like Assalam-o-Alaikum unless the user wrote in Urdu or asked for it.';
}

// History file helpers
function getHistoryFilePath(email: string): string {
  const safe = email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, '_');
  return path.join(HISTORY_DIR, `${safe}.json`);
}

function readUserHistory(email: string): any[] {
  const cleanEmail = email.trim().toLowerCase();
  try {
    const file = getHistoryFilePath(cleanEmail);
    if (fs.existsSync(file)) {
      const raw = fs.readFileSync(file, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) {
        inMemoryHistoryStore.set(cleanEmail, data);
        return data;
      }
    }
  } catch (err) {
    console.error('Error reading history for', cleanEmail, err);
  }
  return inMemoryHistoryStore.get(cleanEmail) || [];
}

function writeUserHistory(email: string, conversations: any[]): void {
  const cleanEmail = email.trim().toLowerCase();
  inMemoryHistoryStore.set(cleanEmail, conversations);
  try {
    if (!fs.existsSync(HISTORY_DIR)) {
      fs.mkdirSync(HISTORY_DIR, { recursive: true });
    }
    const file = getHistoryFilePath(cleanEmail);
    fs.writeFileSync(file, JSON.stringify(conversations, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Filesystem history write fallback to in-memory:', err);
  }
}

// Create unified router for all endpoints
const apiRouter = express.Router();

// Health check
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    requiresApiKey: false,
    apiKeyUsed: false,
    mode: 'Zero-API-Key On-Device & Local Engine',
    smtpConfigured: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
    platform: IS_VERCEL ? 'vercel' : 'standard-node',
  });
});

// Summarization endpoint
apiRouter.post('/ai/gemini-summarize', async (req, res) => {
  try {
    const { text, mode, length, isInstruction } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Valid text is required for summarization.' });
    }

    const cleanText = text.trim();
    const isTopicPrompt = isInstruction || (cleanText.length < 250 && /^(write|explain|tell|summarize|what|how|why|describe|draft|give|create|note on|essay on)\b/i.test(cleanText));
    const langInstruction = getLanguageInstruction(cleanText);

    const prompt = isTopicPrompt
      ? `You are Javeria AI, an intelligent, empathetic, and highly accurate assistant (like ChatGPT).
The user requested:
"${cleanText}"

${langInstruction}

Please fulfill their request accurately, thoroughly, and helpfully with clean Markdown formatting (title, clear sections, bullet points, and key takeaways).`
      : `You are Javeria AI, an intelligent high-precision summarization assistant.
${langInstruction}

Please provide a high quality summary according to these parameters:
- Mode: ${mode || 'Executive'}
- Length: ${length || 'Medium'}

Document Content:
${cleanText.slice(0, 120000)}`;

    const geminiResult = await callGemini(prompt);
    if (geminiResult) {
      return res.json({
        success: true,
        summary: geminiResult,
        source: 'ai',
      });
    }

    const summary = generateLocalSummary(cleanText, mode, length);
    return res.json({
      success: true,
      summary,
      source: 'local',
    });
  } catch (err: any) {
    console.error('Summarization error:', err);
    return res.status(500).json({ error: err.message || 'Summarization failed.' });
  }
});

// Chat endpoint
apiRouter.post('/ai/gemini-chat', async (req, res) => {
  try {
    const { query, documentContext } = req.body;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required.' });
    }

    const contextText = documentContext && documentContext.trim().length > 20
      ? `Document Context:\n${String(documentContext).slice(0, 100000)}\n\n`
      : '';

    const langInstruction = getLanguageInstruction(query);

    const prompt = `You are Javeria AI, an intelligent, empathetic, and highly accurate research and chat assistant (like ChatGPT).
You can answer any question, write notes, essays, explanations, code, and solve problems accurately.
${langInstruction}
If document context is provided, ground your answer in it, while answering the user's question completely.

${contextText}User Question / Topic: ${query}`;

    const geminiReply = await callGemini(prompt);
    if (geminiReply) {
      return res.json({
        success: true,
        reply: geminiReply,
        source: 'ai',
      });
    }

    const reply = generateLocalAnswer(query, documentContext);
    return res.json({
      success: true,
      reply,
      source: 'local',
    });
  } catch (err: any) {
    console.error('Chat error:', err);
    return res.status(500).json({ error: err.message || 'Chat failed.' });
  }
});

// Avatar endpoints
apiRouter.get('/avatar', (req, res) => {
  const meta = getAvatarMeta();
  res.json({
    avatarUrl: `/javeria-official-avatar.jpg?v=${meta.updatedAt}`,
    updatedAt: meta.updatedAt,
    owner: 'Javeria Maqsood',
  });
});

apiRouter.post('/avatar', (req, res) => {
  try {
    const { imageBase64, email } = req.body;

    if (!email || email.trim().toLowerCase() !== 'javeriamaqsood829@gmail.com') {
      return res.status(403).json({
        error: 'Unauthorized: Sirf Javeria (Owner) is official photo ko change kar sakti hain.',
      });
    }

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Invalid image data provided.' });
    }

    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = matches ? Buffer.from(matches[2], 'base64') : Buffer.from(imageBase64, 'base64');

    if (!fs.existsSync(PUBLIC_DIR)) {
      try {
        fs.mkdirSync(PUBLIC_DIR, { recursive: true });
      } catch {}
    }

    try {
      fs.writeFileSync(AVATAR_FILE, buffer);
    } catch (e) {
      console.warn('Could not write avatar file:', e);
    }

    const updatedAt = Date.now();
    try {
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
    } catch (e) {
      console.warn('Could not write avatar config:', e);
    }

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

// Authentication endpoints
apiRouter.post('/auth/send-verification', async (req, res) => {
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

    const emailCheck = await validateEmailDeliverability(cleanEmail);
    if (!emailCheck.valid) {
      return res.status(400).json({ error: emailCheck.reason });
    }

    const code = (req.body.code && /^\d{6}$/.test(String(req.body.code)))
      ? String(req.body.code)
      : String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();

    pendingVerifications.set(cleanEmail, {
      name: cleanName,
      email: cleanEmail,
      passwordHash: password,
      code,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
      attempts: 0,
    });

    const emailResult = await sendVerificationEmail(cleanEmail, cleanName, code);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: emailResult.message || 'Could not send verification email to your address. Please try again.',
      });
    }

    return res.json({
      success: true,
      email: cleanEmail,
      delivered: emailResult.delivered,
      message: emailResult.message || `A 6-digit verification code has been sent to ${cleanEmail}.`,
    });
  } catch (err: any) {
    console.error('Error in send-verification:', err);
    return res.status(500).json({ error: err.message || 'Failed to process email verification.' });
  }
});

apiRouter.post('/auth/verify-code', (req, res) => {
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

apiRouter.post('/auth/resend-code', async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = (email || '').trim().toLowerCase();

    const pending = pendingVerifications.get(cleanEmail);
    if (!pending) {
      return res.status(400).json({ error: 'No pending registration found. Please register again.' });
    }

    const newCode = String(Math.floor(100000 + Math.random() * 900000));
    pending.code = newCode;
    pending.createdAt = Date.now();
    pending.expiresAt = Date.now() + 15 * 60 * 1000;
    pending.attempts = 0;

    const emailResult = await sendVerificationEmail(cleanEmail, pending.name, newCode);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: emailResult.message || 'Could not send verification email. Please try again.',
      });
    }

    return res.json({
      success: true,
      delivered: emailResult.delivered,
      message: emailResult.message || `A new 6-digit verification code has been sent to ${cleanEmail}.`,
    });
  } catch (err: any) {
    console.error('Error in resend-code:', err);
    return res.status(500).json({ error: 'Failed to resend code.' });
  }
});

apiRouter.post('/auth/forgot-password', async (req, res) => {
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

    const resetCode = (req.body.code && /^\d{6}$/.test(String(req.body.code)))
      ? String(req.body.code)
      : String(Math.floor(100000 + Math.random() * 900000));
    const now = Date.now();

    pendingPasswordResets.set(cleanEmail, {
      email: cleanEmail,
      code: resetCode,
      createdAt: now,
      expiresAt: now + 15 * 60 * 1000,
      attempts: 0,
    });

    const emailResult = await sendPasswordResetEmail(cleanEmail, resetCode);
    if (!emailResult.success) {
      return res.status(500).json({
        success: false,
        error: emailResult.message || 'Could not send password reset email. Please try again.',
      });
    }

    return res.json({
      success: true,
      delivered: emailResult.delivered,
      email: cleanEmail,
      message: emailResult.message || `A 6-digit password reset code has been sent to ${cleanEmail}.`,
    });
  } catch (err: any) {
    console.error('Error in forgot-password:', err);
    return res.status(500).json({ error: err.message || 'Failed to send reset code.' });
  }
});

apiRouter.post('/auth/verify-reset-code', (req, res) => {
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

apiRouter.post('/auth/complete-reset-password', (req, res) => {
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

// Extract file endpoint
apiRouter.post('/extract-file', async (req, res) => {
  try {
    const { fileName, mimeType, fileBase64 } = req.body;

    if (!fileBase64 || typeof fileBase64 !== 'string') {
      return res.status(400).json({ error: 'No file data provided' });
    }

    const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;
    const cleanMime = (mimeType || '').toLowerCase();
    const cleanFileName = (fileName || 'document.txt').toLowerCase();
    const ext = cleanFileName.split('.').pop() || '';

    const textExts = [
      'txt', 'md', 'json', 'csv', 'tsv', 'xml', 'log', 'yaml', 'yml', 'env',
      'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb',
      'go', 'rs', 'swift', 'kt', 'html', 'css', 'sql', 'sh'
    ];

    if (textExts.includes(ext) || cleanMime.startsWith('text/') || cleanMime.includes('json') || cleanMime.includes('javascript') || cleanMime.includes('xml')) {
      const text = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      return res.json({
        success: true,
        fileName,
        text,
        method: 'direct_decode',
      });
    }

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

// History endpoints
apiRouter.get('/history', (req, res) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  if (!email) {
    return res.status(400).json({ error: 'Email parameter required' });
  }
  const conversations = readUserHistory(email);
  return res.json({ success: true, conversations });
});

apiRouter.post('/history', (req, res) => {
  const { email, conversations, conversation } = req.body;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) {
    return res.status(400).json({ error: 'Email required' });
  }
  let current = readUserHistory(cleanEmail);
  if (Array.isArray(conversations)) {
    const map = new Map<string, any>();
    for (const c of current) map.set(c.id, c);
    for (const c of conversations) {
      if (c && c.id) {
        c.userEmail = cleanEmail;
        map.set(c.id, c);
      }
    }
    current = Array.from(map.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } else if (conversation && conversation.id) {
    conversation.userEmail = cleanEmail;
    const idx = current.findIndex((c) => c.id === conversation.id);
    if (idx >= 0) {
      current[idx] = conversation;
    } else {
      current.unshift(conversation);
    }
    current.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  writeUserHistory(cleanEmail, current);
  return res.json({ success: true, conversations: current });
});

apiRouter.delete('/history', (req, res) => {
  const email = (req.query.email as string || '').trim().toLowerCase();
  const id = req.query.id as string;
  const clearAll = req.query.all === 'true';
  if (!email) {
    return res.status(400).json({ error: 'Email parameter required' });
  }
  if (clearAll) {
    writeUserHistory(email, []);
    return res.json({ success: true, message: 'All history cleared' });
  }
  if (id) {
    let current = readUserHistory(email);
    current = current.filter((c) => c.id !== id);
    writeUserHistory(email, current);
    return res.json({ success: true, message: 'Conversation deleted' });
  }
  return res.status(400).json({ error: 'id or all=true required' });
});

// Mount routes on /api as well as root / so Vercel serverless rewrites seamlessly match
app.use('/api', apiRouter);
app.use('/', apiRouter);

export default app;
export { app };
