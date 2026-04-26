import React, { useEffect, useState } from 'react';
import { apiJson } from '../api.js';

const vpInputStyle = { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)' };

const funnelOrder = [
  'total_submissions',
  'survived_profile_screening',
  'reached_interview',
  'cleared_multiple_rounds',
  'received_offer',
  'accepted_offer',
  'onboarded_revenue',
];

const exLabels = {
  total_submissions: 'Total Submissions',
  submissions_this_month: 'Submissions (this month)',
  onboarded: 'Onboarded (#)',
  onboarded_this_month: 'Onboarded this month (BD DAR)',
  submission_to_onboard_pct: 'Submission → Onboard %',
  active_pipeline: 'Active Pipeline',
  bench_strength_rfd: 'Bench Strength (RFD)',
  total_interviews: 'Total Interviews',
  selection_rate_bench_interviews: 'Selection Rate (bench intv.)',
};

const BD_TABS = [
  { id: 'board', label: 'Board' },
  { id: 'vp', label: 'VP' },
  { id: 'targets', label: 'Targets' },
  { id: 'executive', label: 'Executive' },
  { id: 'positions', label: 'Positions' },
  { id: 'funnel', label: 'BD funnel' },
  { id: 'accounts', label: 'Account scorecard' },
  { id: 'skills', label: 'Skill gap' },
  { id: 'bd_perf', label: 'BD performance' },
];

function fmt(n, isPct) {
  if (n == null) return '—';
  if (isPct) return `${(n * 100).toFixed(2)}%`;
  if (typeof n === 'number' && n < 1 && n > 0) return `${(n * 100).toFixed(1)}%`;
  return n.toLocaleString();
}

/** When API omits `vp` (stale server / partial response), show a minimal VP from Executive KPIs — no business constants */
function fallbackVpView(executive) {
  const o = Number(executive?.onboarded_this_month);
  const a = Number.isFinite(o) ? o : 0;
  return {
    monthly_engineer_target: null,
    net_engineer_actual: a,
    engineer_gap_to_monthly_target: null,
    engineer_pct_of_monthly_target: null,
    revenue_fy_target_cr: null,
    revenue_mtd_cr: 0,
    revenue_ytd_cr: 0,
    revenue_mtd_pct_of_annual: null,
    revenue_prorated_monthly_cr: null,
    revenue_gap_mtd_vs_prorated_cr: null,
    period_label: null,
    updated_at: null,
    reality: {
      engineers_onboarded_mtd: a,
      engineer_data_source: 'bd_snapshot',
      revenue_data_source: 'invoices',
      invoice_count_mtd: 0,
      invoice_count_ytd: 0,
    },
  };
}

