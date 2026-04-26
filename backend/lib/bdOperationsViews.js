/**
 * Extra “worksheet” views for BD Operations — derived from the same sources as
 * BD_Operations_Dashboard-style files: BD Data, Bench Data, Bench Intv, Market Intv.
 * (Exact Excel layout can differ; column names are matched flexibly.)
 */

function monthWindow(d = new Date()) {
  const y = d.getFullYear();
  const m = d.getMonth();
  return {
    start: new Date(y, m, 1, 0, 0, 0, 0),
    end: new Date(y, m + 1, 0, 23, 59, 59, 999),
  };
}

function st(r) {
  return String(r.Status ?? r.status ?? '').trim();
}

function inMonthRange(v, start, end) {
  if (v == null || v === '') return false;
  const dt = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(dt.getTime())) return false;
  return dt >= start && dt <= end;
}

function accountOf(r) {
  const a =
    r.Account ?? r['Account '] ?? r['account'] ?? r.Client ?? r['Client Name'] ?? r.client;
  return String(a || '')
    .replace(/\s*\(L-?\d+[^)]*\)/gi, '')
    .replace(/\s*\(Client [^)]+\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Unknown';
}

function primarySkillBd(r) {
  const s = r.Skill ?? r['Skill '] ?? r.skill;
  if (s != null && String(s).trim()) return String(s).trim().slice(0, 80);
  const ss = r['Sub Skill'] ?? r['Sub skill'];
  if (ss != null && String(ss).trim()) return String(ss).trim().slice(0, 80);
  return 'Unspecified';
}

function benchFirstSkill(r) {
  const raw = r['Skill Set'] ?? r['Skill set'] ?? r.skills;
  if (raw == null) return 'Unspecified';
  const t = String(raw).split(/[,;/|]+/)[0].trim();
  return t ? t.slice(0, 80) : 'Unspecified';
}

const CLOSED_STATUSES = new Set(['Onboarded', 'Lost / Deferred', 'Profile Rejected', 'Offer Rejected', 'No Show']);

const BD_OWNER_COLS = ['BD', 'BDE', 'SPOC', 'Recruiter', 'Recruiter Name', 'Owner', 'bd', 'BDE '];

function ownerOf(r) {
  for (const c of BD_OWNER_COLS) {
    const v = r[c];
    if (v != null && String(v).trim()) return String(v).trim();
    const key = Object.keys(r).find((k) => k.toLowerCase() === c.toLowerCase().trim());
    if (key && r[key] != null && String(r[key]).trim()) return String(r[key]).trim();
  }
  return 'Unassigned';
}

/**
 * @param {object} snap — { bd, bench, bench_interview, market_interview }
 * @param {Date} now
 */
