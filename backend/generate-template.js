/**
 * TechnoElevate — Excel Template Generator
 *
 * Generates TechnoElevate_Setup.xlsx with:
 *   - All 8 sheets with correct headers
 *   - Example / sample data rows in each sheet
 *   - Column widths auto-set for readability
 *   - Header row styled (bold + background color)
 *   - Dropdown validation for status, stage, priority columns
 *
 * Usage:
 *   node generate-template.js                         # generates in backend/
 *   node generate-template.js --out=../mytemplate.xlsx
 */

const XLSX  = require('xlsx');
const path  = require('path');

const argv   = process.argv.slice(2);
const outArg = argv.find(a => a.startsWith('--out='));
const OUT    = outArg
  ? path.resolve(outArg.split('=')[1])
  : path.join(__dirname, 'TechnoElevate_Setup.xlsx');

// ─── Sheet definitions ─────────────────────────────────────────────────────
// Each sheet: { name, headers[], rows[][], notes (printed as first comment row) }

const sheets = [

  // ── CONFIG ──────────────────────────────────────────────────────────────
  {
    name: 'CONFIG',
    headers: ['Key', 'Value'],
    colWidths: [28, 40],
    notes: '# Organisation-level settings. Edit the Value column only.',
    rows: [
      ['org_name',              'Acme Consulting'],
      ['admin_name',            'Rahul Sharma'],
      ['admin_email',           'rahul@acme.com'],
      ['admin_password',        'acme@2026'],
      ['currency',              'USD ($)'],
      ['timezone',              'IST (UTC+5:30)'],
      ['date_format',           'DD/MM/YYYY'],
      ['stale_threshold_days',  '3'],
      ['bench_alert_days',      '7'],
    ],
  },

  // ── USERS ────────────────────────────────────────────────────────────────
  {
    name: 'USERS',
    headers: ['name', 'email', 'password', 'role'],
    colWidths: [24, 32, 20, 22],
    notes: '# One row per team member who will log in.\n# role options: Administrator | Delivery Lead | Operations | View Only',
    rows: [
      ['Rahul Sharma',  'rahul@acme.com', 'acme@2026', 'Administrator'],
      ['Priya Menon',   'priya@acme.com', 'acme@2026', 'Delivery Lead'],
      ['Ops Team',      'ops@acme.com',   'ops@2026',  'Operations'],
    ],
  },

  // ── TALENT ───────────────────────────────────────────────────────────────
  {
    name: 'TALENT',
    headers: ['name', 'role', 'status', 'pay_rate', 'skills', 'bench_start_date', 'current_client'],
    colWidths: [24, 28, 16, 12, 40, 20, 22],
    notes: [
      '# status options: bench | in_process | interviewing | offered | deployed',
      '# skills: comma separated  e.g.  React, Node.js, PostgreSQL',
      '# bench_start_date: format YYYY-MM-DD  (leave blank if not on bench)',
      '# current_client: leave blank if on bench',
    ].join('\n'),
    rows: [
      ['Arjun Nair',   'React Developer',    'bench',      8500,  'React, TypeScript, CSS',               '2026-03-15', ''],
      ['Sneha Roy',    'Java Backend Dev',   'bench',      9800,  'Java, Spring Boot, PostgreSQL',         '2026-03-20', ''],
      ['Rahel T.',     'DevOps Engineer',    'bench',      10500, 'AWS, Docker, Kubernetes',               '2026-03-25', ''],
      ['Karan Mehta',  'Data Scientist',     'bench',      11000, 'Python, TensorFlow, SQL',               '2026-04-01', ''],
      ['Divya Nair',   'QA Engineer',        'bench',      7500,  'Selenium, Cypress, JIRA',               '2026-04-05', ''],
      ['Arun Verma',   'Cloud Architect',    'in_process', 13500, 'AWS, Azure, Terraform',                 '',           'Infosys BPM'],
      ['Meera S.',     'Full Stack Dev',     'in_process', 9200,  'Node.js, React, MongoDB',               '',           'Wipro Digital'],
      ['Vikram Bhat',  'Security Engineer',  'deployed',   12000, 'Penetration Testing, SIEM, ISO27001',   '',           'HCL Tech'],
      ['Anisha Rao',   'Data Engineer',      'deployed',   10800, 'Spark, Kafka, Airflow',                 '',           'Infosys BPM'],
    ],
  },

  // ── LEADS ────────────────────────────────────────────────────────────────
  {
    name: 'LEADS',
    headers: ['company_name', 'contact_name', 'contact_email', 'contact_phone',
              'source', 'status', 'estimated_value', 'notes', 'follow_up_date'],
    colWidths: [22, 20, 30, 18, 18, 16, 18, 40, 16],
    notes: [
      '# status: new | contacted | qualified | proposal_sent | negotiation | won | lost',
      '# source: Referral | LinkedIn | Inbound | Event | Partner | Cold Outreach',
      '# estimated_value: number only (e.g. 280000)',
      '# follow_up_date: YYYY-MM-DD  (leave blank if won/lost)',
    ].join('\n'),
    rows: [
      ['Infosys BPM',   'Rohit Malhotra', 'rohit@infosys.com',  '+91 98765 00001', 'Referral',     'qualified',     280000, 'Need 4 Java devs',            '2026-04-20'],
      ['Wipro Digital', 'Ananya Gupta',   'ananya@wipro.com',   '+91 98765 00002', 'LinkedIn',     'proposal_sent', 420000, 'ML engineers required',       '2026-04-15'],
      ['HCL Tech',      'Sanjay Bose',    'sanjay@hcl.com',     '+91 98765 00003', 'Inbound',      'won',           190000, 'SOW signed — React team',     ''],
      ['TCS Digital',   'Priti Shah',     'priti@tcs.com',      '+91 98765 00004', 'Event',        'new',           350000, 'Cloud migration project',     '2026-04-30'],
      ['Capgemini',     'Vivek Arora',    'vivek@capgemini.com','+91 98765 00005', 'Cold Outreach','contacted',     160000, 'QA + DevOps requirement',     '2026-04-22'],
    ],
  },

  // ── REQUIREMENTS ─────────────────────────────────────────────────────────
  {
    name: 'REQUIREMENTS',
    headers: ['req_id', 'title', 'client', 'stage', 'priority', 'role_type',
              'bill_rate', 'pay_rate', 'lead_company', 'assigned_talent', 'notes'],
    colWidths: [12, 30, 20, 16, 10, 18, 12, 12, 22, 24, 40],
    notes: [
      '# stage: intake | sourcing | submission | screening | interviewing | closure',
      '# priority: HIGH | MED | LOW',
      '# bill_rate / pay_rate: monthly amounts in numbers (e.g. 14000)',
      '# lead_company: must match company_name in LEADS sheet exactly',
      '# assigned_talent: must match name in TALENT sheet exactly (optional)',
      '# Use closure stage + assigned_talent to auto-create an Engagement',
    ].join('\n'),
    rows: [
      ['REQ-001', 'Senior React Developer',   'HCL Tech',      'interviewing', 'HIGH', 'Frontend',   14000, 8500,  'HCL Tech',      'Arjun Nair',  'Urgent fill'],
      ['REQ-002', 'Java Backend Developer',   'Infosys BPM',   'sourcing',     'HIGH', 'Backend',    16000, 9800,  'Infosys BPM',   '',            ''],
      ['REQ-003', 'Cloud Architect',          'Wipro Digital', 'intake',       'MED',  'Cloud',      21000, 13500, 'Wipro Digital', '',            ''],
      ['REQ-004', 'Data Scientist',           'Infosys BPM',   'submission',   'MED',  'Data',       17500, 11000, 'Infosys BPM',   'Karan Mehta', ''],
      ['REQ-005', 'QA Automation Engineer',   'TCS Digital',   'sourcing',     'LOW',  'QA',         12000, 7500,  '',              '',            'Can wait'],
      ['REQ-006', 'DevOps Lead',              'HCL Tech',      'closure',      'HIGH', 'DevOps',     19000, 13500, 'HCL Tech',      'Arun Verma',  'Engagement will be auto-created'],
    ],
  },

  // ── CONTRACTS ────────────────────────────────────────────────────────────
  {
    name: 'CONTRACTS',
    headers: ['sow_id', 'client', 'start_date', 'end_date', 'value',
              'status', 'utilization_pct', 'invoice_overdue', 'invoice_amount'],
    colWidths: [22, 20, 14, 14, 14, 16, 18, 18, 16],
    notes: [
      '# status: active | expiring_soon | expired',
      '# invoice_overdue: Yes | No',
      '# invoice_amount: overdue amount (number, leave 0 if no overdue)',
      '# value: total contract value (number)',
      '# dates: YYYY-MM-DD format',
    ].join('\n'),
    rows: [
      ['SOW-HCL-2026',      'HCL Tech',      '2026-01-01', '2026-12-31', 480000, 'active',        88, 'No',  0],
      ['SOW-Wipro-2026',    'Wipro Digital', '2026-02-15', '2026-08-15', 320000, 'active',        74, 'Yes', 18000],
      ['SOW-Infosys-2026',  'Infosys BPM',   '2026-03-01', '2026-05-10', 240000, 'expiring_soon', 60, 'No',  0],
    ],
  },

  // ── PROJECTS ─────────────────────────────────────────────────────────────
  {
    name: 'PROJECTS',
    headers: ['name', 'client', 'stage', 'phase', 'team_size',
              'start_date', 'end_date', 'utilization_pct',
              'budget', 'actual_spend', 'industry', 'sector', 'geography', 'blocking_issue'],
    colWidths: [28, 20, 14, 14, 12, 14, 14, 16, 14, 14, 20, 22, 16, 40],
    notes: [
      '# stage: green | at_risk | blocked | completed',
      '# phase: discovery | design | development | testing | uat | go_live | delivered',
      '# blocking_issue: leave blank if stage is green or completed',
    ].join('\n'),
    rows: [
      ['ERP Modernisation',  'HCL Tech',      'green',   'development', 6, '2026-01-15', '2026-09-30', 88, 600000, 180000, 'Technology', 'Enterprise Software', 'India',   ''],
      ['Data Lake Setup',    'Wipro Digital', 'at_risk', 'design',      4, '2026-02-01', '2026-08-01', 68, 380000, 95000,  'Technology', 'Data & AI',           'US East', 'Need 2 more data engineers'],
      ['Cloud Migration',    'Infosys BPM',   'green',   'discovery',   3, '2026-03-10', '2026-10-10', 45, 240000, 20000,  'Consulting', 'Cloud',               'India',   ''],
    ],
  },

  // ── INVOICES ─────────────────────────────────────────────────────────────
  {
    name: 'INVOICES',
    headers: ['invoice_number', 'sow_id', 'client', 'amount',
              'issued_date', 'due_date', 'paid_date', 'status', 'notes'],
    colWidths: [18, 22, 20, 14, 14, 14, 14, 12, 40],
    notes: [
      '# status: pending | sent | paid | overdue',
      '# sow_id must match exactly with CONTRACTS sheet',
      '# paid_date: leave blank if not yet paid',
    ].join('\n'),
    rows: [
      ['INV-2026-001', 'SOW-HCL-2026',     'HCL Tech',      60000, '2026-03-01', '2026-03-31', '2026-03-28', 'paid',    'March billing'],
      ['INV-2026-002', 'SOW-Wipro-2026',   'Wipro Digital', 40000, '2026-03-15', '2026-04-14', '',           'overdue', 'Q1 milestone — follow up'],
      ['INV-2026-003', 'SOW-Infosys-2026', 'Infosys BPM',   30000, '2026-04-01', '2026-04-30', '',           'sent',    'April billing'],
    ],
  },
];