/** If GET /api/bd-operations is older, rebuild board from vp + executive + perf (same shapes as buildBoardSummary). */
function clientBoardSnapshot(vp, executive, perf) {
  if (!vp) return null;
  const toN = (n) => (n == null || n === '' ? null : (Number.isFinite(Number(n)) ? Number(n) : null));
  const fy = toN(vp.revenue_fy_target_cr);
  const mtd = toN(vp.revenue_mtd_cr) ?? 0;
  const ytd = toN(vp.revenue_ytd_cr) ?? 0;
  const y = new Date().getFullYear();
  const start = new Date(y, 0, 1, 0, 0, 0, 0);
  const end = new Date(y, 11, 31, 23, 59, 59, 999);
  const now = new Date();
  const elapsed = Math.min(1, Math.max(0, (now - start) / (end - start)));
  const linearYtdExpectedCr = fy != null && fy > 0 ? fy * elapsed : null;
  const ytdVsLinearCr = linearYtdExpectedCr != null ? ytd - linearYtdExpectedCr : null;
  const monthlyTarget = toN(vp.monthly_engineer_target);
  const raw = vp.reality?.engineers_onboarded_mtd != null ? vp.reality.engineers_onboarded_mtd : vp.net_engineer_actual;
  const a = Number.isFinite(Number(raw)) ? Number(raw) : 0;
  return {
    period_month_label: perf?.month_label || null,
    revenue: {
      fy_target_cr: fy,
      mtd_cr: mtd,
      ytd_cr: ytd,
      ytd_as_pct_of_fy: fy != null && fy > 0 ? ytd / fy : null,
      linear_ytd_expected_cr: linearYtdExpectedCr,
      ytd_vs_linear_cr: ytdVsLinearCr,
      invoice_count_mtd: vp.reality?.invoice_count_mtd ?? null,
      invoice_count_ytd: vp.reality?.invoice_count_ytd ?? null,
    },
    headcount: {
      monthly_target: monthlyTarget,
      onboarded_mtd: a,
      gap_to_target: vp.engineer_gap_to_monthly_target ?? (monthlyTarget != null ? monthlyTarget - a : null),
      pct_of_target: vp.engineer_pct_of_monthly_target ?? (monthlyTarget != null && monthlyTarget !== 0 ? a / monthlyTarget : null),
    },
    bench: {
      selection_rate_bench: executive?.selection_rate_bench_interviews ?? null,
      total_interviews_all_time: executive?.total_interviews ?? null,
      bench_interviews_mtd: perf?.bench_interviews_mtd ?? null,
      market_interviews_mtd: perf?.market_interviews_mtd ?? null,
      total_interviews_mtd: perf?.total_interviews_mtd ?? null,
      bench_strength_rfd: executive?.bench_strength_rfd ?? null,
    },
    definitions: {
      revenue:
        'FY target is optional (set on VP / Targets). MTD and YTD are from posted invoices in this database (INR → ₹ Cr). Linear “pace” line assumes even revenue over the calendar year (not India FY unless your target period matches).',
      headcount:
        '“Onboarded this month” counts BD DAR rows with status Onboarded and En. date in the current month. It is not true HR net add (exits/leavers are not included). Optional monthly target is your run-rate goal.',
      bench:
        'Selection rate uses bench-interview rows with Feedback containing “selected” or “rejected” (denominator = that subset). Interview counts (MTD) are rows dated in the current month on bench- and market-interview sheets.',
    },
  };
}

function tabBtnStyle(active) {
  return {
    background: active ? 'var(--accent-blue)' : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  };
}

