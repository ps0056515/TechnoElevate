const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'techno_elevate_dev_secret_change_in_prod';

function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised — no token provided' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorised — invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Unauthorised' });
  if (req.user.role !== 'Administrator') {
    return res.status(403).json({ error: 'Forbidden — Administrator role required' });
  }
  next();
}

module.exports = { requireAuth, requireAdmin, JWT_SECRET };
