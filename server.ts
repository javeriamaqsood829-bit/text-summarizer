import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const AVATAR_FILE = path.join(PUBLIC_DIR, 'javeria-official-avatar.jpg');
const CONFIG_FILE = path.join(process.cwd(), 'avatar-config.json');

// Support large image payloads (Base64 data URLs)
app.use(express.json({ limit: '25mb' }));

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
  res.json({ status: 'ok', timestamp: Date.now() });
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

    // Save directly to public asset folder so it is immediately served statically
    fs.writeFileSync(AVATAR_FILE, buffer);

    // Also sync to dist if project is built
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
    console.log(`[Avatar Update] Official avatar updated by ${email} at ${new Date().toISOString()}`);

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

async function startServer() {
  // Vite middleware for dev / static serving for production
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
