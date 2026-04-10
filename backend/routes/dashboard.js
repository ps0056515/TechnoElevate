const express = require('express');
const router = express.Router();
const pool = require('../db');

// Attention Engine
router.get('/attention', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM attention_issues WHERE resolved = FALSE ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'MED' THEN 2 ELSE 3 END, days_stalled DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/attention/:id/resolve', async (req, res) => {
  try {
    await pool.query('UPDATE attention_issues SET resolved = TRUE WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Talent Lifecycle
router.get('/talent/lifecycle', async (req, res) => {
  try {
    const counts = await pool.query(
      `SELECT status, COUNT(*) as count FROM talent GROUP BY status`
    );
    const bench = await pool.query(
      `SELECT * FROM bench_idle_weekly ORDER BY week_start ASC`
    );
    const talents = await pool.query(
      `SELECT id, name, role, status, bench_start_date, idle_hours, current_client, skills FROM talent ORDER BY status, name`
    );
    res.json({
      counts: counts.rows,
      benchIdle: bench.rows,
      talents: talents.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/talent/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE talent SET status = $1 WHERE id = $2', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Requirements Pipeline
router.get('/pipeline', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM requirements ORDER BY CASE priority WHEN 'HIGH' THEN 1 WHEN 'MED' THEN 2 ELSE 3 END, days_in_stage DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/pipeline/:id/stage', async (req, res) => {
  try {
    const { stage } = req.body;
    await pool.query(
      'UPDATE requirements SET stage = $1, days_in_stage = 0, stalled = FALSE WHERE id = $2',
      [stage, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Projects (Managed Services)
router.get('/projects', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM projects ORDER BY CASE stage WHEN 'blocked' THEN 1 WHEN 'at_risk' THEN 2 WHEN 'green' THEN 3 ELSE 4 END`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/projects/:id/resolve', async (req, res) => {
  try {
    await pool.query(
      "UPDATE projects SET blocking_issue = NULL, stage = 'green' WHERE id = $1",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Contracts
router.get('/contracts', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *, (end_date - CURRENT_DATE) AS days_remaining FROM contracts ORDER BY CASE status WHEN 'expired' THEN 1 WHEN 'expiring_soon' THEN 2 ELSE 3 END, end_date ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Engagements + Checklist
router.get('/engagements', async (req, res) => {
  try {
    const engs = await pool.query(`SELECT * FROM engagements ORDER BY start_date DESC`);
    const items = await pool.query(`SELECT * FROM engagement_checklist_items ORDER BY engagement_id, stage_number`);
    res.json({ engagements: engs.rows, checklistItems: items.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/engagements/checklist/:id/complete', async (req, res) => {
  try {
    await pool.query(
      'UPDATE engagement_checklist_items SET completed = TRUE, overdue = FALSE WHERE id = $1',
      [req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health Metrics
router.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM health_metrics ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/health/:id', async (req, res) => {
  try {
    const { metric_value } = req.body;
    await pool.query(
      'UPDATE health_metrics SET metric_value = $1, updated_at = NOW() WHERE id = $2',
      [metric_value, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN CRUD ───────────────────────────────────────────────────────────────

// TALENT — full list for admin
router.get('/admin/talent', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM talent ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/talent', async (req, res) => {
  try {
    const { name, role, status, bench_start_date, idle_hours, current_client, skills } = req.body;
    const skillsArr = typeof skills === 'string'
      ? skills.split(',').map(s => s.trim()).filter(Boolean)
      : (skills || []);
    const result = await pool.query(
      `INSERT INTO talent (name, role, status, bench_start_date, idle_hours, current_client, skills)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, role, status || 'bench', bench_start_date || null, idle_hours || 0, current_client || null, skillsArr]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/talent/:id', async (req, res) => {
  try {
    const { name, role, status, bench_start_date, idle_hours, current_client, skills } = req.body;
    const skillsArr = typeof skills === 'string'
      ? skills.split(',').map(s => s.trim()).filter(Boolean)
      : (skills || []);
    await pool.query(
      `UPDATE talent SET name=$1, role=$2, status=$3, bench_start_date=$4, idle_hours=$5, current_client=$6, skills=$7 WHERE id=$8`,
      [name, role, status, bench_start_date || null, idle_hours || 0, current_client || null, skillsArr, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/talent/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM talent WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// REQUIREMENTS
router.get('/admin/requirements', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM requirements ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/requirements', async (req, res) => {
  try {
    const { req_id, title, client, stage, days_in_stage, stalled, priority, role_type } = req.body;
    const result = await pool.query(
      `INSERT INTO requirements (req_id, title, client, stage, days_in_stage, stalled, priority, role_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req_id, title, client, stage || 'intake', days_in_stage || 0, stalled || false, priority || 'MED', role_type || '']
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/requirements/:id', async (req, res) => {
  try {
    const { req_id, title, client, stage, days_in_stage, stalled, priority, role_type } = req.body;
    await pool.query(
      `UPDATE requirements SET req_id=$1, title=$2, client=$3, stage=$4, days_in_stage=$5, stalled=$6, priority=$7, role_type=$8 WHERE id=$9`,
      [req_id, title, client, stage, days_in_stage || 0, stalled || false, priority, role_type, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/requirements/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM requirements WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PROJECTS
router.get('/admin/projects', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM projects ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/projects', async (req, res) => {
  try {
    const { name, client, stage, blocking_issue, team_size, start_date, end_date, utilization_pct } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (name, client, stage, blocking_issue, team_size, start_date, end_date, utilization_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, client, stage || 'green', blocking_issue || null, team_size || 0, start_date || null, end_date || null, utilization_pct || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/projects/:id', async (req, res) => {
  try {
    const { name, client, stage, blocking_issue, team_size, start_date, end_date, utilization_pct } = req.body;
    await pool.query(
      `UPDATE projects SET name=$1, client=$2, stage=$3, blocking_issue=$4, team_size=$5, start_date=$6, end_date=$7, utilization_pct=$8 WHERE id=$9`,
      [name, client, stage, blocking_issue || null, team_size || 0, start_date || null, end_date || null, utilization_pct || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/projects/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CONTRACTS
router.get('/admin/contracts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM contracts ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/contracts', async (req, res) => {
  try {
    const { sow_id, client, start_date, end_date, value, status, invoice_overdue, invoice_amount, utilization_pct } = req.body;
    const result = await pool.query(
      `INSERT INTO contracts (sow_id, client, start_date, end_date, value, status, invoice_overdue, invoice_amount, utilization_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [sow_id, client, start_date, end_date, value || 0, status || 'active', invoice_overdue || false, invoice_amount || 0, utilization_pct || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/contracts/:id', async (req, res) => {
  try {
    const { sow_id, client, start_date, end_date, value, status, invoice_overdue, invoice_amount, utilization_pct } = req.body;
    await pool.query(
      `UPDATE contracts SET sow_id=$1, client=$2, start_date=$3, end_date=$4, value=$5, status=$6, invoice_overdue=$7, invoice_amount=$8, utilization_pct=$9 WHERE id=$10`,
      [sow_id, client, start_date, end_date, value || 0, status, invoice_overdue || false, invoice_amount || 0, utilization_pct || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/contracts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM contracts WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ATTENTION ISSUES
router.get('/admin/attention', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM attention_issues ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/attention', async (req, res) => {
  try {
    const { priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled } = req.body;
    const result = await pool.query(
      `INSERT INTO attention_issues (priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled, resolved)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false) RETURNING *`,
      [priority || 'MED', entity_name, entity_type || 'requirement', entity_id || '', issue_description, action_label, days_stalled || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/attention/:id', async (req, res) => {
  try {
    const { priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled, resolved } = req.body;
    await pool.query(
      `UPDATE attention_issues SET priority=$1, entity_name=$2, entity_type=$3, entity_id=$4, issue_description=$5, action_label=$6, days_stalled=$7, resolved=$8 WHERE id=$9`,
      [priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled || 0, resolved || false, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/attention/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM attention_issues WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
