const express = require('express');
const router = express.Router();
const pool = require('../db');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');

// ── File upload config ────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '..', process.env.UPLOADS_DIR || 'uploads', 'projects');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

// ── SMTP transporter (lazy — only used when send-report is called) ─────────────
function getMailer() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

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

// ─── MARGINS ──────────────────────────────────────────────────────────────────

// Summary endpoint: per-requirement margin with computed margin_pct
router.get('/margins', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id, req_id, title, client, stage, priority, role_type,
        bill_rate, pay_rate,
        CASE WHEN bill_rate > 0
          THEN ROUND(((bill_rate - pay_rate) / bill_rate) * 100, 1)
          ELSE 0
        END AS margin_pct,
        (bill_rate - pay_rate) AS margin_abs
      FROM requirements
      WHERE bill_rate > 0
      ORDER BY margin_pct DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── LEADS ────────────────────────────────────────────────────────────────────

router.get('/leads', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/leads', async (req, res) => {
  try {
    const { company_name, contact_name, contact_email, contact_phone, source, status, estimated_value, notes, follow_up_date } = req.body;
    const result = await pool.query(
      `INSERT INTO leads (company_name, contact_name, contact_email, contact_phone, source, status, estimated_value, notes, follow_up_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [company_name, contact_name || null, contact_email || null, contact_phone || null, source || null, status || 'new', estimated_value || 0, notes || null, follow_up_date || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/leads/:id', async (req, res) => {
  try {
    const { company_name, contact_name, contact_email, contact_phone, source, status, estimated_value, notes, follow_up_date } = req.body;
    await pool.query(
      `UPDATE leads SET company_name=$1, contact_name=$2, contact_email=$3, contact_phone=$4, source=$5, status=$6, estimated_value=$7, notes=$8, follow_up_date=$9, updated_at=NOW() WHERE id=$10`,
      [company_name, contact_name || null, contact_email || null, contact_phone || null, source || null, status, estimated_value || 0, notes || null, follow_up_date || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/leads/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM leads WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
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
    const { name, role, status, bench_start_date, idle_hours, current_client, skills, pay_rate } = req.body;
    const skillsArr = typeof skills === 'string'
      ? skills.split(',').map(s => s.trim()).filter(Boolean)
      : (skills || []);
    const result = await pool.query(
      `INSERT INTO talent (name, role, status, bench_start_date, idle_hours, current_client, skills, pay_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, role, status || 'bench', bench_start_date || null, idle_hours || 0, current_client || null, skillsArr, pay_rate || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/talent/:id', async (req, res) => {
  try {
    const { name, role, status, bench_start_date, idle_hours, current_client, skills, pay_rate } = req.body;
    const skillsArr = typeof skills === 'string'
      ? skills.split(',').map(s => s.trim()).filter(Boolean)
      : (skills || []);
    await pool.query(
      `UPDATE talent SET name=$1, role=$2, status=$3, bench_start_date=$4, idle_hours=$5, current_client=$6, skills=$7, pay_rate=$8 WHERE id=$9`,
      [name, role, status, bench_start_date || null, idle_hours || 0, current_client || null, skillsArr, pay_rate || 0, req.params.id]
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
    const { req_id, title, client, stage, days_in_stage, stalled, priority, role_type, bill_rate, pay_rate } = req.body;
    // Auto-generate req_id if not supplied
    let finalReqId = req_id && req_id.trim() ? req_id.trim() : null;
    if (!finalReqId) {
      const year = new Date().getFullYear();
      const { rows } = await pool.query('SELECT MAX(id) AS max_id FROM requirements');
      const next = (rows[0].max_id || 0) + 1;
      finalReqId = `REQ-${year}-${String(next).padStart(3, '0')}`;
    }
    const result = await pool.query(
      `INSERT INTO requirements (req_id, title, client, stage, days_in_stage, stalled, priority, role_type, bill_rate, pay_rate)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [finalReqId, title, client, stage || 'intake', days_in_stage || 0, stalled || false, priority || 'MED', role_type || '', bill_rate || 0, pay_rate || 0]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/requirements/:id', async (req, res) => {
  try {
    const { req_id, title, client, stage, days_in_stage, stalled, priority, role_type, bill_rate, pay_rate } = req.body;
    await pool.query(
      `UPDATE requirements SET req_id=$1, title=$2, client=$3, stage=$4, days_in_stage=$5, stalled=$6, priority=$7, role_type=$8, bill_rate=$9, pay_rate=$10 WHERE id=$11`,
      [req_id, title, client, stage, days_in_stage || 0, stalled || false, priority, role_type, bill_rate || 0, pay_rate || 0, req.params.id]
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
    const { name, client, stage, blocking_issue, team_size, start_date, end_date, utilization_pct, industry, sector, geography } = req.body;
    const result = await pool.query(
      `INSERT INTO projects (name, client, stage, blocking_issue, team_size, start_date, end_date, utilization_pct, industry, sector, geography)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, client, stage || 'green', blocking_issue || null, team_size || 0, start_date || null, end_date || null, utilization_pct || 0, industry || null, sector || null, geography || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/projects/:id', async (req, res) => {
  try {
    const { name, client, stage, blocking_issue, team_size, start_date, end_date, utilization_pct, industry, sector, geography } = req.body;
    await pool.query(
      `UPDATE projects SET name=$1, client=$2, stage=$3, blocking_issue=$4, team_size=$5, start_date=$6, end_date=$7, utilization_pct=$8, industry=$9, sector=$10, geography=$11 WHERE id=$12`,
      [name, client, stage, blocking_issue || null, team_size || 0, start_date || null, end_date || null, utilization_pct || 0, industry || null, sector || null, geography || null, req.params.id]
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
    // Auto-generate sow_id if not supplied
    let finalSowId = sow_id && sow_id.trim() ? sow_id.trim() : null;
    if (!finalSowId) {
      const year = new Date().getFullYear();
      const { rows } = await pool.query('SELECT MAX(id) AS max_id FROM contracts');
      const next = (rows[0].max_id || 0) + 1;
      finalSowId = `SOW-${year}-${String(next).padStart(3, '0')}`;
    }
    const result = await pool.query(
      `INSERT INTO contracts (sow_id, client, start_date, end_date, value, status, invoice_overdue, invoice_amount, utilization_pct)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [finalSowId, client, start_date, end_date, value || 0, status || 'active', invoice_overdue || false, invoice_amount || 0, utilization_pct || 0]
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

// ─── INDUSTRIES AGGREGATION ────────────────────────────────────────────────────
router.get('/industries', async (req, res) => {
  try {
    const byIndustry = await pool.query(`
      SELECT industry, COUNT(*) AS project_count, SUM(team_size) AS total_team
      FROM projects WHERE industry IS NOT NULL
      GROUP BY industry ORDER BY project_count DESC
    `);
    const bySector = await pool.query(`
      SELECT industry, sector, COUNT(*) AS project_count
      FROM projects WHERE industry IS NOT NULL AND sector IS NOT NULL
      GROUP BY industry, sector ORDER BY industry, project_count DESC
    `);
    const byGeo = await pool.query(`
      SELECT geography, COUNT(*) AS project_count
      FROM projects WHERE geography IS NOT NULL
      GROUP BY geography ORDER BY project_count DESC
    `);
    res.json({ byIndustry: byIndustry.rows, bySector: bySector.rows, byGeo: byGeo.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CASE STUDIES ─────────────────────────────────────────────────────────────
router.get('/case-studies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM case_studies ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/admin/case-studies', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM case_studies ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/case-studies', async (req, res) => {
  try {
    const { project_id, title, client, industry, sector, challenge, solution, results, metrics, tags, published } = req.body;
    const tagsArr = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    const metricsObj = typeof metrics === 'object' ? metrics : {};
    const result = await pool.query(
      `INSERT INTO case_studies (project_id, title, client, industry, sector, challenge, solution, results, metrics, tags, published, ai_generated)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false) RETURNING *`,
      [project_id || null, title, client || null, industry || null, sector || null, challenge || null, solution || null, results || null, JSON.stringify(metricsObj), tagsArr, published || false]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/case-studies/:id', async (req, res) => {
  try {
    const { project_id, title, client, industry, sector, challenge, solution, results, metrics, tags, published } = req.body;
    const tagsArr = Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    const metricsObj = typeof metrics === 'object' ? metrics : {};
    await pool.query(
      `UPDATE case_studies SET project_id=$1, title=$2, client=$3, industry=$4, sector=$5, challenge=$6, solution=$7, results=$8, metrics=$9, tags=$10, published=$11, updated_at=NOW() WHERE id=$12`,
      [project_id || null, title, client || null, industry || null, sector || null, challenge || null, solution || null, results || null, JSON.stringify(metricsObj), tagsArr, published || false, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/case-studies/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM case_studies WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PROJECT DOCUMENTS ─────────────────────────────────────────────────────────
router.get('/projects/:id/documents', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pd.*, u.name AS uploaded_by_name FROM project_documents pd
       LEFT JOIN users u ON u.id = pd.uploaded_by
       WHERE pd.project_id = $1 ORDER BY pd.uploaded_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/projects/:id/documents', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { doc_type } = req.body;
    const result = await pool.query(
      `INSERT INTO project_documents (project_id, doc_type, file_name, file_path, file_size, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.params.id, doc_type || 'Other', req.file.originalname, req.file.filename, req.file.size, req.user?.id || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/projects/documents/:docId/file', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM project_documents WHERE id = $1', [req.params.docId]);
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(UPLOADS_DIR, rows[0].file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
    res.download(filePath, rows[0].file_name);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/projects/documents/:docId', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM project_documents WHERE id = $1', [req.params.docId]);
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });
    const filePath = path.join(UPLOADS_DIR, rows[0].file_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await pool.query('DELETE FROM project_documents WHERE id = $1', [req.params.docId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AI CASE STUDY GENERATION ─────────────────────────────────────────────────
router.post('/projects/documents/:docId/generate-case-study', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM project_documents WHERE id = $1', [req.params.docId]);
    if (!rows.length) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(UPLOADS_DIR, rows[0].file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

    // Extract text from PDF
    let docText = '';
    if (rows[0].file_name.toLowerCase().endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const fileBuffer = fs.readFileSync(filePath);
      const parsed = await pdfParse(fileBuffer);
      docText = parsed.text.slice(0, 12000); // limit tokens
    } else {
      docText = fs.readFileSync(filePath, 'utf8').slice(0, 12000);
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your')) {
      return res.status(400).json({ error: 'OPENAI_API_KEY is not configured. Please set it in your .env file.' });
    }

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert technical writer for TechnoElevate, a staffing and technology consulting firm.
Given a document (RFP or SOW), extract and generate a professional case study in JSON format with exactly these fields:
- title: a compelling case study headline (string)
- client: client name — use "A Leading [Industry] Company" if not clear (string)
- industry: one of [FinTech, HealthTech, Retail, Manufacturing, Technology, BFSI, Telecom, Other] (string)
- sector: specific sub-sector (string)
- challenge: 2-3 sentences describing the business problem (string)
- solution: 3-4 sentences describing the engagement and TechnoElevate's approach (string)
- results: 2-3 sentences on outcomes and value delivered (string)
- metrics: object with up to 5 key-value pairs of quantified results (object)
- tags: array of relevant technology/skill tags, max 6 (array of strings)
Return ONLY valid JSON, no extra text.`
        },
        {
          role: 'user',
          content: `Document content:\n\n${docText}`
        }
      ],
    });

    const generated = JSON.parse(completion.choices[0].message.content);
    res.json({ ...generated, ai_generated: true, source_doc_id: rows[0].id, project_id: rows[0].project_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── SEND REPORT ──────────────────────────────────────────────────────────────
router.post('/reports/send', async (req, res) => {
  try {
    const { reportType, recipients, message, subject, htmlContent } = req.body;
    if (!recipients || !recipients.length) return res.status(400).json({ error: 'No recipients provided' });
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      return res.status(400).json({ error: 'SMTP is not configured. Please set SMTP_USER and SMTP_PASS in your .env file.' });
    }
    const mailer = getMailer();
    await mailer.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: recipients.join(', '),
      subject: subject || `TechnoElevate — ${reportType} Report`,
      html: `
        <div style="font-family:sans-serif;max-width:700px;margin:auto">
          <div style="background:#0f172a;padding:20px 30px;border-radius:8px 8px 0 0">
            <h2 style="color:#4f7cff;margin:0">TechnoElevate</h2>
            <p style="color:#94a3b8;margin:4px 0 0">${reportType} Report</p>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:none;padding:24px 30px;border-radius:0 0 8px 8px">
            ${message ? `<p style="color:#374151">${message}</p><hr style="border:none;border-top:1px solid #e2e8f0;margin:16px 0">` : ''}
            ${htmlContent || '<p style="color:#6b7280">Please find the report attached.</p>'}
            <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0 12px">
            <p style="color:#9ca3af;font-size:12px">Sent from TechnoElevate Operations Platform</p>
          </div>
        </div>`,
    });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
