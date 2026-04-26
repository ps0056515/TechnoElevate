/**
 * TechnoElevate — Excel-Based Org Setup Script
 *
 * Reads TechnoElevate_Setup.xlsx and populates the database organically:
 *   CONFIG → USERS → TALENT → LEADS → CONTRACTS → REQUIREMENTS
 *   → PROJECTS → INVOICES → bench history → health metrics → alerts
 *
 * Usage:
 *   node onboard-excel.js                         # import from default file
 *   node onboard-excel.js --file=../mydata.xlsx   # custom file path
 *   node onboard-excel.js --reset                 # wipe org data, keep Administrator users, then import
 *   node onboard-excel.js --reset --full-reset    # wipe everything including all users, then import
 *   node onboard-excel.js --dry-run               # validate without writing
 *
 * Generate blank template:
 *   node generate-template.js
 */

require('dotenv').config();
const XLSX   = require('xlsx');
const bcrypt = require('bcryptjs');
const path   = require('path');
const fs     = require('fs');
const pool   = require('./db');

// ─── CLI args ──────────────────────────────────────────────────────────────
const argv       = process.argv.slice(2);
const RESET      = argv.includes('--reset');
const FULL_RESET = argv.includes('--full-reset');
const DO_RESET   = RESET || FULL_RESET;
const DRY        = argv.includes('--dry-run');
const fileArg = argv.find(a => a.startsWith('--file='));
let EXCEL_PATH = fileArg
  ? path.resolve(fileArg.slice('--file='.length).replace(/^["']|["']$/g, ''))
  : path.join(__dirname, 'TechnoElevate_Setup.xlsx');

/** If path missing, try .xlsx / .xls (handles paths without extension). */
function resolveExcelPath(p) {
  if (fs.existsSync(p)) return p;
  const ext = path.extname(p).toLowerCase();
  if (ext === '.xlsx' || ext === '.xls') return p;
  for (const e of ['.xlsx', '.xls', '.XLSX', '.XLS']) {
    const alt = p + e;
    if (fs.existsSync(alt)) return alt;
  }
  const dir = path.dirname(p);
  const base = path.basename(p);
  for (const e of ['.xlsx', '.xls']) {
    const alt = path.join(dir, base + e);
    if (fs.existsSync(alt)) return alt;
  }
  return p;
}
EXCEL_PATH = resolveExcelPath(EXCEL_PATH);

/** Logical name → alternate tab titles (e.g. client-specific workbooks). */
const SHEET_ALIASES = {
  CONFIG:       ['CONFIG', 'Admn Config', 'Admin Config'],
  USERS:        ['USERS', 'Users'],
  TALENT:       ['TALENT', 'Talent'],
  LEADS:        ['LEADS', 'LeadsPipeline', 'Leads Pipeline'],
  CONTRACTS:    ['CONTRACTS', 'Active Contracts'],
  REQUIREMENTS: ['REQUIREMENTS', 'Open Reqs', 'Open reqs'],
  PROJECTS:     ['PROJECTS', 'MS Projects'],
  INVOICES:     ['INVOICES', 'invoices', 'Invoices'],
};

/** Resolve template sheet name to actual workbook tab (exact or case-insensitive). */
function resolveSheetName(wb, logicalName) {
  const tryNames = [logicalName, ...(SHEET_ALIASES[logicalName] || [])];
  for (const name of tryNames) {
    if (wb.Sheets[name]) return name;
  }
  const byLower = new Map(wb.SheetNames.map(n => [n.toLowerCase(), n]));
  for (const name of tryNames) {
    const hit = byLower.get(String(name).toLowerCase());
    if (hit) return hit;
  }
  return null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Convert a sheet to plain objects.
 * Skips leading comment rows (cells starting with "#") and blank rows,
 * then treats the first non-comment row as the header row.
 */
function toObjects(wb, logicalSheetName) {
  const sheetName = resolveSheetName(wb, logicalSheetName);
  if (!sheetName) {
    console.warn(`  ⚠  Sheet "${logicalSheetName}" not found — skipped`);
    return [];
  }
  const sheet = wb.Sheets[sheetName];

  // Get raw rows as arrays (no header interpretation)
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find the first row that is NOT a comment (not starting with "#") and not blank
  let headerIdx = -1;
  for (let i = 0; i < rawRows.length; i++) {
    const firstCell = String(rawRows[i][0] || '').trim();
    if (firstCell && !firstCell.startsWith('#')) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) return [];

  const headers  = rawRows[headerIdx].map(h => String(h).trim());
  const dataRows = rawRows.slice(headerIdx + 1);

  return dataRows
    .filter(row => row.some(cell => cell !== '' && cell !== null && cell !== undefined))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { if (h) obj[h] = row[i] ?? ''; });
      return obj;
    });
}

/**
 * Excel stores dates as JS Date objects (with cellDates:true) or
 * as serial numbers or as formatted strings.  Normalise all to YYYY-MM-DD.
 */
/** Placeholders in client spreadsheets that are not real dates */
const NON_DATE_STRINGS = new Set(['NA', 'N/A', 'N.A.', '-', '—', 'TBD', 'NONE', 'NULL', '#N/A']);

function parseDate(val) {
  if (!val && val !== 0) return null;
  if (val instanceof Date) return isNaN(val) ? null : val.toISOString().slice(0, 10);
  if (typeof val === 'number' && val > 0) {
    // Excel serial → JS timestamp
    const ms = Math.round((val - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return null;
    if (NON_DATE_STRINGS.has(s.toUpperCase().replace(/\s+/g, ''))) return null;
    if (NON_DATE_STRINGS.has(s.replace(/\./g, '').toUpperCase())) return null;
    const iso = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
    if (iso && !isNaN(Date.parse(iso))) return iso;
    const t = Date.parse(s);
    if (!isNaN(t)) return new Date(t).toISOString().slice(0, 10);
    return null;
  }
  return null;
}

/** Parse a comma-separated skills string into a Postgres text[] */
function parseSkills(val) {
  if (!val) return [];
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

/** "Yes"/"yes"/"YES"/"true"/1 → true */
function parseBool(val) {
  if (typeof val === 'boolean') return val;
  return ['yes', 'true', '1'].includes(String(val).toLowerCase().trim());
}

/** Safe float — treats blank as 0 */
function pf(val) { return parseFloat(val) || 0; }
/** Safe int — treats blank as 0 */
function pi(val) { return parseInt(val) || 0; }
/** Trim to string or null */
function ps(val) { const s = String(val || '').trim(); return s || null; }

const COLORS = [
  'linear-gradient(135deg,#4f7cff,#a55eea)',
  'linear-gradient(135deg,#ff4757,#a55eea)',
  'linear-gradient(135deg,#2ed573,#4f7cff)',
  'linear-gradient(135deg,#ffa502,#ff6b81)',
  'linear-gradient(135deg,#1e90ff,#00b894)',
  'linear-gradient(135deg,#fd79a8,#6c5ce7)',
];

const ENGAGEMENT_STAGES = [
  'Onboarding Docs',
  'Background Check',
  'Client Intro',
  'Access Provisioning',
  'First Week Check-in',
  'Month-1 Review',
  'Ongoing Compliance',
];

// ─── Validation ────────────────────────────────────────────────────────────
function validateRow(entityName, row, required) {
  const missing = required.filter(f => !row[f] && row[f] !== 0);
  if (missing.length) {
    console.warn(`  ⚠  ${entityName}: skipping row — missing required field(s): ${missing.join(', ')}`);
    return false;
  }
  return true;
}

function validateEnum(entityName, field, val, allowed) {
  if (!allowed.includes(val)) {
    console.warn(`  ⚠  ${entityName}: "${field}" value "${val}" not in [${allowed.join('/')}] — defaulting to "${allowed[0]}"`);
    return allowed[0];
  }
  return val;
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  TechnoElevate — Excel Org Setup                 ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`❌  File not found: ${EXCEL_PATH}`);
    console.error('    Run "node generate-template.js" to create the blank template.\n');
    process.exit(1);
  }

  if (DRY) console.log('🔍  DRY RUN — no data will be written\n');

  console.log(`📂  Reading: ${path.basename(EXCEL_PATH)}\n`);
  const wb = XLSX.readFile(EXCEL_PATH, { cellDates: true });

  // ── STEP 0: Schema ────────────────────────────────────────────────────────
  if (!DRY) {
    process.stdout.write('📐  Applying schema... ');
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('done');

    if (DO_RESET) {
      if (FULL_RESET) {
        process.stdout.write('⚠️   Full reset (all users and org data)... ');
        await pool.query(`
          TRUNCATE invoices, project_milestones, project_talent,
                   requirement_candidates, project_documents, case_studies,
                   user_settings, users, attention_issues, bench_idle_weekly,
                   requirements, projects, contracts,
                   engagement_checklist_items, engagements,
                   talent, health_metrics, leads
          RESTART IDENTITY CASCADE
        `);
      } else {
        process.stdout.write('⚠️   Resetting org data (keeping Administrator users)... ');
        await pool.query(`
          TRUNCATE invoices, project_milestones, project_talent,
                   requirement_candidates, project_documents, case_studies,
                   attention_issues, bench_idle_weekly,
                   requirements, projects, contracts,
                   engagement_checklist_items, engagements,
                   talent, health_metrics, leads
          RESTART IDENTITY CASCADE
        `);
        await pool.query(`
          DELETE FROM users WHERE role IS DISTINCT FROM 'Administrator'
        `);
      }
      console.log('done');
    }
  }

  // ── STEP 1: CONFIG ────────────────────────────────────────────────────────
  console.log('\n── Reading CONFIG ──────────────────────────────────');
  const configRows = toObjects(wb, 'CONFIG');
  const cfg = {};
  for (const row of configRows) {
    // Support both "Key"/"Value" headers and positional fallback
    const key = String(row['Key'] || row[Object.keys(row)[0]] || '').trim();
    const val = String(row['Value'] || row[Object.keys(row)[1]] || '').trim();
    if (key && !key.startsWith('#')) cfg[key] = val;
  }

  const orgName = cfg.org_name || 'My Organisation';
  console.log(`   Org name       : ${orgName}`);
  console.log(`   Currency       : ${cfg.currency || 'USD ($)'}`);
  console.log(`   Timezone       : ${cfg.timezone || 'IST (UTC+5:30)'}`);

  // ── STEP 2: USERS ─────────────────────────────────────────────────────────
  console.log('\n── Inserting USERS ─────────────────────────────────');
  const userRows = toObjects(wb, 'USERS');
  const userMap  = {}; // email → id (for future use)
  let userCount  = 0;

  for (const row of userRows) {
    if (!validateRow('USERS', row, ['email'])) continue;

    const name     = ps(row.name)  || row.email.split('@')[0];
    const email    = String(row.email).trim().toLowerCase();
    const password = ps(row.password) || 'changeme123';
    const role     = validateEnum('USERS', 'role', ps(row.role) || 'View Only',
                       ['Administrator', 'Delivery Lead', 'Operations', 'View Only']);
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const color    = COLORS[userCount % COLORS.length];

    if (DRY) {
      console.log(`   [DRY] Would insert user: ${name} <${email}> [${role}]`);
    } else {
      const hash = await bcrypt.hash(password, 10);
      const { rows: [u] } = await pool.query(`
        INSERT INTO users (name, email, password_hash, role, initials, color)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (email) DO UPDATE
          SET name=EXCLUDED.name, role=EXCLUDED.role, initials=EXCLUDED.initials
        RETURNING id
      `, [name, email, hash, role, initials, color]);

      await pool.query(`
        INSERT INTO user_settings
          (user_id, company_name, timezone, date_format, currency,
           stale_threshold_days, bench_alert_days)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (user_id) DO UPDATE
          SET company_name=$2, timezone=$3, date_format=$4, currency=$5
      `, [
        u.id, orgName,
        cfg.timezone    || 'IST (UTC+5:30)',
        cfg.date_format || 'DD/MM/YYYY',
        cfg.currency    || 'USD ($)',
        pi(cfg.stale_threshold_days) || 3,
        pi(cfg.bench_alert_days)     || 7,
      ]);

      userMap[email] = u.id;
      console.log(`   ✓ ${name} <${email}> [${role}]`);
    }
    userCount++;
  }
  console.log(`   Total: ${userCount} user(s)`);

  // ── STEP 3: TALENT ────────────────────────────────────────────────────────
  console.log('\n── Inserting TALENT ────────────────────────────────');
  const talentRows = toObjects(wb, 'TALENT');
  const talentMap  = {}; // name (lowercased) → { id, pay_rate, role, status }
  let talentCount  = 0;

  const VALID_TALENT_STATUS = ['bench', 'in_process', 'interviewing', 'offered', 'deployed'];

  for (const row of talentRows) {
    if (!validateRow('TALENT', row, ['name', 'role'])) continue;

    const name    = String(row.name).trim();
    const status  = validateEnum('TALENT', 'status', ps(row.status) || 'bench', VALID_TALENT_STATUS);
    const payRate = pf(row.pay_rate);
    const skills  = parseSkills(row.skills);

    if (DRY) {
      console.log(`   [DRY] Would insert talent: ${name} | ${row.role} | ${status} | $${payRate}`);
    } else {
      const { rows: [t] } = await pool.query(`
        INSERT INTO talent
          (name, role, status, pay_rate, skills, bench_start_date, idle_hours, current_client)
        VALUES ($1,$2,$3,$4,$5,$6,0,$7)
        ON CONFLICT DO NOTHING RETURNING id
      `, [
        name, row.role, status, payRate, skills,
        parseDate(row.bench_start_date),
        ps(row.current_client),
      ]);

      if (t) {
        talentMap[name.toLowerCase()] = { id: t.id, pay_rate: payRate, role: row.role, status };
        console.log(`   ✓ ${name} | ${row.role} | ${status}`);
        talentCount++;
      } else {
        console.warn(`   ⚠  ${name} — already exists, skipped`);
      }
    }
  }
  console.log(`   Total: ${talentCount} talent seeded`);

  // ── STEP 4: LEADS ─────────────────────────────────────────────────────────
  console.log('\n── Inserting LEADS ─────────────────────────────────');
  const leadRows = toObjects(wb, 'LEADS');
  const leadMap  = {}; // company_name (lowercased) → id
  let leadCount  = 0;

  const VALID_LEAD_STATUS = ['new','contacted','qualified','proposal_sent','negotiation','won','lost'];

  for (const row of leadRows) {
    if (!validateRow('LEADS', row, ['company_name'])) continue;

    const company = String(row.company_name).trim();
    const status  = validateEnum('LEADS', 'status', ps(row.status) || 'new', VALID_LEAD_STATUS);

    if (DRY) {
      console.log(`   [DRY] Would insert lead: ${company} [${status}]`);
    } else {
      const { rows: [l] } = await pool.query(`
        INSERT INTO leads
          (company_name, contact_name, contact_email, contact_phone,
           source, status, estimated_value, notes, follow_up_date)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT DO NOTHING RETURNING id
      `, [
        company,
        ps(row.contact_name), ps(row.contact_email), ps(row.contact_phone),
        ps(row.source) || 'Inbound',
        status,
        pf(row.estimated_value),
        ps(row.notes),
        parseDate(row.follow_up_date),
      ]);

      if (l) {
        leadMap[company.toLowerCase()] = l.id;
        console.log(`   ✓ ${company} [${status}]  $${pf(row.estimated_value).toLocaleString('en-US')}`);
        leadCount++;
      } else {
        console.warn(`   ⚠  ${company} — already exists, skipped`);
      }
    }
  }
  console.log(`   Total: ${leadCount} lead(s)`);

  // ── STEP 5: CONTRACTS ─────────────────────────────────────────────────────
  console.log('\n── Inserting CONTRACTS ─────────────────────────────');
  const contractRows2 = toObjects(wb, 'CONTRACTS');
  const contractMap   = {}; // sow_id (lowercased) → { id, client }
  let contractCount   = 0;

  const VALID_CONTRACT_STATUS = ['active','expiring_soon','expired'];

  for (const row of contractRows2) {
    if (!validateRow('CONTRACTS', row, ['sow_id', 'client'])) continue;

    const sowId  = String(row.sow_id).trim();
    const status = validateEnum('CONTRACTS', 'status', ps(row.status) || 'active', VALID_CONTRACT_STATUS);

    if (DRY) {
      console.log(`   [DRY] Would insert contract: ${sowId} | ${row.client} | ${status}`);
    } else {
      const { rows: [c] } = await pool.query(`
        INSERT INTO contracts
          (sow_id, client, start_date, end_date, value, status,
           utilization_pct, invoice_overdue, invoice_amount)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT DO NOTHING RETURNING id
      `, [
        sowId,
        String(row.client).trim(),
        parseDate(row.start_date),
        parseDate(row.end_date),
        pf(row.value),
        status,
        pi(row.utilization_pct),
        parseBool(row.invoice_overdue),
        pf(row.invoice_amount),
      ]);

      if (c) {
        contractMap[sowId.toLowerCase()] = { id: c.id, client: String(row.client).trim() };
        console.log(`   ✓ ${sowId} | ${row.client} | $${pf(row.value).toLocaleString('en-US')}`);
        contractCount++;
      } else {
        console.warn(`   ⚠  ${sowId} — already exists, skipped`);
      }
    }
  }
  console.log(`   Total: ${contractCount} contract(s)`);

  // ── STEP 6: REQUIREMENTS ──────────────────────────────────────────────────
  console.log('\n── Inserting REQUIREMENTS ──────────────────────────');
  const reqRows  = toObjects(wb, 'REQUIREMENTS');
  const reqMap   = {}; // req_id → { id, client, stage, assigned_talent_name }
  let   reqCount = 0;

  const VALID_STAGES    = ['intake','sourcing','submission','screening','interviewing','closure'];
  const VALID_PRIORITY  = ['HIGH','MED','LOW'];

  for (const row of reqRows) {
    if (!validateRow('REQUIREMENTS', row, ['req_id', 'title', 'client'])) continue;

    const reqId    = String(row.req_id).trim();
    const stage    = validateEnum('REQUIREMENTS', 'stage',    ps(row.stage)    || 'intake',  VALID_STAGES);
    const priority = validateEnum('REQUIREMENTS', 'priority', ps(row.priority) || 'MED',     VALID_PRIORITY);

    // Auto-link lead by company name
    const leadId = row.lead_company
      ? (leadMap[String(row.lead_company).trim().toLowerCase()] || null)
      : null;

    // Auto-link contract by client name (first match)
    const contractEntry = Object.values(contractMap)
      .find(c => c.client.toLowerCase() === String(row.client).trim().toLowerCase());
    const contractId = contractEntry?.id || null;

    // Auto-link assigned talent by name
    const talentEntry = row.assigned_talent
      ? talentMap[String(row.assigned_talent).trim().toLowerCase()]
      : null;
    const assignedTalentId = talentEntry?.id || null;

    if (DRY) {
      console.log(`   [DRY] Would insert req: ${reqId} | ${row.title} | ${stage} | ${row.client}`);
    } else {
      const { rows: [r] } = await pool.query(`
        INSERT INTO requirements
          (req_id, title, client, stage, days_in_stage, stalled, priority,
           role_type, bill_rate, pay_rate, lead_id, contract_id, assigned_talent_id)
        VALUES ($1,$2,$3,$4,0,false,$5,$6,$7,$8,$9,$10,$11)
        ON CONFLICT (req_id) DO NOTHING RETURNING id
      `, [
        reqId, String(row.title).trim(), String(row.client).trim(),
        stage, priority,
        ps(row.role_type),
        pf(row.bill_rate),
        pf(row.pay_rate),
        leadId, contractId, assignedTalentId,
      ]);

      if (r) {
        reqMap[reqId] = {
          id:                    r.id,
          client:                String(row.client).trim(),
          stage,
          assigned_talent_name:  ps(row.assigned_talent),
          assigned_talent_id:    assignedTalentId,
          bill_rate:             pf(row.bill_rate),
          pay_rate:              pf(row.pay_rate),
        };

        // Mark talent as in_process if assigned but not closed yet
        if (assignedTalentId && stage !== 'closure') {
          await pool.query(
            `UPDATE talent SET status='in_process', current_client=$1 WHERE id=$2`,
            [String(row.client).trim(), assignedTalentId]
          );
        }

        const margin = row.bill_rate && row.pay_rate
          ? `${((pf(row.bill_rate) - pf(row.pay_rate)) / pf(row.bill_rate) * 100).toFixed(1)}% margin`
          : 'no rates';
        console.log(`   ✓ ${reqId} | ${row.title} | ${stage} | ${margin}`);
        reqCount++;
      } else {
        console.warn(`   ⚠  ${reqId} — already exists, skipped`);
      }
    }
  }
  console.log(`   Total: ${reqCount} requirement(s)`);

  // ── STEP 6b: Auto-create engagements for closure stage reqs ───────────────
  if (!DRY) {
    console.log('\n── Auto-creating ENGAGEMENTS for closure requirements ──');
    let engCount = 0;

    for (const [reqId, req] of Object.entries(reqMap)) {
      if (req.stage !== 'closure' || !req.assigned_talent_id) continue;

      // Create engagement
      const { rows: [eng] } = await pool.query(`
        INSERT INTO engagements
          (talent_id, talent_name, client, role, start_date, req_id, status)
        VALUES ($1,$2,$3,$4,CURRENT_DATE,$5,'active')
        RETURNING id
      `, [
        req.assigned_talent_id,
        req.assigned_talent_name,
        req.client,
        reqRows.find(r => r.req_id === reqId)?.role_type || 'Consultant',
        req.id,
      ]);

      // Create 7-stage checklist
      for (let i = 0; i < ENGAGEMENT_STAGES.length; i++) {
        const due = new Date();
        due.setDate(due.getDate() + (i + 1) * 7);
        await pool.query(`
          INSERT INTO engagement_checklist_items
            (engagement_id, stage_number, stage_name, item_name, completed, due_date)
          VALUES ($1,$2,$3,$4,false,$5)
        `, [
          eng.id, i + 1,
          ENGAGEMENT_STAGES[i],
          `${ENGAGEMENT_STAGES[i]} — ${req.assigned_talent_name}`,
          due.toISOString().slice(0, 10),
        ]);
      }

      // Mark talent as deployed
      await pool.query(
        `UPDATE talent SET status='deployed', current_client=$1 WHERE id=$2`,
        [req.client, req.assigned_talent_id]
      );

      console.log(`   ✓ Engagement created for ${req.assigned_talent_name} @ ${req.client}`);
      engCount++;
    }
    console.log(`   Total: ${engCount} engagement(s) auto-created`);
  }

  // ── STEP 7: PROJECTS ──────────────────────────────────────────────────────
  console.log('\n── Inserting PROJECTS ──────────────────────────────');
  const projectRows2 = toObjects(wb, 'PROJECTS');
  let projectCount   = 0;

  const VALID_PROJECT_STAGE = ['green','at_risk','blocked','completed'];
  const VALID_PHASE = ['discovery','design','development','testing','uat','go_live','delivered'];

  for (const row of projectRows2) {
    if (!validateRow('PROJECTS', row, ['name', 'client'])) continue;

    const stage = validateEnum('PROJECTS', 'stage', ps(row.stage) || 'green', VALID_PROJECT_STAGE);
    const phase = validateEnum('PROJECTS', 'phase', ps(row.phase) || 'discovery', VALID_PHASE);

    if (DRY) {
      console.log(`   [DRY] Would insert project: ${row.name} | ${row.client} | ${stage} / ${phase}`);
    } else {
      const { rows: [p] } = await pool.query(`
        INSERT INTO projects
          (name, client, stage, phase, team_size, start_date, end_date,
           utilization_pct, budget, actual_spend,
           industry, sector, geography, blocking_issue)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        ON CONFLICT DO NOTHING RETURNING id
      `, [
        String(row.name).trim(),
        String(row.client).trim(),
        stage, phase,
        pi(row.team_size),
        parseDate(row.start_date),
        parseDate(row.end_date),
        pi(row.utilization_pct),
        pf(row.budget),
        pf(row.actual_spend),
        ps(row.industry),
        ps(row.sector),
        ps(row.geography),
        ps(row.blocking_issue),
      ]);

      if (p) {
        console.log(`   ✓ ${row.name} | ${row.client} | ${stage} → ${phase}`);
        projectCount++;
      } else {
        console.warn(`   ⚠  ${row.name} — already exists, skipped`);
      }
    }
  }
  console.log(`   Total: ${projectCount} project(s)`);

  // ── STEP 8: INVOICES ──────────────────────────────────────────────────────
  console.log('\n── Inserting INVOICES ──────────────────────────────');
  const invoiceRows = toObjects(wb, 'INVOICES');
  let invoiceCount  = 0;
  let overdueCount  = 0;

  const VALID_INVOICE_STATUS = ['pending','sent','paid','overdue'];

  for (const row of invoiceRows) {
    if (!validateRow('INVOICES', row, ['invoice_number', 'client'])) continue;

    const invNum     = String(row.invoice_number).trim();
    const status     = validateEnum('INVOICES', 'status', ps(row.status) || 'pending', VALID_INVOICE_STATUS);
    const contractId = row.sow_id
      ? (contractMap[String(row.sow_id).trim().toLowerCase()]?.id || null)
      : null;

    if (DRY) {
      console.log(`   [DRY] Would insert invoice: ${invNum} | ${row.client} | ${status} | $${pf(row.amount)}`);
    } else {
      const { rows: [inv] } = await pool.query(`
        INSERT INTO invoices
          (invoice_number, contract_id, client, amount,
           issued_date, due_date, paid_date, status, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (invoice_number) DO NOTHING RETURNING id
      `, [
        invNum, contractId,
        String(row.client).trim(),
        pf(row.amount),
        parseDate(row.issued_date),
        parseDate(row.due_date),
        parseDate(row.paid_date),
        status,
        ps(row.notes),
      ]);

      if (inv) {
        // Sync overdue flag on contract
        if (status === 'overdue' && contractId) {
          await pool.query(
            `UPDATE contracts SET invoice_overdue=true, invoice_amount=$1 WHERE id=$2`,
            [pf(row.amount), contractId]
          );
          overdueCount++;
        }
        console.log(`   ✓ ${invNum} | ${row.client} | ${status} | $${pf(row.amount).toLocaleString('en-US')}`);
        invoiceCount++;
      } else {
        console.warn(`   ⚠  ${invNum} — already exists, skipped`);
      }
    }
  }
  console.log(`   Total: ${invoiceCount} invoice(s) (${overdueCount} overdue)`);

  // ── STEP 9: Bench idle history ─────────────────────────────────────────────
  if (!DRY) {
    console.log('\n── Generating bench history ────────────────────────');
    const benchTalent = talentRows.filter(r => ps(r.status) === 'bench');
    const baseHours   = benchTalent.length * 8; // ~8 idle hours per bench person per week
    for (let w = 4; w >= 1; w--) {
      const d = new Date();
      d.setDate(d.getDate() - w * 7);
      const weekLabel  = `Week ${5 - w}`;
      const totalHours = Math.round(baseHours * (1 + (5 - w) * 0.3)); // grows week over week
      await pool.query(`
        INSERT INTO bench_idle_weekly (week_label, week_start, total_hours)
        VALUES ($1,$2,$3) ON CONFLICT DO NOTHING
      `, [weekLabel, d.toISOString().slice(0, 10), totalHours]);
    }
    console.log(`   4 weeks of bench history written`);
  }

  // ── STEP 10: Health metrics ────────────────────────────────────────────────
  if (!DRY) {
    console.log('\n── Computing health metrics ────────────────────────');

    const benchTalent  = talentRows.filter(r => ps(r.status) === 'bench');
    const benchCost    = benchTalent.reduce((s, r) => s + pf(r.pay_rate), 0);

    const deployedRows = talentRows.filter(r => ps(r.status) === 'deployed');
    const deployedRevenue = reqRows
      .filter(r => ps(r.stage) === 'closure')
      .reduce((s, r) => s + pf(r.bill_rate), 0);

    const wonLeads    = leadRows.filter(r => ps(r.status) === 'won').length;
    const totalLeads  = leadRows.filter(r => ['won','lost'].includes(ps(r.status))).length;
    const winRate     = totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 100) : 0;

    const activeContracts = contractRows2.filter(r => ps(r.status) === 'active').length;
    const avgUtil = contractRows2.length > 0
      ? Math.round(contractRows2.reduce((s, r) => s + pi(r.utilization_pct), 0) / contractRows2.length)
      : 0;

    await pool.query(`
      INSERT INTO health_metrics (metric_key, metric_label, metric_value, metric_unit, trend) VALUES
        ('active_reqs',        'Active Requirements',  $1, 'count', 'up'),
        ('active_contracts',   'Active Contracts',     $2, 'count', 'flat'),
        ('bench_cost',         'Bench Cost (Monthly)', $3, 'USD',   'up'),
        ('win_rate',           'Win Rate',             $4, '%',     'flat'),
        ('avg_utilization',    'Avg Utilization',      $5, '%',     'flat'),
        ('deployed_talent',    'Deployed Talent',      $6, 'count', 'flat'),
        ('revenue_run_rate',   'Monthly Revenue',      $7, 'USD',   'up')
      ON CONFLICT (metric_key) DO UPDATE
        SET metric_value=EXCLUDED.metric_value, updated_at=NOW()
    `, [
      reqCount, activeContracts, benchCost, winRate, avgUtil,
      deployedRows.length, deployedRevenue,
    ]);
    console.log(`   Win rate: ${winRate}%  |  Bench cost: $${benchCost.toLocaleString('en-US')}/mo`);
  }

  // ── STEP 11: Auto-generate attention alerts ────────────────────────────────
  if (!DRY) {
    console.log('\n── Auto-generating attention alerts ────────────────');
    let alertCount = 0;

    // Overdue invoices
    for (const row of invoiceRows.filter(r => ps(r.status) === 'overdue')) {
      await pool.query(`
        INSERT INTO attention_issues
          (priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled)
        VALUES ('HIGH',$1,'invoice',$2,$3,'Send Reminder',0)
        ON CONFLICT DO NOTHING
      `, [
        String(row.invoice_number).trim(),
        String(row.invoice_number).trim(),
        `Invoice ${row.invoice_number} overdue — $${pf(row.amount).toLocaleString('en-US')}`,
      ]);
      alertCount++;
    }

    // Stalled requirements (sourcing with no assigned talent)
    for (const [reqId, req] of Object.entries(reqMap)) {
      if (req.stage === 'sourcing' && !req.assigned_talent_id) {
        await pool.query(`
          INSERT INTO attention_issues
            (priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled)
          VALUES ('MED',$1,'requirement',$2,'No submissions — needs sourcing','Source Now',0)
          ON CONFLICT DO NOTHING
        `, [reqId, reqId]);
        alertCount++;
      }
    }

    // Bench talent idle > 14 days
    for (const row of talentRows.filter(r => ps(r.status) === 'bench')) {
      const benchDate   = parseDate(row.bench_start_date);
      const idleDays    = benchDate
        ? Math.floor((Date.now() - new Date(benchDate)) / 86400000)
        : 0;
      if (idleDays >= 14) {
        await pool.query(`
          INSERT INTO attention_issues
            (priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled)
          VALUES ('MED',$1,'talent',$2,$3,'Assign to Req',$4)
          ON CONFLICT DO NOTHING
        `, [
          String(row.name).trim(),
          String(row.name).trim(),
          `${row.name} on bench ${idleDays} days — no active requirement`,
          idleDays,
        ]);
        alertCount++;
      }
    }

    // Expiring contracts (end_date within 30 days)
    for (const row of contractRows2.filter(r => ps(r.status) !== 'expired')) {
      const end  = parseDate(row.end_date);
      if (!end) continue;
      const days = Math.floor((new Date(end) - Date.now()) / 86400000);
      if (days >= 0 && days <= 30) {
        await pool.query(`
          INSERT INTO attention_issues
            (priority, entity_name, entity_type, entity_id, issue_description, action_label, days_stalled)
          VALUES ('HIGH',$1,'contract',$2,$3,'Renew SOW',0)
          ON CONFLICT DO NOTHING
        `, [
          String(row.sow_id).trim(),
          String(row.sow_id).trim(),
          `${row.sow_id} expiring in ${days} day(s) — renew before ${end}`,
        ]);
        alertCount++;
      }
    }

    console.log(`   ${alertCount} alert(s) created`);
  }

  // ── FINAL SUMMARY ──────────────────────────────────────────────────────────
  // Use Excel row counts in dry-run; actual inserted counts in live run
  const sumUsers     = DRY ? userCount                                              : userCount;
  const sumTalent    = DRY ? talentRows.filter(r => r.name).length                 : Object.keys(talentMap).length;
  const sumBench     = talentRows.filter(r => ps(r.status) === 'bench').length;
  const sumDeployed  = talentRows.filter(r => ps(r.status) === 'deployed').length;
  const sumLeads     = DRY ? leadRows.filter(r => r.company_name).length           : Object.keys(leadMap).length;
  const sumReqs      = DRY ? reqRows.filter(r => r.req_id).length                 : reqCount;
  const sumContracts = DRY ? contractRows2.filter(r => r.sow_id).length           : contractCount;
  const sumProjects  = DRY ? projectRows2.filter(r => r.name).length              : projectCount;
  const sumInvoices  = DRY ? invoiceRows.filter(r => r.invoice_number).length     : invoiceCount;

  console.log(`
╔══════════════════════════════════════════════════╗
║  ${(DRY ? 'DRY RUN COMPLETE (no DB writes)' : 'SETUP COMPLETE').padEnd(48)}║
╠══════════════════════════════════════════════════╣
║  Organisation : ${orgName.padEnd(32)}║
║  Users        : ${String(sumUsers).padEnd(32)}║
║  Talent       : ${String(sumTalent).padEnd(32)}║
║    ↳ bench    : ${String(sumBench).padEnd(32)}║
║    ↳ deployed : ${String(sumDeployed).padEnd(32)}║
║  Leads        : ${String(sumLeads).padEnd(32)}║
║  Requirements : ${String(sumReqs).padEnd(32)}║
║  Contracts    : ${String(sumContracts).padEnd(32)}║
║  Projects     : ${String(sumProjects).padEnd(32)}║
║  Invoices     : ${String(sumInvoices).padEnd(32)}║
╠══════════════════════════════════════════════════╣
║  ${DRY ? 'Run without --dry-run to write to DB' : 'Open: http://localhost:7000'}${''.padEnd(DRY ? 10 : 11)}║
╚══════════════════════════════════════════════════╝
`);

  await pool.end();
}

main().catch(err => {
  console.error('\n❌  Setup failed:', err.message);
  console.error('    Check your Excel sheet names and column headers.\n');
  process.exit(1);
});