export default function BdOperationsPage({ user }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [editingVp, setEditingVp] = useState(false);
  const [vpForm, setVpForm] = useState({ monthly_engineer_target: '', revenue_fy_target_cr: '', period_label: '' });
  // Board = director summary; Executive = full KPI grid
  const [bdTab, setBdTab] = useState('board');
  const isAdmin = user?.role === 'Administrator';

  const load = () => {
    setLoading(true);
    setErr(null);
    apiJson('/api/bd-operations')
      .then((d) => {
        setData(d);
        if (!d?.ok) setErr(d?.error || 'No data');
        else {
          setErr(null);
          if (d.vp) {
            setVpForm({
              monthly_engineer_target: d.vp.monthly_engineer_target != null && d.vp.monthly_engineer_target !== '' ? d.vp.monthly_engineer_target : '',
              revenue_fy_target_cr: d.vp.revenue_fy_target_cr != null && d.vp.revenue_fy_target_cr !== '' ? d.vp.revenue_fy_target_cr : '',
              period_label: d.vp.period_label != null && d.vp.period_label !== '' ? d.vp.period_label : '',
            });
          }
        }
        setLoading(false);
      })
      .catch((e) => { setErr(e.message || 'Request failed'); setData(null); setLoading(false); });
  };

  useEffect(load, []);

  const doReload = () => {
    setActionMsg('');
    apiJson('/api/bd-operations/reload', {
      method: 'POST', body: JSON.stringify({}),
    }).then((d) => {
      setActionMsg(d.message || d.error || JSON.stringify(d));
      load();
    }).catch((e) => setActionMsg(e.message));
  };

  const doFull = () => {
    if (!window.confirm('This will reset org data and re-import from BD_DAR.xlsx. Administrator logins are kept. Continue?')) return;
    setActionMsg('');
    apiJson('/api/bd-operations/full-import', {
      method: 'POST', body: JSON.stringify({}),
    }).then((d) => {
      setActionMsg(d.message || d.error || JSON.stringify(d));
      load();
    }).catch((e) => setActionMsg(e.message));
  };

  if (loading) {
    return <div className="card"><div className="loading"><div className="spinner" /> Loading BD operations…</div></div>;
  }
  if (err && !data?.ok) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <p style={{ color: 'var(--red)' }}>{err}</p>
        {isAdmin && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Open <strong>BD Operations</strong> from the left sidebar. Add <code>backend/reference/BD_DAR.xlsx</code> or <code>backend/BD_DAR.xlsx</code>, then as Administrator: “Save snapshot from file” — or run <code>npm run db:migrate</code> if the database tables are missing.
          </p>
        )}
      </div>
    );
  }
  if (!data?.ok) return null;

  const { meta, row_counts, vp: vpFromApi, views: viewsRaw } = data;
  const executive = data.executive ?? {};
  const funnel = data.funnel ?? {};
  const vp = vpFromApi || fallbackVpView(executive);
  const views = viewsRaw || {
    positions: [],
    account_scorecard: [],
    skill_gap: [],
    bd_performance: {
      month_label: '',
      submissions_mtd: 0,
      bench_interviews_mtd: 0,
      market_interviews_mtd: 0,
      total_interviews_mtd: 0,
      open_positions: 0,
      total_bd_rows: 0,
      submission_to_onboard_rate: 0,
      by_owner: [],
      status_breakdown: [],
    },
  };
  const perf = views.bd_performance || {};
  const board = data.board ?? clientBoardSnapshot(vp, executive, perf);

  const saveVp = () => {
    const body = {
      monthly_engineer_target: vpForm.monthly_engineer_target === '' ? null : vpForm.monthly_engineer_target,
      revenue_fy_target_cr: vpForm.revenue_fy_target_cr === '' ? null : vpForm.revenue_fy_target_cr,
      period_label: vpForm.period_label === '' ? null : vpForm.period_label,
    };
    apiJson('/api/bd-operations/vp-targets', {
      method: 'PUT',
      body: JSON.stringify(body),
    }).then((r) => {
      if (r.ok) {
        setData((prev) => {
          if (!prev) return prev;
          const ex = prev.executive ?? {};
          const perf = prev.views?.bd_performance || {};
          return { ...prev, vp: r.vp, board: clientBoardSnapshot(r.vp, ex, perf) };
        });
      }
      setActionMsg('VP targets updated.');
      setEditingVp(false);
    }).catch((e) => setActionMsg(e.message));
  };

  const dataSources = row_counts
    ? `BD Data: ${row_counts.bd} · Bench: ${row_counts.bench} · Bench interview: ${row_counts.bench_interview} · Market interview: ${row_counts.market_interview}`
    : '';

  return (
    <div>
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>BD Operations Dashboard</h2>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--text-muted)', maxWidth: 780 }}>
              Use the <strong>Board</strong> tab for a compact director view (revenue, headcount run-rate, bench & interviews). KPIs and lists are <strong>computed from your saved <code>BD_DAR.xlsx</code> snapshot</strong> and (for revenue) <strong>invoice amounts in the database</strong>. On the VP tab, only <em>optional targets</em> (monthly headcount, FY revenue) are typed in; engineer “reality” = onboarded-this-month in the DAR, revenue = sum of invoice lines (₹ → Cr) by issued date.
            </p>
            {meta && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                {meta.source_filename && <>File: <strong>{meta.source_filename}</strong></>}
                {meta.updated_at && <> · Snapshot: {new Date(meta.updated_at).toLocaleString()}</>}
                {meta.live_file && ' · Read live from disk (not yet saved in DB)'}
                {meta.dar_source_path && (
                  <><br />Path: <code style={{ fontSize: 10 }}>{meta.dar_source_path}</code></>
                )}
              </p>
            )}
            {meta?.resolved_sheets && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Excel tabs used:{' '}
                <strong>BD</strong> = {meta.resolved_sheets.bd || '—'}
                {meta.resolved_sheets.bench && <> · <strong>Bench</strong> = {meta.resolved_sheets.bench}</>}
                {meta.resolved_sheets.bench_interview && <> · <strong>Bench intv</strong> = {meta.resolved_sheets.bench_interview}</>}
                {meta.resolved_sheets.market_interview && <> · <strong>Market intv</strong> = {meta.resolved_sheets.market_interview}</>}
              </p>
            )}
            {dataSources && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{dataSources}</p>
            )}
            {meta?.data_source && (
              <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                Data source: <code>{meta.data_source}</code>
                {meta.live_file && ' (read from disk for this request)'}
              </p>
            )}
            {meta?.notice && (
              <p style={{ fontSize: 12, color: 'var(--amber)', marginTop: 8, maxWidth: 800 }}>
                {meta.notice}
              </p>
            )}
          </div>
          {isAdmin && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={doReload}>Save snapshot from BD_DAR.xlsx</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={doFull}>Full re-import to database</button>
            </div>
          )}
        </div>
        {actionMsg && <p style={{ marginTop: 10, fontSize: 12, color: 'var(--green)' }}>{actionMsg}</p>}
      </div>

      <div
        className="card"
        style={{
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
          padding: '10px 12px',
          marginBottom: 16,
          overflowX: 'auto',
        }}
      >
        {BD_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setBdTab(t.id)}
            style={tabBtnStyle(bdTab === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {bdTab === 'board' && board && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>Director / board — three pillars</h3>
          {board.period_month_label && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 12px' }}>Window: {board.period_month_label} (interview MTD counts)</p>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 14,
              alignItems: 'stretch',
            }}
          >
            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderTop: '4px solid var(--accent-cyan)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Revenue (invoices)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-cyan)', marginTop: 8, lineHeight: 1.15 }}>
                ₹{Number(board.revenue.ytd_cr).toFixed(2)} <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Cr YTD</span>
              </div>
              <p style={{ fontSize: 13, margin: '10px 0 6px', color: 'var(--text-primary)' }}>
                MTD: <strong>₹{Number(board.revenue.mtd_cr).toFixed(2)} Cr</strong>
                {board.revenue.invoice_count_mtd != null && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> · {board.revenue.invoice_count_mtd} invoice(s)</span>
                )}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                FY target (optional):{' '}
                <strong>{board.revenue.fy_target_cr != null ? `₹${Number(board.revenue.fy_target_cr).toFixed(2)} Cr` : '—'}</strong>
                {board.revenue.ytd_as_pct_of_fy != null && (
                  <> · YTD = <strong>{(board.revenue.ytd_as_pct_of_fy * 100).toFixed(1)}%</strong> of FY</>
                )}
              </p>
              {board.revenue.linear_ytd_expected_cr != null && (
                <p style={{ fontSize: 12, margin: '8px 0 0', color: 'var(--text-primary)' }}>
                  vs linear calendar pace:{' '}
                  {board.revenue.ytd_vs_linear_cr != null && board.revenue.ytd_vs_linear_cr < 0 ? (
                    <span style={{ color: 'var(--red)' }}>behind by ₹{Number(-board.revenue.ytd_vs_linear_cr).toFixed(2)} Cr</span>
                  ) : board.revenue.ytd_vs_linear_cr != null && board.revenue.ytd_vs_linear_cr > 0 ? (
                    <span style={{ color: 'var(--green)' }}>ahead by ₹{Number(board.revenue.ytd_vs_linear_cr).toFixed(2)} Cr</span>
                  ) : (
                    <span>on pace</span>
                  )}
                </p>
              )}
              {board.revenue.fy_target_cr == null && (
                <p style={{ fontSize: 11, color: 'var(--amber)', margin: '8px 0 0' }}>Set an FY target on the VP tab to compare YTD to goal and to linear pace.</p>
              )}
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.45, borderTop: '1px solid var(--border)', paddingTop: 10 }}>{board.definitions.revenue}</p>
            </div>

            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderTop: '4px solid var(--green)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Headcount run-rate (BD DAR)</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--green)', marginTop: 8, lineHeight: 1.15 }}>
                {board.headcount.onboarded_mtd}{' '}
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>onboarded MTD</span>
              </div>
              <p style={{ fontSize: 13, margin: '10px 0 6px', color: 'var(--text-primary)' }}>
                Monthly target:{' '}
                <strong>{board.headcount.monthly_target != null ? `+${board.headcount.monthly_target}` : '—'}</strong>
                {board.headcount.pct_of_target != null && board.headcount.monthly_target != null && (
                  <> · {((board.headcount.pct_of_target || 0) * 100).toFixed(0)}% of target</>
                )}
              </p>
              {board.headcount.gap_to_target != null && Number.isFinite(board.headcount.gap_to_target) && (
                <p style={{ fontSize: 12, color: board.headcount.gap_to_target > 0 ? 'var(--red)' : 'var(--text-muted)', margin: 0 }}>
                  Gap to target: <strong>{board.headcount.gap_to_target > 0 ? board.headcount.gap_to_target : 0}</strong> (positive = under target for the month)
                </p>
              )}
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.45, borderTop: '1px solid var(--border)', paddingTop: 10 }}>{board.definitions.headcount}</p>
            </div>

            <div
              className="card"
              style={{
                padding: '16px 18px',
                borderTop: '4px solid var(--accent-blue)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bench &amp; interviews</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent-blue)', marginTop: 8, lineHeight: 1.15 }}>
                {board.bench.selection_rate_bench != null && board.bench.selection_rate_bench > 0
                  ? fmt(board.bench.selection_rate_bench, true)
                  : '—'}
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}> bench selection</span>
              </div>
              <p style={{ fontSize: 13, margin: '10px 0 4px', color: 'var(--text-primary)' }}>
                Interviews MTD: <strong>{board.bench.total_interviews_mtd ?? 0}</strong> total
                {board.bench.bench_interviews_mtd != null && board.bench.market_interviews_mtd != null && (
                  <span style={{ color: 'var(--text-muted)' }}> (bench {board.bench.bench_interviews_mtd} · market {board.bench.market_interviews_mtd})</span>
                )}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                Bench RFD: <strong>{board.bench.bench_strength_rfd != null ? board.bench.bench_strength_rfd : '—'}</strong>
                {board.bench.total_interviews_all_time != null && (
                  <> · All-time interview rows: {board.bench.total_interviews_all_time}</>
                )}
              </p>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, lineHeight: 1.45, borderTop: '1px solid var(--border)', paddingTop: 10 }}>{board.definitions.bench}</p>
            </div>
          </div>
        </div>
      )}

      {bdTab === 'vp' && (
        <div className="card" style={{ marginBottom: 20, padding: '16px 18px', borderLeft: '4px solid var(--amber)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>VP — targets vs reality</h3>
            {isAdmin && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => (editingVp ? setEditingVp(false) : setEditingVp(true))}>
                {editingVp ? 'Cancel' : 'Edit numbers'}
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 12px' }}>
            <strong>Reality (calculated):</strong> headcount = onboarded rows in the BD snapshot with <em>Onboarded</em> and En. date in the current month; revenue = sum of <code>invoices.amount</code> (INR) converted to ₹ Cr. <strong>Targets</strong> below are the only hand-entered values (optional).
          </p>
          {editingVp && isAdmin ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginBottom: 10 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Monthly net-add target (headcount, optional)
                <input style={vpInputStyle} type="text" inputMode="numeric" placeholder="Optional" value={vpForm.monthly_engineer_target} onChange={(e) => setVpForm((f) => ({ ...f, monthly_engineer_target: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                Revenue FY target (₹ Cr, optional)
                <input style={vpInputStyle} type="text" inputMode="decimal" placeholder="Optional" value={vpForm.revenue_fy_target_cr} onChange={(e) => setVpForm((f) => ({ ...f, revenue_fy_target_cr: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, gridColumn: '1 / -1' }}>
                Period label (optional)
                <input style={vpInputStyle} value={vpForm.period_label} onChange={(e) => setVpForm((f) => ({ ...f, period_label: e.target.value }))} />
              </label>
            </div>
          ) : null}
          {editingVp && isAdmin ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={saveVp}>Save</button>
          ) : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, marginTop: editingVp ? 12 : 0 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Engineers</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                Target:{' '}
                {vp.monthly_engineer_target != null && Number.isFinite(Number(vp.monthly_engineer_target)) ? (
                  <strong style={{ color: 'var(--green)' }}>+{vp.monthly_engineer_target}</strong>
                ) : (
                  <strong style={{ color: 'var(--text-muted)' }}>— (set in Edit numbers)</strong>
                )}{' '}
                (monthly net add)
                <br />
                Onboarded this month (BD DAR):{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{Number(vp.reality?.engineers_onboarded_mtd ?? vp.net_engineer_actual) ?? 0}</strong>
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {vp.engineer_gap_to_monthly_target != null && Number.isFinite(vp.engineer_gap_to_monthly_target) ? (
                    <>Gap to target: <strong>{vp.engineer_gap_to_monthly_target}</strong> (actual ÷ target:{' '}
                    {vp.engineer_pct_of_monthly_target != null ? <strong>{(vp.engineer_pct_of_monthly_target * 100).toFixed(0)}%</strong> : '—'})</>
                  ) : (
                    <>Set a monthly headcount target to see gap vs onboarded (MTD).</>
                  )}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Revenue (₹ Cr)</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>
                FY target (if set):{' '}
                <strong>{vp.revenue_fy_target_cr != null && Number.isFinite(Number(vp.revenue_fy_target_cr)) ? Number(vp.revenue_fy_target_cr).toFixed(2) : '—'}</strong>
                <br />
                {vp.period_label || 'This month'} (invoices, MTD): <strong style={{ color: 'var(--accent-cyan)' }}>{Number(vp.revenue_mtd_cr).toFixed(2)}</strong>
                {vp.reality?.invoice_count_mtd != null && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> · {vp.reality.invoice_count_mtd} invoice(s)</span>
                )}
                <br />
                YTD (calendar year, invoices): <strong>{Number(vp.revenue_ytd_cr).toFixed(2)}</strong>
                {vp.reality?.invoice_count_ytd != null && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}> · {vp.reality.invoice_count_ytd} invoice(s)</span>
                )}
                <br />
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                  {vp.revenue_mtd_pct_of_annual != null && vp.revenue_fy_target_cr != null && Number(vp.revenue_fy_target_cr) > 0
                    ? (
                      <>This month as % of FY target: <strong>{(vp.revenue_mtd_pct_of_annual * 100).toFixed(2)}%</strong> · Prorated month from FY: ₹{Number(vp.revenue_prorated_monthly_cr).toFixed(2)} Cr.</>
                    )
                    : 'Set a FY target (₹ Cr) to see % and prorated pace.'}
                  <br />
                  {vp.revenue_gap_mtd_vs_prorated_cr != null && Number.isFinite(vp.revenue_gap_mtd_vs_prorated_cr) && (
                    vp.revenue_gap_mtd_vs_prorated_cr > 0 ? (
                      <span style={{ color: 'var(--red)' }}>Vs prorated month: behind by ₹{Number(vp.revenue_gap_mtd_vs_prorated_cr).toFixed(2)} Cr.</span>
                    ) : (
                      <span>Vs prorated month: ahead by ₹{Number(-vp.revenue_gap_mtd_vs_prorated_cr).toFixed(2)} Cr.</span>
                    )
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {bdTab === 'targets' && (
        <div className="card" style={{ marginBottom: 20, padding: '16px 18px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Targets (scorecard)</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Read-only summary of the same fields as the <strong>VP</strong> tab. Edit on VP or as Administrator via API.</p>
          <div style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card2)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Metric</th>
                  <th style={{ padding: '10px 12px' }}>Target / benchmark</th>
                  <th style={{ padding: '10px 12px' }}>Reality / actual</th>
                  <th style={{ padding: '10px 12px' }}>Note</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>Monthly net add (headcount)</td>
                  <td style={{ padding: '8px 12px' }}>{vp.monthly_engineer_target != null ? `+${vp.monthly_engineer_target}` : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{vp.reality?.engineers_onboarded_mtd ?? vp.net_engineer_actual} (onboarded MTD, BD DAR)</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{vp.engineer_gap_to_monthly_target != null ? `Gap ${vp.engineer_gap_to_monthly_target} vs target` : 'Set target to compare'}</td>
                </tr>
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>Revenue FY (₹ Cr)</td>
                  <td style={{ padding: '8px 12px' }}>{vp.revenue_fy_target_cr != null ? Number(vp.revenue_fy_target_cr).toFixed(2) : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>—</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Set FY target; reality from invoices</td>
                </tr>
                <tr style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 12px' }}>Revenue {vp.period_label || 'this month'} (₹ Cr)</td>
                  <td style={{ padding: '8px 12px' }}>{vp.revenue_prorated_monthly_cr != null ? `~${Number(vp.revenue_prorated_monthly_cr).toFixed(2)} (FY/12)` : '—'}</td>
                  <td style={{ padding: '8px 12px' }}>{Number(vp.revenue_mtd_cr).toFixed(2)} (invoices MTD)</td>
                  <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>{vp.revenue_mtd_pct_of_annual != null ? `${(vp.revenue_mtd_pct_of_annual * 100).toFixed(2)}% of FY target` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bdTab === 'executive' && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>Top-line business KPIs (Executive summary)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
            {Object.keys(exLabels).map((k) => {
              const isPct = k.includes('pct') || k.includes('Rate');
              const v = executive[k];
              return (
                <div key={k} className="card" style={{ padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>{exLabels[k]}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-blue)' }}>{fmt(v, isPct)}</div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {bdTab === 'positions' && (
        <div className="card" style={{ marginBottom: 20, padding: '0' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Positions (open from BD data)</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>Open = rows whose status is not yet closed (Onboarded, Lost/Deferred, Profile Rejected, Offer Rejected, No Show). Same pool as a typical “open reqs” / Positions sheet.</p>
          </div>
          <div style={{ maxHeight: 480, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card2)', textAlign: 'left', position: 'sticky', top: 0, zIndex: 1 }}>
                  <th style={{ padding: '8px 10px' }}>Account</th>
                  <th style={{ padding: '8px 10px' }}>Skill</th>
                  <th style={{ padding: '8px 10px' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Candidate</th>
                  <th style={{ padding: '8px 10px' }}>En. date</th>
                </tr>
              </thead>
              <tbody>
                {views.positions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: 12, color: 'var(--text-muted)' }}>No open positions in snapshot.</td>
                  </tr>
                ) : (
                  views.positions.map((row, i) => (
                    <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px' }}>{row.account}</td>
                      <td style={{ padding: '6px 10px' }}>{row.sub_skill ? `${row.skill} / ${row.sub_skill}` : row.skill}</td>
                      <td style={{ padding: '6px 10px' }}>{row.status}</td>
                      <td style={{ padding: '6px 10px' }}>{row.candidate || '—'}</td>
                      <td style={{ padding: '6px 10px' }}>{row.en_date ? String(row.en_date) : '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bdTab === 'funnel' && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)' }}>BD funnel (BD data — submission → onboard)</h3>
          <div style={{ overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card2)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px' }}>Stage</th>
                  <th style={{ padding: '10px 12px' }}>Count</th>
                  <th style={{ padding: '10px 12px' }}>% of total</th>
                  <th style={{ padding: '10px 12px' }}>% of previous</th>
                </tr>
              </thead>
              <tbody>
                {funnelOrder.map((key) => {
                  const row = funnel[key];
                  if (!row) return null;
                  return (
                    <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 12px' }}>{row.label}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{row.count}</td>
                      <td style={{ padding: '8px 12px' }}>{(row.pctOfTotal * 100).toFixed(2)}%</td>
                      <td style={{ padding: '8px 12px' }}>{row.pctOfPrevious == null ? '—' : `${(row.pctOfPrevious * 100).toFixed(2)}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {bdTab === 'accounts' && (
        <div className="card" style={{ marginBottom: 20, padding: '0' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Account scorecard</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>From BD data: totals per account (cleaned) — open reqs, active pipeline, onboarded.</p>
          </div>
          <div style={{ maxHeight: 480, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card2)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Account</th>
                  <th style={{ padding: '8px 10px' }}>Total rows</th>
                  <th style={{ padding: '8px 10px' }}>Open (not closed)</th>
                  <th style={{ padding: '8px 10px' }}>Active pipeline</th>
                  <th style={{ padding: '8px 10px' }}>Onboarded</th>
                </tr>
              </thead>
              <tbody>
                {views.account_scorecard.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: 12, color: 'var(--text-muted)' }}>No accounts.</td></tr>
                ) : (
                  views.account_scorecard.map((a) => (
                    <tr key={a.account} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px' }}>{a.account}</td>
                      <td style={{ padding: '6px 10px' }}>{a.total}</td>
                      <td style={{ padding: '6px 10px' }}>{a.open}</td>
                      <td style={{ padding: '6px 10px' }}>{a.active_pipeline}</td>
                      <td style={{ padding: '6px 10px' }}>{a.onboarded}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bdTab === 'skills' && (
        <div className="card" style={{ marginBottom: 20, padding: '0' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Skill gap</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '6px 0 0' }}>
              <strong>Demand</strong> = count of <em>open</em> BD rows by <code>Skill</code>. <strong>Supply</strong> = bench headcount by first token of <code>Skill Set</code> (rough match — align naming in the sheet for best results).
            </p>
          </div>
          <div style={{ maxHeight: 480, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card2)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Skill (primary)</th>
                  <th style={{ padding: '8px 10px' }}>Open reqs</th>
                  <th style={{ padding: '8px 10px' }}>Bench (approx.)</th>
                  <th style={{ padding: '8px 10px' }}>Gap (demand − supply)</th>
                </tr>
              </thead>
              <tbody>
                {views.skill_gap.length === 0 ? (
                  <tr><td colSpan={4} style={{ padding: 12, color: 'var(--text-muted)' }}>No data.</td></tr>
                ) : (
                  views.skill_gap.map((s) => (
                    <tr key={s.skill} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 10px' }}>{s.skill}</td>
                      <td style={{ padding: '6px 10px' }}>{s.open_requirements}</td>
                      <td style={{ padding: '6px 10px' }}>{s.bench_headcount}</td>
                      <td style={{ padding: '6px 10px', color: s.gap > 0 ? 'var(--red)' : 'var(--text-primary)' }}>{s.gap}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bdTab === 'bd_perf' && (
        <div className="card" style={{ marginBottom: 20, padding: '16px 18px' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, marginBottom: 6 }}>BD performance</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>Activity this month and mix across BD, bench interview, and market interview data. Owner split appears when your BD sheet has columns like <code>BD</code>, <code>SPOC</code>, or <code>Recruiter</code>.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            <div className="card" style={{ padding: '10px 12px', background: 'var(--bg-card2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Submissions (MTD)</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{perf.submissions_mtd}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{perf.month_label || 'This month'}</div>
            </div>
            <div className="card" style={{ padding: '10px 12px', background: 'var(--bg-card2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Bench interviews (MTD)</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{perf.bench_interviews_mtd}</div>
            </div>
            <div className="card" style={{ padding: '10px 12px', background: 'var(--bg-card2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Market interviews (MTD)</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{perf.market_interviews_mtd}</div>
            </div>
            <div className="card" style={{ padding: '10px 12px', background: 'var(--bg-card2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Open positions (BD)</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{perf.open_positions}</div>
            </div>
            <div className="card" style={{ padding: '10px 12px', background: 'var(--bg-card2)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Submissions → onboard (all time)</div>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{(perf.submission_to_onboard_rate * 100).toFixed(1)}%</div>
            </div>
          </div>

          {Array.isArray(perf.by_owner) && perf.by_owner.length > 0 && (
            <>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>By owner / SPOC</h4>
              <div style={{ overflow: 'auto', maxHeight: 220, border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-card2)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>Owner</th>
                      <th style={{ padding: '8px 10px' }}>Total</th>
                      <th style={{ padding: '8px 10px' }}>Open</th>
                      <th style={{ padding: '8px 10px' }}>Onboarded</th>
                      <th style={{ padding: '8px 10px' }}>Submissions (MTD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.by_owner.map((o) => (
                      <tr key={o.owner} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 10px' }}>{o.owner}</td>
                        <td style={{ padding: '6px 10px' }}>{o.total}</td>
                        <td style={{ padding: '6px 10px' }}>{o.open}</td>
                        <td style={{ padding: '6px 10px' }}>{o.onboarded}</td>
                        <td style={{ padding: '6px 10px' }}>{o.mtd}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>BD status mix (all rows)</h4>
          <div style={{ overflow: 'auto', maxHeight: 280, border: '1px solid var(--border)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-card2)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '8px 10px' }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {(perf.status_breakdown || []).map((r) => (
                  <tr key={r.status} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px' }}>{r.status}</td>
                    <td style={{ padding: '6px 10px' }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
