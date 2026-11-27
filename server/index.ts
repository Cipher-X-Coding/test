import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import { router } from './routes.ts';
import { UPLOADS_DIR } from './db.ts';
import { seedInitialDataIfEmpty } from './seedData.ts';

seedInitialDataIfEmpty();

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static audio uploads with byte-range seeking
app.use('/uploads', express.static(UPLOADS_DIR, { acceptRanges: true }));

// API routes
app.use('/api', router);

// Production SPA & PWA serving if dist exists
const distDir = path.resolve(process.cwd(), 'dist');
if (process.env.NODE_ENV === 'production' && fs.existsSync(distDir)) {
  // Always serve Service Worker fresh with proper scope header
  app.get('/sw.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
    res.sendFile(path.join(distDir, 'sw.js'));
  });

  // Serve Web App Manifest with official MIME type
  app.get('/manifest.webmanifest', (_req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(distDir, 'manifest.webmanifest'));
  });

  app.use(
    express.static(distDir, {
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Gholab API] Listening on http://0.0.0.0:${PORT}`);
});
