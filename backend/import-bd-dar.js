/**
 * Build TechnoElevate_Setup–compatible XLSX from BD_DAR.xlsx
 *
 * Source sheets (RKN-style BD tracker):
 *   - BD: open requirements / account pipeline
 *   - Bench: bench resources
 *   - Bench Interview / Market Interview: not row-imported; unique clients feed LEADS
 *
 * Usage:
 *   node import-bd-dar.js
 *   node import-bd-dar.js --in=./BD_DAR.xlsx --out=./TechnoElevate_From_BD_DAR.xlsx
 *   node onboard-excel.js --reset --file=./TechnoElevate_From_BD_DAR.xlsx
 */

const XLSX = require('xlsx');
const path = require('path');
const fs   = require('fs');
const { resolveAllSheetNames } = require('./loadBdDarSnapshot');

const argv = process.argv.slice(2);
const inArg  = argv.find(a => a.startsWith('--in='));
const outArg = argv.find(a => a.startsWith('--out='));
const IN  = inArg
  ? path.resolve(inArg.replace(/^--in=/, ''))
  : path.join(__dirname, 'BD_DAR.xlsx');
const OUT = outArg
  ? path.resolve(outArg.replace(/^--out=/, ''))
  : path.join(__dirname, 'TechnoElevate_From_BD_DAR.xlsx');

if (!fs.existsSync(IN)) {
  console.error('Input not found:', IN);
  process.exit(1);
}

function toRows(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!raw.length) return [];
  const hdr = raw[0].map(h => String(h).trim());
  return raw
    .slice(1)
    .filter(r => r.some(c => c !== '' && c !== null && c !== undefined))
    .map(r => {
      const o = {};
      hdr.forEach((h, i) => { if (h) o[h] = r[i]; });
      return o;
    });
}

function asDateStr(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const ms = Math.round((v - 25569) * 86400 * 1000);
    return new Date(ms).toISOString().slice(0, 10);
  }
  const s = String(v || '').trim();
  if (!s || s === 'NA' || s === 'N/A') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return '';
}

