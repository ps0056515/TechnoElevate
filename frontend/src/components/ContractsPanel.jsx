import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';
import { calcMargin, marginColor } from '../utils/marginUtils.js';

const statusConfig = {
  active: { label: 'Active', color: 'var(--green)', bg: 'var(--green-dim)' },
  expiring_soon: { label: 'Expiring Soon', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  expired: { label: 'Expired', color: 'var(--red)', bg: 'var(--red-dim)' },
};

const stageColors = {
  intake: 'var(--text-muted)', sourcing: 'var(--purple)', submission: 'var(--accent-blue)',
  screening: 'var(--amber)', interviewing: 'var(--accent-cyan)', closure: 'var(--green)',
};

const fmtCurrency = (v) => '$' + parseFloat(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function ContractsPanel({ compact }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [renewTarget, setRenewTarget] = useState(null);
  const [renewForm, setRenewForm] = useState({});
  const [renewing, setRenewing] = useState(false);

  const openRenew = (contract) => {
    const newStart = contract.end_date?.split('T')[0] || new Date().toISOString().split('T')[0];
    const newEnd = new Date(new Date(newStart).setFullYear(new Date(newStart).getFullYear() + 1)).toISOString().split('T')[0];
    setRenewForm({ sow_id: '', client: contract.client, start_date: newStart, end_date: newEnd, value: contract.value, status: 'active', utilization_pct: 0, invoice_overdue: false, invoice_amount: 0 });
    setRenewTarget(contract);
  };

  const saveRenew = async () => {
    if (!renewForm.client) return;
    setRenewing(true);
    await apiFetch('/api/admin/contracts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(renewForm) });
    setRenewing(false); setRenewTarget(null);
    apiFetch('/api/contracts').then(r => r.json()).then(d => { setContracts(Array.isArray(d) ? d : []); });
  };

  useEffect(() => {
    apiFetch('/api/contracts')
      .then(r => r && r.json ? r.json() : [])
      .then(d => { setContracts(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setContracts([]); setLoading(false); });
  }, []);

  const filtered = filter === 'all' ? contracts : contracts.filter(c => c.status === filter);
  const display = compact ? filtered.slice(0, 4) : filtered;

  const expiringCount = contracts.filter(c => c.status === 'expiring_soon').length;
  const overdueCount = contracts.filter(c => c.invoice_overdue).length;
  const totalValue = contracts.filter(c => c.status === 'active').reduce((s, c) => s + parseFloat(c.value || 0), 0);

  if (loading) return (
    <div className="card"><div className="loading"><div className="spinner" /> Loading contracts…</div></div>
  );

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="section-header">
        <span className="section-title">Contracts & SOW</span>
        {!compact && (
          <div style={{ display: 'flex', gap: 4 }}>
            {['all', 'expiring_soon', 'active', 'expired'].map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}>
                {f === 'all' ? 'All' : statusConfig[f]?.label || f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary pills */}
      {!compact && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div style={{ flex: 1, background: 'var(--amber-dim)', border: '1px solid rgba(255,165,2,0.25)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--amber)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>Expiring Soon</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--amber)' }}>{expiringCount}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--red-dim)', border: '1px solid rgba(255,71,87,0.25)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--red)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>Overdue Invoices</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--red)' }}>{overdueCount}</div>
          </div>
          <div style={{ flex: 2, background: 'var(--green-dim)', border: '1px solid rgba(46,213,115,0.2)', borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>Active Contract Value</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{fmtCurrency(totalValue)}</div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {display.map(contract => {
          const cfg = statusConfig[contract.status] || statusConfig.active;
          const daysLeft = parseInt(contract.days_remaining);
          const utilColor = contract.utilization_pct >= 85 ? 'var(--green)' : contract.utilization_pct >= 70 ? 'var(--amber)' : 'var(--red)';

          const linkedReqs = contract.linked_requirements || [];
          const avgM = contract.avg_margin != null ? Math.round(parseFloat(contract.avg_margin)) : null;
          const isExpanded = expandedId === contract.id;

          return (
            <div key={contract.id} style={{
              background: 'var(--bg-card2)',
              border: `1px solid ${contract.status === 'expiring_soon' ? 'rgba(255,165,2,0.3)' : contract.status === 'expired' ? 'rgba(255,71,87,0.3)' : 'var(--border)'}`,
              borderRadius: 8, padding: '10px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                {/* SOW ID + Client */}
                <div style={{ flex: '0 0 auto' }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{contract.sow_id}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{contract.client}</div>
                </div>

                {/* Status pill */}
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: cfg.bg, color: cfg.color,
                }}>
                  {cfg.label}
                  {daysLeft !== null && contract.status === 'expiring_soon' && ` · ${daysLeft}d left`}
                </span>

                {/* Invoice overdue */}
                {contract.invoice_overdue && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: 'var(--red-dim)', color: 'var(--red)',
                  }}>
                    ⚠ Invoice Overdue {fmtCurrency(contract.invoice_amount)}
                  </span>
                )}

                {/* Avg Margin badge */}
                {avgM !== null && (
                  <span style={{
                    padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: `${marginColor(avgM)}22`, color: marginColor(avgM),
                    border: `1px solid ${marginColor(avgM)}44`,
                  }}>
                    {avgM}% margin
                  </span>
                )}

                {/* Linked reqs toggle */}
                {!compact && linkedReqs.length > 0 && (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : contract.id)}
                    style={{ padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700, background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', border: '1px solid rgba(0,170,255,0.2)', cursor: 'pointer' }}
                  >
                    {linkedReqs.length} req{linkedReqs.length !== 1 ? 's' : ''} {isExpanded ? '▲' : '▼'}
                  </button>
                )}

                {/* Value */}
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {fmtCurrency(contract.value)}
                </span>

                {/* Actions */}
                {(contract.status === 'expiring_soon' || contract.status === 'expired') && (
                  <button className="btn btn-amber btn-sm" onClick={() => openRenew(contract)}>Renew SOW</button>
                )}
                {contract.invoice_overdue && (
                  <button className="btn btn-red btn-sm">Send Invoice</button>
                )}
              </div>

              {!compact && (
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {new Date(contract.start_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} →
                    {new Date(contract.end_date).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <div style={{ flex: 1, maxWidth: 180 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
                      <span>Utilization</span><span style={{ color: utilColor }}>{contract.utilization_pct}%</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${contract.utilization_pct}%`, background: utilColor, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Linked Requirements panel */}
              {!compact && isExpanded && linkedReqs.length > 0 && (
                <div style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Linked Requirements</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {linkedReqs.map(r => {
                      const pct = r.margin_pct != null ? parseFloat(r.margin_pct) : null;
                      return (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-hover)', borderRadius: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-blue)' }}>{r.req_id}</span>
                          <span style={{ fontSize: 12, fontWeight: 500, flex: 1 }}>{r.title}</span>
                          <span style={{ fontSize: 10, color: stageColors[r.stage], fontWeight: 600, textTransform: 'capitalize' }}>{r.stage}</span>
                          {r.assigned_talent_name && (
                            <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 600 }}>👤 {r.assigned_talent_name}</span>
                          )}
                          {pct !== null && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: marginColor(pct) }}>{pct}%</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {compact && contracts.length > 4 && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}>+{contracts.length - 4} more contracts →</span>
        </div>
      )}

      {/* Renew SOW modal */}
      {renewTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 380, border: '1px solid var(--border)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Renew SOW</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>Renewing: {renewTarget.sow_id} · {renewTarget.client}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>New Start Date
                <input type="date" value={renewForm.start_date || ''} onChange={e => setRenewForm(f => ({ ...f, start_date: e.target.value }))} style={{ display: 'block', marginTop: 4, width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-light)', background: 'var(--bg-card2)', color: 'var(--text-primary)', fontSize: 13 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>New End Date
                <input type="date" value={renewForm.end_date || ''} onChange={e => setRenewForm(f => ({ ...f, end_date: e.target.value }))} style={{ display: 'block', marginTop: 4, width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-light)', background: 'var(--bg-card2)', color: 'var(--text-primary)', fontSize: 13 }} />
              </label>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contract Value ($)
                <input type="number" value={renewForm.value || ''} onChange={e => setRenewForm(f => ({ ...f, value: e.target.value }))} style={{ display: 'block', marginTop: 4, width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border-light)', background: 'var(--bg-card2)', color: 'var(--text-primary)', fontSize: 13 }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-ghost" onClick={() => setRenewTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveRenew} disabled={renewing}>{renewing ? 'Saving…' : 'Create Renewal'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