function computeExtendedViews(snap, now = new Date()) {
  const bd = snap.bd || [];
  const bench = snap.bench || [];
  const benchIntv = snap.bench_interview || [];
  const marketIntv = snap.market_interview || [];
  const { start, end } = monthWindow(now);

  // ── Positions (open requirements from BD) ─────────────────
  const openRows = bd.filter((r) => !CLOSED_STATUSES.has(st(r)));
  const positions = openRows.map((r, i) => ({
    account: accountOf(r),
    skill: primarySkillBd(r),
    sub_skill: String(r['Sub Skill'] || r['Sub skill'] || '').trim(),
    status: st(r) || '—',
    candidate: String(r.Candidate || r.candidate || '').trim(),
    en_date: r['En. Date'] ?? r['En. Date '] ?? '',
    budget_lpm: r['Budget LPM'] != null && r['Budget LPM'] !== '' ? r['Budget LPM'] : '',
    location: String(r.Location || r.location || '').trim(),
  }));

  // ── Account scorecard (BD rows) ─────────────────────────
  const byAcc = new Map();
  for (const r of bd) {
    const acc = accountOf(r);
    if (!byAcc.has(acc)) {
      byAcc.set(acc, { account: acc, total: 0, open: 0, onboarded: 0, active_pipeline: 0 });
    }
    const o = byAcc.get(acc);
    o.total += 1;
    const s = st(r);
    if (!CLOSED_STATUSES.has(s)) o.open += 1;
    if (s === 'Onboarded') o.onboarded += 1;
    const activePipelineStatuses = new Set([
      'Profile Shared', 'Screening Scheduled', 'Interview', 'Shortlisted', 'On Hold',
      'Awaiting Feedback', 'Final Select',
    ]);
    if (activePipelineStatuses.has(s)) o.active_pipeline += 1;
  }
  const account_scorecard = [...byAcc.values()].sort((a, b) => b.total - a.total);

  // ── Skill gap: open BD demand vs bench supply (same primary skill name, fuzzy) ──
  const demand = new Map();
  for (const r of openRows) {
    const k = primarySkillBd(r);
    demand.set(k, (demand.get(k) || 0) + 1);
  }
  const supply = new Map();
  for (const r of bench) {
    const k = benchFirstSkill(r);
    if (String(r['Name'] || r.name || '').toLowerCase() === 'asset') continue;
    supply.set(k, (supply.get(k) || 0) + 1);
  }
  const skillKeys = new Set([...demand.keys(), ...supply.keys()]);
  const skill_gap = [...skillKeys]
    .map((skill) => {
      const d = demand.get(skill) || 0;
      const s = supply.get(skill) || 0;
      return { skill, open_requirements: d, bench_headcount: s, gap: d - s };
    })
    .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

  // ── BD Performance (time window + by owner + status mix) ──
  const biMtd = benchIntv.filter((r) => inMonthRange(r.Date ?? r['Date'], start, end));
  const mMtd = marketIntv.filter((r) => inMonthRange(r['Date'] ?? r['Date '], start, end));
  const subMtd = bd.filter((r) => inMonthRange(r['En. Date'] ?? r['En. Date '], start, end));

  const statusBreakdown = new Map();
  for (const r of bd) {
    const s = st(r) || 'Unknown';
    statusBreakdown.set(s, (statusBreakdown.get(s) || 0) + 1);
  }
  const status_breakdown = [...statusBreakdown.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const byOwner = new Map();
  for (const r of bd) {
    const o = ownerOf(r);
    if (!byOwner.has(o)) byOwner.set(o, { owner: o, total: 0, open: 0, onboarded: 0, mtd: 0 });
    const x = byOwner.get(o);
    x.total += 1;
    if (!CLOSED_STATUSES.has(st(r))) x.open += 1;
    if (st(r) === 'Onboarded') x.onboarded += 1;
    if (inMonthRange(r['En. Date'] ?? r['En. Date '], start, end)) x.mtd += 1;
  }
  const by_owner = [...byOwner.values()].sort((a, b) => b.total - a.total);

  const totSub = bd.filter((r) => {
    const a = r['En. Date'] ?? r['En. Date '];
    return a !== null && a !== undefined && String(a).trim() !== '';
  }).length;
  const onboarded = bd.filter((r) => st(r) === 'Onboarded').length;

  const bd_performance = {
    month_label: start.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
    submissions_mtd: subMtd.length,
    bench_interviews_mtd: biMtd.length,
    market_interviews_mtd: mMtd.length,
    total_interviews_mtd: biMtd.length + mMtd.length,
    open_positions: openRows.length,
    total_bd_rows: bd.length,
    submission_to_onboard_rate: totSub > 0 ? onboarded / totSub : 0,
    by_owner: allUnassigned(by_owner) ? [] : by_owner,
    status_breakdown,
  };

  return {
    positions,
    account_scorecard,
    skill_gap,
    bd_performance,
  };
}

function allUnassigned(rows) {
  if (!rows.length) return true;
  return rows.length === 1 && rows[0].owner === 'Unassigned';
}

module.exports = { computeExtendedViews, accountOf, primarySkillBd };