function cleanAccount(s) {
  return String(s || '')
    .replace(/\s*\(L-?\d+[^)]*\)/gi, '') // (L-1) (L-3 F2F) etc.
    .replace(/\s*\(Screening\)/gi, '')
    .replace(/\s*\(Client [^)]+\)/gi, '')
    .replace(/\(L-1\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanName(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSkills(s) {
  if (!s) return '';
  return String(s)
    .split(/[,;/|]+/g)
    .map(t => t.trim())
    .filter(Boolean)
    .join(', ');
}

/** Map RKN BD status → pipeline stage */
function bdStatusToStage(status) {
  const raw = String(status || '').trim();
  const x = raw.toLowerCase();
  if (!x) return 'intake';
  if (/^requirement (received|shared)/.test(x) || x === 'requirement received' || x === 'requirement shared') return 'intake';
  if (x.includes('on hold')) return 'intake';
  if (/shortlisted|profile shared/.test(x) && !/rejected/.test(x)) return 'sourcing';
  if (/profile rejected|^profile rejected/.test(x) || /lost|deferred|offer rejected|no show/.test(x)) return 'closure';
  if (x === 'onboarded') return 'closure';
  if (/final select|awaiting feedback/.test(x)) return 'interviewing';
  if (/screening scheduled/.test(x)) return 'screening';
  if (/\binterview\b/.test(x) && !/market/.test(x)) return 'interviewing';
  if (/profile shared/.test(x)) return 'submission';
  if (/req/.test(x) && (x.includes('shared') || x.includes('receive'))) return 'intake';
  return 'sourcing';
}

function bdStatusToStalled(status) {
  const x = String(status || '').toLowerCase();
  return x.includes('on hold') ? 'Yes' : 'No';
}

function buildWorkbook() {
  const wb = XLSX.readFile(IN, { cellDates: true });
  const sn = resolveAllSheetNames(wb);
  if (!sn.bd) {
    const have = (wb.SheetNames || []).join(', ');
    throw new Error(`No BD / BD Data sheet. Found: [${have}] — same rules as loadBdDarSnapshot.`);
  }
  const bd = toRows(wb, sn.bd);
  const bench = sn.bench ? toRows(wb, sn.bench) : [];
  const marketIv = sn.market_interview ? toRows(wb, sn.market_interview) : [];
  const benchIv = sn.bench_interview ? toRows(wb, sn.bench_interview) : [];

  // ── TALENT (from Bench) — one row per unique name
  const talentByKey = new Map();
  for (const r of bench) {
    const name = cleanName(r['Name'] || r['name']);
    if (!name || name.toLowerCase() === 'na' || name === 'Asset') continue;
    const k = name.toLowerCase();
    if (talentByKey.has(k)) continue;
    const role = (parseSkills(r['Skill Set']) || 'Consultant').split(',')[0].slice(0, 100);
    const status = 'bench';
    const pay    = 0;
    const skills = parseSkills(r['Skill Set']) || 'General';
    const benchD = asDateStr(r['Batch'] || r['batch']);
    talentByKey.set(k, {
      name,
      role: role || 'Consultant',
      status,
      pay_rate: pay,
      skills,
      bench_start_date: benchD,
      current_client: '',
    });
  }

  // ── LEADS — unique accounts from BD, Market, Bench Interview
  const leadAccounts = new Set();
  for (const r of bd) {
    const a = cleanAccount(r['Account'] || r['account']);
    if (a) leadAccounts.add(a);
  }
  for (const r of marketIv) {
    const a = cleanAccount(r['Client'] || r['client']);
    if (a) leadAccounts.add(a);
  }
  for (const r of benchIv) {
    const a = cleanAccount(r['Client Name'] || r['Client']);
    if (a) leadAccounts.add(a);
  }

  const leadRows = [...leadAccounts].sort().map(company => ({
    company_name: company,
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    source: 'BD DAR',
    status: 'qualified',
    estimated_value: 0,
    notes: 'Imported from BD_DAR — update contacts in CRM',
    follow_up_date: '',
  }));

  // ── REQUIREMENTS (from BD)
  let n = 0;
  const reqRows = [];
  for (const r of bd) {
    n += 1;
    const acc   = cleanAccount(r['Account'] || r['Account ']);
    const skill = String(r['Skill'] || '').trim();
    const sub   = String(r['Sub Skill'] || '').trim();
    const title = [skill, sub].filter(Boolean).join(' — ') || `Requirement ${n}`;
    const status = r['Status'] || '';
    const stage  = bdStatusToStage(status);
    const stalled = bdStatusToStalled(status);
    const budget  = r['Budget LPM'] != null && r['Budget LPM'] !== '' ? Number(r['Budget LPM']) : 0;
    const br = Number.isFinite(budget) && budget > 0 ? budget : 0;
    const exp = String(r['Exp.'] || r['Exp'] || '').trim();
    const candidate = cleanName(r['Candidate'] || r['candidate'] || '');
    const st = String(status);
    const assignT =
      candidate && (stage === 'interviewing' || stage === 'screening' || stage === 'submission' || stage === 'sourcing' || (stage === 'closure' && /onboarded/i.test(st)))
        ? candidate
        : '';

    reqRows.push({
      req_id: `REQ-BD-${String(n).padStart(4, '0')}`,
      title: title.slice(0, 200),
      client: acc || 'Unknown',
      stage,
      priority: /onboarded|final select|urgent|lost|rejected|high/i.test(st) && !/deferred|hold/i.test(st) ? 'HIGH' : 'MED',
      role_type: (skill || 'Role').slice(0, 100),
      bill_rate: br,
      pay_rate: 0,
      lead_company: acc || '',
      assigned_talent: assignT,
      notes: [
        `BD status: ${status}`,
        exp ? `Exp: ${exp}` : '',
        r['Source'] ? `Source: ${r['Source']}` : '',
        r['Location'] ? `Location: ${r['Location']}` : '',
        r['Wrk Mode'] ? `Mode: ${r['Wrk Mode']}` : '',
        stalled === 'Yes' ? 'On hold' : '',
      ]
        .filter(Boolean)
        .join(' | ')
        .slice(0, 2000),
    });
  }

  // ── CONFIG
  const configRows = [
    ['Key', 'Value'],
    ['org_name', 'TechnoElevate (BD DAR import)'],
    ['currency', 'INR (₹)'],
    ['timezone', 'IST (UTC+5:30)'],
    ['date_format', 'DD/MM/YYYY'],
    ['stale_threshold_days', '3'],
    ['bench_alert_days', '7'],
  ];

  // ── Assemble XLSX (comment row + header + data) like generate-template
  function aoaToSheetWithNotes(commentLines, header, rows, colWidths) {
    const wsData = [];
    for (const line of commentLines) {
      wsData.push([line]);
    }
    wsData.push([]);
    wsData.push(header);
    for (const row of rows) {
      if (Array.isArray(row)) wsData.push(row);
      else wsData.push(header.map(h => (row[h] != null ? row[h] : '')));
    }
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    if (colWidths) ws['!cols'] = colWidths.map(w => ({ wch: w }));
    return ws;
  }

  const outWb = XLSX.utils.book_new();

  const configNotes = [
    '# From BD_DAR import. Run: node onboard-excel.js --reset --file=./TechnoElevate_From_BD_DAR.xlsx',
    '# Add USERS sheet rows in Excel if you need logins; interview tabs are not line-imported.',
  ];
  XLSX.utils.book_append_sheet(
    outWb,
    aoaToSheetWithNotes(
      configNotes,
      configRows[0],
      configRows.slice(1),
      [24, 44]
    ),
    'CONFIG'
  );

  const usersHeader = ['name', 'email', 'password', 'role'];
  XLSX.utils.book_append_sheet(
    outWb,
    aoaToSheetWithNotes(
      ['# No users in bulk import — add your team here or keep empty'],
      usersHeader,
      [],
      [24, 32, 20, 22]
    ),
    'USERS'
  );

  const tHeader = ['name', 'role', 'status', 'pay_rate', 'skills', 'bench_start_date', 'current_client'];
  const talentList = [...talentByKey.values()];
  XLSX.utils.book_append_sheet(
    outWb,
    aoaToSheetWithNotes(
      [
        '# Imported from "Bench" sheet. Skills from Skill Set.',
        '# Adjust pay_rate in Excel before re-import if needed.',
      ],
      tHeader,
      talentList.map(t => [t.name, t.role, t.status, t.pay_rate, t.skills, t.bench_start_date, t.current_client]),
      [24, 28, 14, 10, 44, 14, 20]
    ),
    'TALENT'
  );

  const lHeader = [
    'company_name', 'contact_name', 'contact_email', 'contact_phone',
    'source', 'status', 'estimated_value', 'notes', 'follow_up_date',
  ];
  XLSX.utils.book_append_sheet(
    outWb,
    aoaToSheetWithNotes(
      [
        '# One row per account from BD + interview sheets',
        '# status: use new | qualified | won etc. to match your process',
      ],
      lHeader,
      leadRows,
      [22, 18, 30, 16, 14, 14, 12, 36, 12]
    ),
    'LEADS'
  );

  const reqHeader = [
    'req_id', 'title', 'client', 'stage', 'priority', 'role_type',
    'bill_rate', 'pay_rate', 'lead_company', 'assigned_talent', 'notes',
  ];
  XLSX.utils.book_append_sheet(
    outWb,
    aoaToSheetWithNotes(
      [
        '# From "BD" sheet. req_id is REQ-BD-####',
        '# assigned_talent should match a name in TALENT (Bench) when set',
        '# Interview-only rows are not duplicated here; see raw BD_DAR for detail',
      ],
      reqHeader,
      reqRows.map(o => reqHeader.map(h => o[h] != null ? o[h] : '')),
      [14, 32, 18, 14, 8, 16, 10, 10, 18, 20, 48]
    ),
    'REQUIREMENTS'
  );

  // Empty but valid sheets (optional contracts/projects/invoices you add in Excel)
  for (const { name, h, note } of [
    { name: 'CONTRACTS', h: ['sow_id', 'client', 'start_date', 'end_date', 'value', 'status', 'utilization_pct', 'invoice_overdue', 'invoice_amount'], note: '# Add SOWs here if you track them' },
    { name: 'PROJECTS', h: ['name', 'client', 'stage', 'phase', 'team_size', 'start_date', 'end_date', 'utilization_pct', 'budget', 'actual_spend', 'industry', 'sector', 'geography', 'blocking_issue'], note: '# Add delivery projects if needed' },
    { name: 'INVOICES', h: ['invoice_number', 'sow_id', 'client', 'amount', 'issued_date', 'due_date', 'paid_date', 'status', 'notes'], note: '# Add AR rows if needed' },
  ]) {
    XLSX.utils.book_append_sheet(
      outWb,
      aoaToSheetWithNotes([note], h, [], h.map(() => 16)),
      name
    );
  }

  XLSX.writeFile(outWb, OUT);

  return {
    talent: talentList.length,
    leads:  leadRows.length,
    reqs:   reqRows.length,
    marketIv: marketIv.length,
    benchIv:  benchIv.length,
  };
}

const stats = buildWorkbook();
console.log(`\n✅  Wrote: ${OUT}`);
console.log('    TALENT rows:', stats.talent, '(from Bench, deduped by name)');
console.log('    LEADS   rows:', stats.leads, '(unique accounts)');
console.log('    REQ     rows:', stats.reqs, '(from BD)');
console.log('    (Reference: Market Interview rows:', stats.marketIv + ', Bench Interview rows:', stats.benchIv + ')');
console.log('\nNext:  node onboard-excel.js --reset --file="' + OUT.replace(/\\/g, '/') + '"\n');
