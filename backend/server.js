require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');
const compression    = require('compression');
const rateLimit      = require('express-rate-limit');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes      = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');
const pool            = require('./db');

const app  = express();
const PORT = process.env.PORT || 6000;
const IS_PROD = process.env.NODE_ENV === 'production';

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:7000')
  .split(',').map(o => o.trim()).filter(Boolean);

const FRONTEND_PORT = process.env.FRONTEND_PORT || '7000';

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    try {
      const url = new URL(origin);
      if (url.port === FRONTEND_PORT) return callback(null, true);
    } catch (_) {}
    console.warn(`[CORS] Blocked origin: "${origin}"`);
    return callback(null, false);
  },
  credentials: true,
}));

// ─── COMPRESSION ──────────────────────────────────────────────────────────────
// Gzip all responses > 1 KB — reduces payload by 60-80%
app.use(compression({ level: 6, threshold: 1024 }));

// ─── RATE LIMITING ────────────────────────────────────────────────────────────
// Auth endpoints — strict: 20 attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skip: (req) => !IS_PROD, // only enforce in production
});

// API endpoints — generous: 300 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded. Please slow down.' },
  skip: (req) => !IS_PROD, // only enforce in production
});

app.use(express.json({ limit: '5mb' }));

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/ping', async (req, res) => {
  try {
    await pool.healthCheck();
    res.json({ status: 'ok', db: 'connected', timestamp: new Date().toISOString(), pid: process.pid });
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: err.message });
  }
});

// ─── AUTH ROUTES (public, rate-limited) ───────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);

// ─── DASHBOARD / ADMIN ROUTES (JWT protected, rate-limited) ───────────────────
app.use('/api', apiLimiter, requireAuth, dashboardRoutes);

// ─── SERVE BUILT FRONTEND ─────────────────────────────────────────────────────
// When NODE_ENV=production, serve the Vite build output from frontend/dist
const FRONTEND_DIST = path.resolve(__dirname, '../frontend/dist');
if (IS_PROD && fs.existsSync(FRONTEND_DIST)) {
  // Serve static assets with long-term caching
  app.use(express.static(FRONTEND_DIST, {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      // HTML files must never be cached so fresh deployments take effect immediately
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  // SPA fallback — all non-API routes serve index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
  console.log(`[Static] Serving frontend from ${FRONTEND_DIST}`);
} else if (IS_PROD) {
  console.warn('[Static] NODE_ENV=production but frontend/dist not found. Run: cd frontend && npm run build');
}

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  console.log(`TechnoElevate API running on http://0.0.0.0:${PORT} [${IS_PROD ? 'PRODUCTION' : 'DEVELOPMENT'}]`);
  console.log(`DB pool: max=${process.env.DB_POOL_MAX || 20} connections`);
});
