const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role, initials: user.initials, color: user.color },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, initials: user.initials, color: user.color },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me  — validate token and return current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, initials, color FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/settings  — get current user's settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_settings WHERE user_id = $1',
      [req.user.id]
    );
    if (!result.rows.length) {
      // Auto-create default settings if missing
      await pool.query('INSERT INTO user_settings (user_id) VALUES ($1)', [req.user.id]);
      const fresh = await pool.query('SELECT * FROM user_settings WHERE user_id = $1', [req.user.id]);
      return res.json(fresh.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/settings  — save current user's settings
router.put('/settings', requireAuth, async (req, res) => {
  try {
    const {
      phone, bio, timezone, date_format, currency, company_name,
      stale_threshold_days, bench_alert_days,
      notif_stalled_reqs, notif_expiring_sow, notif_bench_idle, notif_invoice_overdue,
      notif_email_alerts, notif_push_alerts, notif_weekly_digest, notif_daily_standup,
    } = req.body;

    await pool.query(`
      INSERT INTO user_settings (user_id, phone, bio, timezone, date_format, currency, company_name,
        stale_threshold_days, bench_alert_days,
        notif_stalled_reqs, notif_expiring_sow, notif_bench_idle, notif_invoice_overdue,
        notif_email_alerts, notif_push_alerts, notif_weekly_digest, notif_daily_standup, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,NOW())
      ON CONFLICT (user_id) DO UPDATE SET
        phone=$2, bio=$3, timezone=$4, date_format=$5, currency=$6, company_name=$7,
        stale_threshold_days=$8, bench_alert_days=$9,
        notif_stalled_reqs=$10, notif_expiring_sow=$11, notif_bench_idle=$12, notif_invoice_overdue=$13,
        notif_email_alerts=$14, notif_push_alerts=$15, notif_weekly_digest=$16, notif_daily_standup=$17,
        updated_at=NOW()
    `, [req.user.id, phone||null, bio||null, timezone, date_format, currency, company_name,
        stale_threshold_days||3, bench_alert_days||7,
        notif_stalled_reqs, notif_expiring_sow, notif_bench_idle, notif_invoice_overdue,
        notif_email_alerts, notif_push_alerts, notif_weekly_digest, notif_daily_standup]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/profile  — update name and role
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, role } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    await pool.query('UPDATE users SET name=$1, role=$2 WHERE id=$3', [name, role, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/auth/password  — change password
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Both fields are required' });
    if (new_password.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
