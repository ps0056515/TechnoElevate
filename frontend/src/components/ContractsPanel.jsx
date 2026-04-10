import React, { useEffect, useState } from 'react';

const statusConfig = {
  active: { label: 'Active', color: 'var(--green)', bg: 'var(--green-dim)' },
  expiring_soon: { label: 'Expiring Soon', color: 'var(--amber)', bg: 'var(--amber-dim)' },
  expired: { label: 'Expired', color: 'var(--red)', bg: 'var(--red-dim)' },
};

const fmtCurrency = (v) => '$' + parseFloat(v).toLocaleString('en-US', { maximumFractionDigits: 0 });

export default function ContractsPanel({ compact }) {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/contracts').then(r => r.json()).then(d => { setContracts(d); setLoading(false); });
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

                {/* Value */}
                <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {fmtCurrency(contract.value)}
                </span>

                {/* Actions */}
                {contract.status === 'expiring_soon' && (
                  <button className="btn btn-amber btn-sm">Renew SOW</button>
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
            </div>
          );
        })}
      </div>

      {compact && contracts.length > 4 && (
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <span style={{ fontSize: 11, color: 'var(--accent-blue)', cursor: 'pointer' }}>+{contracts.length - 4} more contracts →</span>
        </div>
      )}
    </div>
  );
}
