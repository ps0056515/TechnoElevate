require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dashboardRoutes = require('./routes/dashboard');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 6000;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:7000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

// Allowed frontend port — any host on this port is trusted (handles LAN IP access)
const FRONTEND_PORT = process.env.FRONTEND_PORT || '7000';

app.use(cors({
  origin: (origin, callback) => {
    // Non-browser clients (curl, server-to-server) have no Origin header
    if (!origin) return callback(null, true);
    // Explicit whitelist match
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any origin whose port matches FRONTEND_PORT (covers LAN / remote IP access)
    try {
      const url = new URL(origin);
      if (url.port === FRONTEND_PORT) return callback(null, true);
    } catch (_) { /* invalid origin, fall through */ }
    console.warn(`CORS: blocked origin "${origin}". Add it to FRONTEND_URL or set FRONTEND_PORT in .env`);
    return callback(null, false);
  },
  credentials: true,
}));

app.use(express.json());

// Public: auth routes (login does not need a token)
app.use('/api/auth', authRoutes);

// Health check (public)
app.get('/api/ping', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// All dashboard/admin routes require a valid JWT
app.use('/api', requireAuth, dashboardRoutes);

app.listen(PORT, () => {
  console.log(`TechnoElevate API running on http://localhost:${PORT}`);
});
