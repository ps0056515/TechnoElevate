const express = require('express');
const router = express.Router();
const pool = require('../db');
const path = require('path');
const fs = require('fs');
const { spawnSync } = require('child_process');
const multer = require('multer');
const nodemailer = require('nodemailer');
const { requireAdmin } = require('../middleware/auth');
const { loadBdDarSnapshot, defaultBdDarPath } = require('../loadBdDarSnapshot');
const { computeAll } = require('../lib/bdOperationsKpi');
const { buildVpView } = require('../lib/vpTargets');
const { buildBoardSummary } = require('../lib/bdBoardSummary');
const { getInvoiceRevenueCrore } = require('../lib/invoiceRevenueCrore');

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
    const result = await pool.query(`
      SELECT r.*,
             l.company_name AS lead_company,
             t.name AS assigned_talent_name, t.role AS assigned_talent_role,
             c.sow_id AS contract_sow_id
      FROM requirements r
      LEFT JOIN leads l ON r.lead_id = l.id
      LEFT JOIN talent t ON r.assigned_talent_id = t.id
      LEFT JOIN contracts c ON r.contract_id = c.id
      ORDER BY CASE r.priority WHEN 'HIGH' THEN 1 WHEN 'MED' THEN 2 ELSE 3 END, r.days_in_stage DESC
    `);
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

    // Auto-create engagement when requirement reaches closure
    if (stage === 'closure') {
      const { rows } = await pool.query(
        `SELECT r.*, t.name AS talent_name, t.role AS talent_role
         FROM requirements r
         LEFT JOIN talent t ON r.assigned_talent_id = t.id
         WHERE r.id = $1`,
        [req.params.id]
      );
      const reqRow = rows[0];
      if (reqRow && reqRow.assigned_talent_id) {
        // Create engagement
        const engResult = await pool.query(
          `INSERT INTO engagements (talent_id, talent_name, client, role, start_date, req_id)
           VALUES ($1,$2,$3,$4,CURRENT_DATE,$5) RETURNING id`,
          [reqRow.assigned_talent_id, reqRow.talent_name, reqRow.client, reqRow.title, reqRow.id]
        );
        const engId = engResult.rows[0].id;

        // Create 7-stage compliance checklist
        const stages = [
          { num: 1, name: 'Onboarding Docs' },
          { num: 2, name: 'Background Check' },
          { num: 3, name: 'Client Intro' },
          { num: 4, name: 'Access Provisioning' },
          { num: 5, name: 'First Week Check-in' },
          { num: 6, name: 'Month-1 Review' },
          { num: 7, name: 'Ongoing Compliance' },
        ];
        for (const s of stages) {
          const due = new Date();
          due.setDate(due.getDate() + s.num * 7);
          await pool.query(
            `INSERT INTO engagement_checklist_items (engagement_id, stage_number, stage_name, item_name, due_date)
             VALUES ($1,$2,$3,$4,$5)`,
            [engId, s.num, s.name, `${s.name} — ${reqRow.talent_name}`, due.toISOString().split('T')[0]]
          );
        }
        // Update talent status to deployed
        await pool.query('UPDATE talent SET status = $1, current_client = $2 WHERE id = $3',
          ['deployed', reqRow.client, reqRow.assigned_talent_id]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign talent to a requirement
router.patch('/pipeline/:id/assign', async (req, res) => {
  try {
    const { talent_id } = req.body;
    await pool.query(
      'UPDATE requirements SET assigned_talent_id = $1 WHERE id = $2',
      [talent_id || null, req.params.id]
    );
    // Mark talent as in_process when assigned
    if (talent_id) {
      const { rows } = await pool.query('SELECT client FROM requirements WHERE id = $1', [req.params.id]);
      await pool.query(
        'UPDATE talent SET status = $1, current_client = $2 WHERE id = $3 AND status = $4',
        ['in_process', rows[0]?.client || null, talent_id, 'bench']
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link a requirement to a contract
router.patch('/pipeline/:id/link-contract', async (req, res) => {
  try {
    const { contract_id } = req.body;
    await pool.query(
      'UPDATE requirements SET contract_id = $1 WHERE id = $2',
      [contract_id || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Available talent for assignment (bench + in_process)
router.get('/talent/available', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, status, skills, pay_rate
       FROM talent WHERE status IN ('bench','in_process') ORDER BY status, name`
    );
    res.json(result.rows);
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
    const contracts = await pool.query(
      `SELECT *, (end_date - CURRENT_DATE) AS days_remaining FROM contracts ORDER BY CASE status WHEN 'expired' THEN 1 WHEN 'expiring_soon' THEN 2 ELSE 3 END, end_date ASC`
    );
    // Attach linked requirements with margin to each contract
    const reqs = await pool.query(
      `SELECT r.id, r.req_id, r.title, r.stage, r.priority, r.role_type,
              r.bill_rate, r.pay_rate, r.contract_id,
              t.name AS assigned_talent_name,
              CASE WHEN r.bill_rate > 0
                THEN ROUND(((r.bill_rate - r.pay_rate) / r.bill_rate) * 100, 1)
                ELSE NULL END AS margin_pct
       FROM requirements r
       LEFT JOIN talent t ON r.assigned_talent_id = t.id
       WHERE r.contract_id IS NOT NULL`
    );
    const reqsByContract = {};
    reqs.rows.forEach(r => {
      if (!reqsByContract[r.contract_id]) reqsByContract[r.contract_id] = [];
      reqsByContract[r.contract_id].push(r);
    });
    const result = contracts.rows.map(c => {
      const linked = reqsByContract[c.id] || [];
      const ratedReqs = linked.filter(r => parseFloat(r.bill_rate) > 0);
      const avgMargin = ratedReqs.length > 0
        ? Math.round(ratedReqs.reduce((s, r) => s + parseFloat(r.margin_pct), 0) / ratedReqs.length)
        : null;
      return { ...c, linked_requirements: linked, avg_margin: avgMargin };
    });
    res.json(result);
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
    const result = await pool.query(`
      SELECT r.*,
             l.company_name AS lead_company,
             t.name AS assigned_talent_name, t.role AS assigned_talent_role,
             c.sow_id AS contract_sow_id
      FROM requirements r
      LEFT JOIN leads l ON r.lead_id = l.id
      LEFT JOIN talent t ON r.assigned_talent_id = t.id
      LEFT JOIN contracts c ON r.contract_id = c.id
      ORDER BY r.id DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/requirements', async (req, res) => {
  try {
    const { title, client, stage, days_in_stage, stalled, priority, role_type, bill_rate, pay_rate, lead_id, contract_id } = req.body;
    // Always auto-generate req_id
    const year = new Date().getFullYear();
    const { rows } = await pool.query('SELECT MAX(id) AS max_id FROM requirements');
    const next = (rows[0].max_id || 0) + 1;
    const finalReqId = `REQ-${year}-${String(next).padStart(3, '0')}`;

    const result = await pool.query(
      `INSERT INTO requirements (req_id, title, client, stage, days_in_stage, stalled, priority, role_type, bill_rate, pay_rate, lead_id, contract_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [finalReqId, title, client, stage || 'intake', days_in_stage || 0, stalled || false, priority || 'MED', role_type || '', bill_rate || 0, pay_rate || 0, lead_id || null, contract_id || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/requirements/:id', async (req, res) => {
  try {
    const { req_id, title, client, stage, days_in_stage, stalled, priority, role_type, bill_rate, pay_rate, lead_id, contract_id } = req.body;
    await pool.query(
      `UPDATE requirements SET req_id=$1, title=$2, client=$3, stage=$4, days_in_stage=$5, stalled=$6, priority=$7, role_type=$8, bill_rate=$9, pay_rate=$10, lead_id=$11, contract_id=$12 WHERE id=$13`,
      [req_id, title, client, stage, days_in_stage || 0, stalled || false, priority, role_type, bill_rate || 0, pay_rate || 0, lead_id || null, contract_id || null, req.params.id]
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

// Requirements linked to a specific lead
router.get('/leads/:id/requirements', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, req_id, title, client, stage, priority, role_type, bill_rate, pay_rate,
              CASE WHEN bill_rate > 0 THEN ROUND(((bill_rate - pay_rate) / bill_rate) * 100, 1) ELSE 0 END AS margin_pct
       FROM requirements WHERE lead_id = $1 ORDER BY id DESC`,
      [req.params.id]
    );
    res.json(result.rows);
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
    const result = await pool.query(
      `SELECT c.*, (c.end_date - CURRENT_DATE) AS days_remaining,
              COUNT(r.id) AS linked_req_count,
              ROUND(AVG(CASE WHEN r.bill_rate > 0 THEN ((r.bill_rate - r.pay_rate) / r.bill_rate) * 100 END), 1) AS avg_margin
       FROM contracts c
       LEFT JOIN requirements r ON r.contract_id = c.id
       GROUP BY c.id
       ORDER BY c.id DESC`
    );
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

// ─── AI HELPERS ───────────────────────────────────────────────────────────────
function getOpenAI() {
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your')) {
    throw new Error('OPENAI_API_KEY is not configured. Please add it to backend/.env');
  }
  const { OpenAI } = require('openai');
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

async function aiChat(messages, jsonMode = true) {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    messages,
  });
  const content = res.choices[0].message.content;
  return jsonMode ? JSON.parse(content) : content;
}

// ─── AI 1: Resume / CV Parser ─────────────────────────────────────────────────
// POST /api/talent/parse-resume  (multipart: field "resume")
const resumeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', 'uploads', 'resumes');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}_${safe}`);
  },
});
const uploadResume = multer({ storage: resumeStorage, limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/talent/parse-resume', uploadResume.single('resume'), async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    let text = '';
    if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      text = (await pdfParse(fs.readFileSync(filePath))).text.slice(0, 14000);
    } else {
      text = fs.readFileSync(filePath, 'utf8').slice(0, 14000);
    }

    const result = await aiChat([
      {
        role: 'system',
        content: `You are an expert HR data extractor. Given a resume/CV, extract structured data and return a JSON object with these exact fields:
- name: full name (string)
- role: job title / primary role (string, e.g. "React Developer", "DevOps Engineer")
- skills: array of technical skills, max 10 (array of strings)
- pay_rate: estimated monthly market rate in USD as a number — base on experience and role (number, e.g. 9500)
- experience_years: years of experience as a number (number)
- summary: 1–2 sentence professional summary (string)
- current_employer: current or most recent employer (string or null)
Return ONLY valid JSON, no extra text.`,
      },
      { role: 'user', content: `Resume text:\n\n${text}` },
    ]);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
});

// ─── AI 2: Requirement → Talent Matcher ───────────────────────────────────────
// GET /api/requirements/:id/match-talent
router.get('/requirements/:id/match-talent', async (req, res) => {
  try {
    const { rows: [req_row] } = await pool.query('SELECT * FROM requirements WHERE id=$1', [req.params.id]);
    if (!req_row) return res.status(404).json({ error: 'Requirement not found' });

    const { rows: talent } = await pool.query(
      `SELECT id, name, role, skills, pay_rate, idle_hours, bench_start_date
       FROM talent WHERE status IN ('bench','in_process') ORDER BY idle_hours DESC`
    );

    if (!talent.length) return res.json({ matches: [], message: 'No available talent on bench' });

    const talentList = talent.map(t => ({
      id: t.id,
      name: t.name,
      role: t.role,
      skills: Array.isArray(t.skills) ? t.skills : [],
      pay_rate: t.pay_rate,
      idle_hours: t.idle_hours,
    }));

    const result = await aiChat([
      {
        role: 'system',
        content: `You are a talent matching specialist. Given a job requirement and a list of available engineers, rank the top 5 best matches.
Return a JSON object with key "matches" — an array of up to 5 objects, each with:
- talent_id: the id of the matched engineer (number)
- name: engineer name (string)
- match_score: match quality 0–100 (number)
- match_reason: 1-sentence explanation of why this person fits (string)
- skill_overlap: array of matching skills (array of strings)
- gap: any notable skill gap (string or null)
Order by match_score descending.`,
      },
      {
        role: 'user',
        content: `Requirement: "${req_row.title}" | Client: ${req_row.client} | Role type: ${req_row.role_type} | Bill rate: $${req_row.bill_rate}/mo\n\nAvailable talent:\n${JSON.stringify(talentList, null, 2)}`,
      },
    ]);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI 3: Email Draft Generator ─────────────────────────────────────────────
// POST /api/ai/draft-email   body: { context_type, entity_id, entity_name, issue, recipient_name }
router.post('/ai/draft-email', async (req, res) => {
  try {
    const { context_type, entity_name, issue, recipient_name, extra } = req.body;

    const contextMap = {
      requirement:  'a staffing requirement that has stalled with no candidate submissions',
      contract:     'an expiring Statement of Work / contract that needs renewal',
      invoice:      'an overdue invoice that requires payment follow-up',
      talent:       'an engineer who has been on the bench idle for too long',
      lead:         'a sales lead that needs a follow-up to move the deal forward',
    };

    const text = await aiChat([
      {
        role: 'system',
        content: `You are a professional business communications writer for TechnoElevate, a technology staffing and consulting firm.
Write concise, professional business emails. Output JSON with:
- subject: email subject line (string)
- body: full email body with greeting, context, ask, and sign-off (string, use \\n for line breaks)
- tone: the tone used — one of [professional, urgent, friendly] (string)`,
      },
      {
        role: 'user',
        content: `Write an email about: ${contextMap[context_type] || issue}
Entity: ${entity_name}
Recipient: ${recipient_name || 'the client/team'}
Additional context: ${extra || issue || 'N/A'}
Sign-off name: TechnoElevate Operations Team`,
      },
    ]);

    res.json(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI 4: Project Risk Predictor ────────────────────────────────────────────
// POST /api/ai/risk-check   body: { project_id } — or leave blank to check all active projects
router.post('/ai/risk-check', async (req, res) => {
  try {
    const filter = req.body?.project_id ? 'AND p.id=$1' : '';
    const params = req.body?.project_id ? [req.body.project_id] : [];

    const { rows: projects } = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM project_milestones WHERE project_id=p.id) AS total_milestones,
        (SELECT COUNT(*) FROM project_milestones WHERE project_id=p.id AND completed=true) AS done_milestones,
        (SELECT COUNT(*) FROM project_talent WHERE project_id=p.id) AS actual_team_size
      FROM projects p
      WHERE p.stage NOT IN ('completed') ${filter}
      ORDER BY p.start_date
    `, params);

    if (!projects.length) return res.json({ risks: [] });

    const result = await aiChat([
      {
        role: 'system',
        content: `You are a project risk analyst for a technology consulting firm. Analyse active projects and flag risks.
Return JSON with key "risks" — an array of objects, one per project that has a meaningful risk, each with:
- project_id: id (number)
- project_name: name (string)
- risk_level: "HIGH", "MED", or "LOW" (string)
- risk_summary: 1-sentence summary of the primary risk (string)
- signals: array of specific risk signals detected (array of strings)
- recommendation: specific action to mitigate risk (string)
Only include projects with MED or HIGH risk. Skip healthy projects.`,
      },
      {
        role: 'user',
        content: `Active projects:\n${JSON.stringify(projects.map(p => ({
          id: p.id, name: p.name, client: p.client, stage: p.stage, phase: p.phase,
          utilization: p.utilization_pct, team_size: p.team_size,
          actual_team_size: parseInt(p.actual_team_size),
          budget: p.budget, actual_spend: p.actual_spend,
          milestones: `${p.done_milestones}/${p.total_milestones} done`,
          blocking_issue: p.blocking_issue,
          start_date: p.start_date, end_date: p.end_date,
        })), null, 2)}`,
      },
    ]);

    // Update project stages automatically for HIGH risk projects
    for (const risk of (result.risks || [])) {
      if (risk.risk_level === 'HIGH') {
        await pool.query(
          `UPDATE projects SET stage='at_risk' WHERE id=$1 AND stage='green'`,
          [risk.project_id]
        );
        // Add attention issue
        await pool.query(`
          INSERT INTO attention_issues
            (priority, entity_name, entity_type, entity_id, issue_description, action_label)
          VALUES ('HIGH',$1,'project',$2,$3,'Review Project')
          ON CONFLICT DO NOTHING
        `, [risk.project_name, String(risk.project_id), risk.risk_summary]);
      }
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── AI 5: Proposal / SOW Draft Writer ───────────────────────────────────────
// POST /api/leads/:id/draft-proposal
router.post('/leads/:id/draft-proposal', async (req, res) => {
  try {
    const { rows: [lead] } = await pool.query('SELECT * FROM leads WHERE id=$1', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    // Fetch linked requirements for scope context
    const { rows: reqs } = await pool.query(
      'SELECT title, role_type, bill_rate FROM requirements WHERE lead_id=$1',
      [lead.id]
    );

    const result = await aiChat([
      {
        role: 'system',
        content: `You are a senior proposal writer at TechnoElevate, a technology staffing and consulting firm.
Write a professional Statement of Work (SOW) / proposal outline. Return JSON with:
- title: proposal title (string)
- executive_summary: 2-3 sentences positioning TechnoElevate's value (string)
- scope_of_work: array of 3-5 scope items — each a string describing a deliverable (array)
- engagement_model: proposed engagement model e.g. T&M / Fixed Price / Retainer (string)
- team_composition: array of proposed roles with count e.g. ["2x React Developer", "1x DevOps Engineer"] (array)
- timeline: proposed timeline e.g. "12 weeks / 3 months" (string)
- estimated_value: estimated contract value as a formatted string e.g. "$280,000" (string)
- terms: array of 3 key commercial terms (array)
- next_steps: array of 3 recommended next steps to close the deal (array)`,
      },
      {
        role: 'user',
        content: `Lead details:
Company: ${lead.company_name}
Contact: ${lead.contact_name || 'N/A'}
Estimated deal value: $${lead.estimated_value || 0}
Status: ${lead.status}
Notes: ${lead.notes || 'N/A'}

Linked requirements:
${reqs.length ? reqs.map(r => `- ${r.title} (${r.role_type}) @ $${r.bill_rate}/mo`).join('\n') : 'No requirements linked yet'}`,
      },
    ]);

    res.json({ ...result, lead_id: lead.id, company: lead.company_name, generated_at: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── INVOICES ─────────────────────────────────────────────────────────────────
router.get('/admin/invoices', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, c.sow_id FROM invoices i LEFT JOIN contracts c ON i.contract_id = c.id ORDER BY i.issued_date DESC`
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/contracts/:id/invoices', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM invoices WHERE contract_id=$1 ORDER BY issued_date DESC', [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/admin/invoices', async (req, res) => {
  try {
    const { contract_id, engagement_id, client, amount, issued_date, due_date, notes } = req.body;
    const year = new Date().getFullYear();
    const { rows: cnt } = await pool.query('SELECT COUNT(*) FROM invoices');
    const num = `INV-${year}-${String(parseInt(cnt[0].count) + 1).padStart(4, '0')}`;
    const result = await pool.query(
      `INSERT INTO invoices (invoice_number, contract_id, engagement_id, client, amount, issued_date, due_date, status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8) RETURNING *`,
      [num, contract_id || null, engagement_id || null, client, amount, issued_date, due_date, notes || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/admin/invoices/:id', async (req, res) => {
  try {
    const { client, amount, issued_date, due_date, paid_date, status, notes } = req.body;
    await pool.query(
      `UPDATE invoices SET client=$1, amount=$2, issued_date=$3, due_date=$4, paid_date=$5, status=$6, notes=$7 WHERE id=$8`,
      [client, amount, issued_date, due_date, paid_date || null, status, notes || null, req.params.id]
    );
    // Sync contract invoice_overdue flag
    const { rows } = await pool.query('SELECT contract_id FROM invoices WHERE id=$1', [req.params.id]);
    if (rows[0]?.contract_id) {
      const { rows: overdueRows } = await pool.query(
        `SELECT COUNT(*) FROM invoices WHERE contract_id=$1 AND status='overdue'`, [rows[0].contract_id]
      );
      await pool.query('UPDATE contracts SET invoice_overdue=$1 WHERE id=$2',
        [parseInt(overdueRows[0].count) > 0, rows[0].contract_id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/admin/invoices/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM invoices WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── ENGAGEMENT CLOSURE ───────────────────────────────────────────────────────
router.patch('/engagements/:id/close', async (req, res) => {
  try {
    const { end_reason } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      `UPDATE engagements SET status='completed', end_date=$1, end_reason=$2 WHERE id=$3 RETURNING *`,
      [today, end_reason || null, req.params.id]
    );
    if (rows[0]?.talent_id) {
      await pool.query(`UPDATE talent SET status='bench', current_client=NULL WHERE id=$1`, [rows[0].talent_id]);
    }
    res.json({ success: true, engagement: rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REVENUE FORECAST + BENCH COST + P&L ─────────────────────────────────────
router.get('/forecast', async (req, res) => {
  try {
    // Requirements in late stages (value at risk / probable revenue)
    const reqs = await pool.query(`
      SELECT stage, COUNT(*) AS count,
             SUM(COALESCE(bill_rate,0)) AS total_bill,
             SUM(COALESCE(pay_rate,0)) AS total_cost
      FROM requirements WHERE stage IN ('screening','interviewing','closure') AND bill_rate > 0
      GROUP BY stage`);

    // Contracts expiring within 90 days
    const expiring = await pool.query(`
      SELECT id, sow_id, client, value, end_date, (end_date - CURRENT_DATE) AS days_left
      FROM contracts WHERE status IN ('active','expiring_soon') AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 90`);

    // Active contract revenue
    const revenue = await pool.query(`SELECT COALESCE(SUM(value),0) AS total FROM contracts WHERE status='active'`);

    // Bench cost (monthly)
    const bench = await pool.query(`SELECT COALESCE(SUM(pay_rate),0) AS bench_cost FROM talent WHERE status='bench' AND pay_rate > 0`);

    // Deployed talent monthly cost
    const deployed = await pool.query(`SELECT COALESCE(SUM(pay_rate),0) AS deployed_cost FROM talent WHERE status='deployed' AND pay_rate > 0`);

    // Pipeline value (30/60/90 day estimate from requirements)
    const pipeline30 = reqs.rows.filter(r => r.stage === 'closure').reduce((s, r) => s + parseFloat(r.total_bill), 0);
    const pipeline60 = reqs.rows.filter(r => ['interviewing','closure'].includes(r.stage)).reduce((s, r) => s + parseFloat(r.total_bill), 0);
    const pipeline90 = reqs.rows.reduce((s, r) => s + parseFloat(r.total_bill), 0);

    res.json({
      active_revenue: parseFloat(revenue.rows[0].total),
      bench_cost_monthly: parseFloat(bench.rows[0].bench_cost),
      deployed_cost_monthly: parseFloat(deployed.rows[0].deployed_cost),
      gross_margin_monthly: parseFloat(revenue.rows[0].total) / 12 - parseFloat(deployed.rows[0].deployed_cost),
      pipeline_30d: pipeline30,
      pipeline_60d: pipeline60,
      pipeline_90d: pipeline90,
      expiring_contracts: expiring.rows,
      pipeline_by_stage: reqs.rows,
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AUTO-ALERT GENERATION ────────────────────────────────────────────────────
router.post('/attention/auto-generate', async (req, res) => {
  try {
    const created = [];
    // Bench idle > 30 days
    const { rows: idleTalent } = await pool.query(
      `SELECT id, name, bench_start_date FROM talent WHERE status='bench' AND bench_start_date IS NOT NULL AND bench_start_date <= CURRENT_DATE - 30`
    );
    for (const t of idleTalent) {
      const days = Math.floor((Date.now() - new Date(t.bench_start_date)) / 86400000);
      const exists = await pool.query(`SELECT id FROM attention_issues WHERE entity_id=$1 AND entity_type='talent' AND resolved=FALSE`, [String(t.id)]);
      if (!exists.rows.length) {
        await pool.query(
          `INSERT INTO attention_issues (priority,entity_name,entity_type,entity_id,issue_description,action_label,days_stalled)
           VALUES ('HIGH',$1,'talent',$2,$3,'Assign to Project',$4)`,
          [t.name, String(t.id), `Bench idle for ${days} days — generating cost with no revenue`, days]
        );
        created.push(t.name);
      }
    }
    // Requirements stalled > 7 days
    const { rows: stalledReqs } = await pool.query(
      `SELECT id, req_id, title, client, days_in_stage FROM requirements WHERE stalled=TRUE AND stage != 'closure'`
    );
    for (const r of stalledReqs) {
      const exists = await pool.query(`SELECT id FROM attention_issues WHERE entity_id=$1 AND entity_type='requirement' AND resolved=FALSE`, [String(r.id)]);
      if (!exists.rows.length) {
        await pool.query(
          `INSERT INTO attention_issues (priority,entity_name,entity_type,entity_id,issue_description,action_label,days_stalled)
           VALUES ('MED',$1,'requirement',$2,$3,'Review Requirement',$4)`,
          [`${r.req_id} — ${r.title}`, String(r.id), `Stalled at ${r.stage} for ${r.days_in_stage} days — ${r.client}`, r.days_in_stage]
        );
        created.push(r.req_id);
      }
    }
    // Contracts expiring < 30 days
    const { rows: expiringC } = await pool.query(
      `SELECT id, sow_id, client, (end_date - CURRENT_DATE) AS days_left FROM contracts WHERE status='active' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30`
    );
    for (const c of expiringC) {
      const exists = await pool.query(`SELECT id FROM attention_issues WHERE entity_id=$1 AND entity_type='contract' AND resolved=FALSE`, [String(c.id)]);
      if (!exists.rows.length) {
        await pool.query(
          `INSERT INTO attention_issues (priority,entity_name,entity_type,entity_id,issue_description,action_label,days_stalled)
           VALUES ('HIGH',$1,'contract',$2,$3,'Renew Contract',$4)`,
          [c.sow_id, String(c.id), `Contract expiring in ${c.days_left} days — ${c.client}`, c.days_left]
        );
        created.push(c.sow_id);
      }
    }
    // Invoices overdue (due_date passed, not paid)
    const { rows: overdueInv } = await pool.query(
      `SELECT id, invoice_number, client, amount FROM invoices WHERE status IN ('pending','sent') AND due_date < CURRENT_DATE`
    );
    for (const inv of overdueInv) {
      await pool.query(`UPDATE invoices SET status='overdue' WHERE id=$1`, [inv.id]);
      const exists = await pool.query(`SELECT id FROM attention_issues WHERE entity_id=$1 AND entity_type='invoice' AND resolved=FALSE`, [String(inv.id)]);
      if (!exists.rows.length) {
        await pool.query(
          `INSERT INTO attention_issues (priority,entity_name,entity_type,entity_id,issue_description,action_label,days_stalled)
           VALUES ('HIGH',$1,'invoice',$2,$3,'Send Reminder',0)`,
          [inv.invoice_number, String(inv.id), `Invoice overdue from ${inv.client} — $${inv.amount}`]
        );
        created.push(inv.invoice_number);
      }
    }
    res.json({ created: created.length, items: created });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REQUIREMENT REJECTION ────────────────────────────────────────────────────
router.patch('/pipeline/:id/reject', async (req, res) => {
  try {
    const { rejection_reason } = req.body;
    await pool.query(
      `UPDATE requirements SET stage='sourcing', rejection_reason=$1, days_in_stage=0, stalled=FALSE WHERE id=$2`,
      [rejection_reason || null, req.params.id]
    );
    // Free the assigned talent back to bench
    const { rows } = await pool.query(`SELECT assigned_talent_id FROM requirements WHERE id=$1`, [req.params.id]);
    if (rows[0]?.assigned_talent_id) {
      await pool.query(`UPDATE talent SET status='bench', current_client=NULL WHERE id=$1`, [rows[0].assigned_talent_id]);
      await pool.query(`UPDATE requirements SET assigned_talent_id=NULL WHERE id=$1`, [req.params.id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── REQUIREMENT CANDIDATES ───────────────────────────────────────────────────
router.get('/requirements/:id/candidates', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT rc.*, t.name AS talent_name, t.role AS talent_role, t.status AS talent_status, t.pay_rate
       FROM requirement_candidates rc JOIN talent t ON rc.talent_id = t.id
       WHERE rc.req_id=$1 ORDER BY rc.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/requirements/:id/candidates', async (req, res) => {
  try {
    const { talent_id, status, feedback } = req.body;
    const result = await pool.query(
      `INSERT INTO requirement_candidates (req_id, talent_id, status, feedback) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, talent_id, status || 'submitted', feedback || null]
    );
    await pool.query(`UPDATE requirements SET submitted_count = submitted_count + 1 WHERE id=$1`, [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/requirements/:id/candidates/:cid', async (req, res) => {
  try {
    const { status, feedback, rejection_reason } = req.body;
    await pool.query(
      `UPDATE requirement_candidates SET status=$1, feedback=$2, rejection_reason=$3 WHERE id=$4 AND req_id=$5`,
      [status, feedback || null, rejection_reason || null, req.params.cid, req.params.id]
    );
    if (status === 'interviewing') {
      await pool.query(`UPDATE requirements SET interview_count = interview_count + 1 WHERE id=$1`, [req.params.id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PROJECT PHASES + MILESTONES ──────────────────────────────────────────────
router.patch('/admin/projects/:id/phase', async (req, res) => {
  try {
    const { phase, budget, actual_spend } = req.body;
    await pool.query(
      `UPDATE projects SET phase=COALESCE($1,phase), budget=COALESCE($2,budget), actual_spend=COALESCE($3,actual_spend) WHERE id=$4`,
      [phase || null, budget || null, actual_spend || null, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/projects/:id/milestones', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM project_milestones WHERE project_id=$1 ORDER BY due_date ASC', [req.params.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/projects/:id/milestones', async (req, res) => {
  try {
    const { title, due_date, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO project_milestones (project_id, title, due_date, notes) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.id, title, due_date || null, notes || null]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.patch('/projects/milestones/:id', async (req, res) => {
  try {
    const { completed, completed_date, notes } = req.body;
    await pool.query(
      `UPDATE project_milestones SET completed=$1, completed_date=$2, notes=COALESCE($3,notes) WHERE id=$4`,
      [completed, completed ? (completed_date || new Date().toISOString().split('T')[0]) : null, notes, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/projects/milestones/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM project_milestones WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PROJECT TEAM ─────────────────────────────────────────────────────────────
router.get('/projects/:id/team', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pt.*, t.name, t.role AS talent_role, t.status, t.pay_rate, t.skills
       FROM project_talent pt JOIN talent t ON pt.talent_id = t.id
       WHERE pt.project_id=$1 ORDER BY pt.joined_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/projects/:id/team', async (req, res) => {
  try {
    const { talent_id, role } = req.body;
    const result = await pool.query(
      `INSERT INTO project_talent (project_id, talent_id, role) VALUES ($1,$2,$3) ON CONFLICT (project_id,talent_id) DO UPDATE SET role=$3 RETURNING *`,
      [req.params.id, talent_id, role || null]
    );
    await pool.query(`UPDATE talent SET status='deployed' WHERE id=$1 AND status='bench'`, [talent_id]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/projects/:id/team/:talentId', async (req, res) => {
  try {
    await pool.query('DELETE FROM project_talent WHERE project_id=$1 AND talent_id=$2', [req.params.id, req.params.talentId]);
    await pool.query(`UPDATE talent SET status='bench', current_client=NULL WHERE id=$1`, [req.params.talentId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CLIENT 360 ───────────────────────────────────────────────────────────────
router.get('/client360/:client', async (req, res) => {
  try {
    const client = decodeURIComponent(req.params.client);
    const [leads, reqs, projects, contracts, engagements] = await Promise.all([
      pool.query(`SELECT id, company_name, status, estimated_value, created_at FROM leads WHERE LOWER(company_name)=LOWER($1) ORDER BY created_at DESC`, [client]),
      pool.query(`SELECT id, req_id, title, stage, priority, bill_rate, pay_rate, assigned_talent_id,
                         CASE WHEN bill_rate>0 THEN ROUND(((bill_rate-pay_rate)/bill_rate)*100,1) ELSE NULL END AS margin_pct
                  FROM requirements WHERE LOWER(client)=LOWER($1) ORDER BY id DESC`, [client]),
      pool.query(`SELECT id, name, stage, phase, start_date, end_date, utilization_pct FROM projects WHERE LOWER(client)=LOWER($1) ORDER BY start_date DESC`, [client]),
      pool.query(`SELECT id, sow_id, status, value, start_date, end_date FROM contracts WHERE LOWER(client)=LOWER($1) ORDER BY start_date DESC`, [client]),
      pool.query(`SELECT id, talent_name, role, start_date, end_date, status FROM engagements WHERE LOWER(client)=LOWER($1) ORDER BY start_date DESC`, [client]),
    ]);
    const totalRevenue = contracts.rows.filter(c => c.status === 'active').reduce((s, c) => s + parseFloat(c.value || 0), 0);
    res.json({
      client,
      leads: leads.rows,
      requirements: reqs.rows,
      projects: projects.rows,
      contracts: contracts.rows,
      engagements: engagements.rows,
      summary: {
        total_leads: leads.rows.length,
        open_reqs: reqs.rows.filter(r => r.stage !== 'closure').length,
        active_projects: projects.rows.filter(p => p.stage !== 'completed').length,
        active_revenue: totalRevenue,
        active_engagements: engagements.rows.filter(e => e.status === 'active').length,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// All unique clients for Client 360 picker
router.get('/clients', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT client FROM (
        SELECT LOWER(client) AS client FROM requirements
        UNION SELECT LOWER(client) FROM projects
        UNION SELECT LOWER(client) FROM contracts
        UNION SELECT LOWER(client) FROM engagements
      ) t WHERE client IS NOT NULL AND client != '' ORDER BY client`);
    res.json(result.rows.map(r => r.client));
  } catch (err) { res.status(500).json({ error: err.message }); }
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

// Normalize snapshot (pg JSONB) so bd/bench are always arrays
function snapshotFromDbPayload(pr) {
  if (!pr || typeof pr !== 'object') {
    return { bd: [], bench: [], bench_interview: [], market_interview: [] };
  }
  return {
    ...pr,
    bd: Array.isArray(pr.bd) ? pr.bd : [],
    bench: Array.isArray(pr.bench) ? pr.bench : [],
    bench_interview: Array.isArray(pr.bench_interview) ? pr.bench_interview : [],
    market_interview: Array.isArray(pr.market_interview) ? pr.market_interview : [],
  };
}

// ─── BD OPERATIONS DASHBOARD (Excel-parity KPIs from BD_DAR snapshot) ───────
router.get('/bd-operations', async (req, res) => {
  try {
    let payload;
    let meta = { source_filename: null, updated_at: null, data_source: null };
    const snap = await pool.query('SELECT payload, source_filename, updated_at FROM bd_ops_snapshot WHERE id = 1');
    const row = snap.rows[0];
    const pr = row?.payload;
    // `[]` is truthy in JS — must check length, or we never re-read the Excel when DB was saved empty
    const dbHasBdRows = pr && Array.isArray(pr.bd) && pr.bd.length > 0;

    if (dbHasBdRows) {
      payload = snapshotFromDbPayload(pr);
      meta = {
        source_filename: row.source_filename,
        updated_at: row.updated_at,
        data_source: 'database',
      };
      if (payload._dar_meta?.resolved_sheets) {
        meta.resolved_sheets = payload._dar_meta.resolved_sheets;
        meta.dar_source_path = payload._dar_meta.source_path;
      }
    } else {
      const p = defaultBdDarPath();
      if (fs.existsSync(p)) {
        payload = loadBdDarSnapshot(p);
        meta = {
          source_filename: path.basename(p),
          updated_at: null,
          live_file: true,
          data_source: 'file',
          resolved_sheets: payload._dar_meta?.resolved_sheets,
          dar_source_path: payload._dar_meta?.source_path,
        };
        if (!dbHasBdRows && pr) {
          meta.notice = 'Database snapshot had no BD rows — showing data from Excel on disk. Use "Save snapshot" to refresh the database.';
        }
      } else if (pr) {
        payload = snapshotFromDbPayload(pr);
        meta = {
          source_filename: row.source_filename,
          updated_at: row.updated_at,
          data_source: 'database_empty',
          notice: 'Snapshot in DB has no BD rows and no Excel file was found. Add backend/reference/BD_DAR.xlsx or run Save snapshot as Administrator.',
        };
      } else {
        return res.json({
          ok: false,
          error:
            'No data yet. Add backend/reference/BD_DAR.xlsx (or backend/BD_DAR.xlsx), then as Administrator: BD Operations → Save snapshot from file — or run: npm run bd:sync',
        });
      }
    }
    const m = computeAll(payload, new Date());
    const inv = await getInvoiceRevenueCrore(pool, new Date());
    const derived = {
      onboarded_mtd: m.executive.onboarded_this_month,
      revenue_mtd_cr: inv.revenue_mtd_cr,
      revenue_ytd_cr: inv.revenue_ytd_cr,
      invoice_count_mtd: inv.invoice_count_mtd,
      invoice_count_ytd: inv.invoice_count_ytd,
    };

    let vpRow = null;
    try {
      const vpQ = await pool.query('SELECT * FROM bd_ops_vp_targets WHERE id = 1');
      if (vpQ.rows[0]) {
        vpRow = vpQ.rows[0];
      } else {
        await pool.query('INSERT INTO bd_ops_vp_targets (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
        vpRow = (await pool.query('SELECT * FROM bd_ops_vp_targets WHERE id = 1')).rows[0] || null;
      }
    } catch (e) {
      console.error('bd_ops_vp_targets:', e.message);
    }

    let vpPayload;
    try {
      vpPayload = buildVpView(vpRow, derived);
    } catch (e) {
      console.error('buildVpView:', e.message);
      vpPayload = buildVpView(null, derived);
    }

    const board = buildBoardSummary({
      vp: vpPayload,
      executive: m.executive,
      bd_performance: m.views?.bd_performance,
    });

    res.json({
      ok: true,
      meta,
      executive: m.executive,
      funnel: m.funnel,
      row_counts: m.row_counts,
      views: m.views,
      vp: vpPayload,
      board,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * Update VP **targets** only (reality: engineers from BD DAR, revenue from invoices).
 * Body: { monthly_engineer_target?, revenue_fy_target_cr?, period_label? } — use null/empty to clear
 */
router.put('/bd-operations/vp-targets', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    let { rows } = await pool.query('SELECT * FROM bd_ops_vp_targets WHERE id = 1');
    if (!rows[0]) {
      await pool.query('INSERT INTO bd_ops_vp_targets (id) VALUES (1) ON CONFLICT (id) DO NOTHING');
      rows = (await pool.query('SELECT * FROM bd_ops_vp_targets WHERE id = 1')).rows;
    }
    const r0 = rows[0];
    if (!r0) return res.status(500).json({ error: 'Could not read bd_ops_vp_targets' });

    let me = r0.monthly_engineer_target;
    if (b.monthly_engineer_target !== undefined) {
      if (b.monthly_engineer_target === null || b.monthly_engineer_target === '') me = null;
      else {
        const n = parseInt(b.monthly_engineer_target, 10);
        me = Number.isFinite(n) ? n : null;
      }
    }
    let fy = r0.revenue_fy_target_cr;
    if (b.revenue_fy_target_cr !== undefined) {
      if (b.revenue_fy_target_cr === null || b.revenue_fy_target_cr === '') fy = null;
      else {
        const n = parseFloat(b.revenue_fy_target_cr, 10);
        fy = Number.isFinite(n) ? n : null;
      }
    }
    const pl = b.period_label !== undefined
      ? (b.period_label == null || b.period_label === '' ? null : String(b.period_label).trim())
      : r0.period_label;

    await pool.query(
      'UPDATE bd_ops_vp_targets SET monthly_engineer_target = $1, revenue_fy_target_cr = $2, period_label = $3, updated_at = NOW() WHERE id = 1',
      [me, fy, pl]
    );
    const row = (await pool.query('SELECT * FROM bd_ops_vp_targets WHERE id = 1')).rows[0];
    const inv = await getInvoiceRevenueCrore(pool, new Date());
    let payload = { bd: [] };
    const snap = await pool.query('SELECT payload FROM bd_ops_snapshot WHERE id = 1');
    if (snap.rows[0]?.payload?.bd) payload = snap.rows[0].payload;
    const m = computeAll(payload, new Date());
    const derived = {
      onboarded_mtd: m.executive.onboarded_this_month,
      ...inv,
    };
    res.json({ ok: true, vp: buildVpView(row, derived) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Save raw BD_DAR to snapshot (Administrator). Optional body: { filePath: "..." } */
router.post('/bd-operations/reload', requireAdmin, async (req, res) => {
  try {
    const p = (req.body && req.body.filePath) ? path.resolve(req.body.filePath) : defaultBdDarPath();
    if (!fs.existsSync(p)) return res.status(400).json({ error: 'File not found: ' + p });
    const payload = loadBdDarSnapshot(p);
    await pool.query(
      `INSERT INTO bd_ops_snapshot (id, payload, source_filename, updated_at)
       VALUES (1, $1::jsonb, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = $1::jsonb, source_filename = $2, updated_at = NOW()`,
      [JSON.stringify(payload), path.basename(p)]
    );
    res.json({
      ok: true,
      message: 'Snapshot saved',
      row_counts: { bd: payload.bd.length, bench: payload.bench.length, bench_interview: payload.bench_interview.length, market_interview: payload.market_interview.length },
      resolved_sheets: payload._dar_meta?.resolved_sheets,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Reload snapshot from disk + generate TechnoElevate import + run onboard --reset (keeps Administrator users).
 * Optional body: { filePath, skipOnboard: boolean }
 */
router.post('/bd-operations/full-import', requireAdmin, async (req, res) => {
  try {
    const p = (req.body && req.body.filePath) ? path.resolve(req.body.filePath) : defaultBdDarPath();
    if (!fs.existsSync(p)) return res.status(400).json({ error: 'File not found: ' + p });

    const payload = loadBdDarSnapshot(p);
    await pool.query(
      `INSERT INTO bd_ops_snapshot (id, payload, source_filename, updated_at)
       VALUES (1, $1::jsonb, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET payload = $1::jsonb, source_filename = $2, updated_at = NOW()`,
      [JSON.stringify(payload), path.basename(p)]
    );

    const skipOnboard = req.body && req.body.skipOnboard;
    const baseCounts = {
      row_counts: {
        bd: payload.bd.length,
        bench: payload.bench.length,
        bench_interview: payload.bench_interview.length,
        market_interview: payload.market_interview.length,
      },
      resolved_sheets: payload._dar_meta?.resolved_sheets,
    };
    if (skipOnboard) {
      return res.json({ ok: true, message: 'Snapshot saved. Onboard skipped.', ...baseCounts });
    }

    const backRoot = path.join(__dirname, '..');
    const r = spawnSync(
      process.execPath,
      [path.join(backRoot, 'import-bd-dar.js'), '--in=' + p, '--out=' + path.join(backRoot, 'TechnoElevate_From_BD_DAR.xlsx')],
      { cwd: backRoot, stdio: 'inherit', env: process.env }
    );
    if (r.status !== 0) return res.status(500).json({ error: 'import-bd-dar.js failed' });

    const o = spawnSync(
      process.execPath,
      [path.join(backRoot, 'onboard-excel.js'), '--reset', '--file=' + path.join(backRoot, 'TechnoElevate_From_BD_DAR.xlsx')],
      { cwd: backRoot, stdio: 'inherit', env: process.env }
    );
    if (o.status !== 0) return res.status(500).json({ error: 'onboard-excel.js failed' });

    res.json({
      ok: true,
      message: 'Full import complete. Logins: non-admin data cleared; Administrator users preserved.',
      ...baseCounts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