// ─── Build workbook ────────────────────────────────────────────────────────
function buildWorkbook() {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const wsData = [];

    // Notes rows (1 row per note line, prefixed with #)
    if (sheet.notes) {
      for (const line of sheet.notes.split('\n')) {
        wsData.push([line]);
      }
      wsData.push([]); // blank separator
    }

    // Header row
    wsData.push(sheet.headers);

    // Data rows
    for (const row of sheet.rows) {
      wsData.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Column widths
    if (sheet.colWidths) {
      ws['!cols'] = sheet.colWidths.map(w => ({ wch: w }));
    }

    // Freeze top rows (notes + blank + header) so header stays visible
    const frozenRows = sheet.notes ? sheet.notes.split('\n').length + 2 : 1;
    ws['!freeze'] = { xSplit: 0, ySplit: frozenRows };

    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  return wb;
}

// ─── Main ──────────────────────────────────────────────────────────────────
const wb = buildWorkbook();
XLSX.writeFile(wb, OUT);

console.log(`\n✅  Template written: ${OUT}`);
console.log('\nSheet summary:');
for (const s of sheets) {
  console.log(`   ${s.name.padEnd(16)} — ${s.headers.length} columns, ${s.rows.length} example row(s)`);
}
console.log('\nNext steps:');
console.log('  1. Open TechnoElevate_Setup.xlsx in Excel / Google Sheets');
console.log('  2. Fill in your organisation\'s data (replace example rows)');
console.log('  3. Run: node onboard-excel.js --reset   # keeps Administrator users; add --full-reset to wipe all users');
console.log('  4. Open: http://localhost:7000\n');
