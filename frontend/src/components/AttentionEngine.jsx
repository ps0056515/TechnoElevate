import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

const priorityConfig = {
  HIGH: { dot: 'dot-red', badge: 'badge-red', label: 'HIGH', btnClass: 'btn-red' },
  MED: { dot: 'dot-amber', badge: 'badge-amber', label: 'MED', btnClass: 'btn-amber' },
  LOW: { dot: 'dot-blue', badge: 'badge-blue', label: 'LOW', btnClass: 'btn-ghost' },
};

export default function AttentionEngine() {
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [draftModal, setDraftModal] = useState(null);   // { issue }
  const [draftLoading, setDraftLoading] = useState(false);
  const [draft, setDraft] = useState(null);             // { subject, body, tone }

  const load = () => {
    apiFetch('/api/attention')
      .then(r => r && r.json ? r.json() : [])
      .then(d => { setIssues(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setIssues([]); setLoading(false); });
  };
  useEffect(load, []);

  const resolve = async (id) => {
    await apiFetch(`/api/attention/${id}/resolve`, { method: 'PATCH' });
    setIssues(prev => prev.filter(i => i.id !== id));
  };

  const openDraft = async (issue) => {
    setDraftModal(issue);
    setDraft(null);
    setDraftLoading(true);
    try {
      const res = await apiFetch('/api/ai/draft-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_type: issue.entity_type,
          entity_name: issue.entity_name,
          issue: issue.issue_description,
          recipient_name: issue.entity_name,
        }),
      });
      const data = await res.json();
      setDraft(data.error ? null : data);
      if (data.error) alert('AI Error: ' + data.error);
    } catch { alert('Failed to generate email draft'); }
    setDraftLoading(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => alert('Copied to clipboard!'));
  };

  const highCount = issues.filter(i => i.priority === 'HIGH').length;

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        borderBottom: collapsed ? 'none' : '1px solid var(--border)',
        background: 'linear-gradient(90deg, rgba(255,71,87,0.06) 0%, transparent 60%)',
      }}>
        <span className="dot dot-red pulse" />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-primary)' }}>
          Attention Engine — Priority Issues
        </span>
        <AiBadge />
        {highCount > 0 && (
          <span className="badge badge-red">{highCount} critical</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm">Configure rules ›</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {loading ? (
            <div className="loading"><div className="spinner" /> Loading issues…</div>
          ) : issues.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--green)', fontWeight: 600 }}>
              ✓ All clear — no priority issues
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '90px 200px 1fr 140px',
                padding: '8px 16px', gap: 12,
                fontSize: 10, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
              }}>
                <span>Priority</span><span>Entity</span><span>Issue</span><span>Action</span>
              </div>
              {issues.map((issue, idx) => {
                const cfg = priorityConfig[issue.priority] || priorityConfig.LOW;
                return (
                  <div key={issue.id} style={{
                    display: 'grid', gridTemplateColumns: '90px 200px 1fr 140px',
                    padding: '11px 16px', gap: 12, alignItems: 'center',
                    borderBottom: idx < issues.length - 1 ? '1px solid var(--border)' : 'none',
                    background: issue.priority === 'HIGH' ? 'rgba(255,71,87,0.02)' : 'transparent',
                    transition: 'background 0.15s',
                  }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = issue.priority === 'HIGH' ? 'rgba(255,71,87,0.02)' : 'transparent'}>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className={`dot ${cfg.dot}`} />
                      <span className={`badge ${cfg.badge}`}>{cfg.label}</span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{issue.entity_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                        {issue.entity_type.charAt(0).toUpperCase() + issue.entity_type.slice(1)}
                        {issue.days_stalled > 0 && ` · ${issue.days_stalled} days`}
                      </div>
                    </div>

                    <div style={{
                      fontSize: 13, fontWeight: 500,
                      color: issue.priority === 'HIGH' ? 'var(--red)' : issue.priority === 'MED' ? 'var(--amber)' : 'var(--text-secondary)',
                    }}>
                      {issue.issue_description}
                    </div>

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className={`btn btn-sm ${cfg.btnClass}`} onClick={() => resolve(issue.id)}>
                        {issue.action_label}
                      </button>
                      <button className="btn btn-sm btn-ghost" onClick={() => openDraft(issue)} title="AI draft email for this issue"
                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        ✉ Draft
                        <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--purple)', background: 'rgba(165,94,234,0.12)', border: '1px solid rgba(165,94,234,0.3)', borderRadius: 3, padding: '1px 4px', letterSpacing: 0.5 }}>AI</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── AI Email Draft Modal ─────────────────────────────────────────────── */}
      {draftModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 560, maxHeight: '80vh', overflowY: 'auto', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 20 }}>✉️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>AI Email Draft</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{draftModal.entity_name} · {draftModal.issue_description}</div>
              </div>
              <button onClick={() => { setDraftModal(null); setDraft(null); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 20, color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
            </div>

            {draftLoading && (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ marginBottom: 12 }} />
                Drafting email with GPT-4o…
              </div>
            )}

            {draft && (
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Subject</div>
                  <div style={{ padding: '8px 12px', background: 'var(--bg-card2)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, fontWeight: 600 }}>{draft.subject}</div>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
                    Body <span style={{ marginLeft: 8, color: draft.tone === 'urgent' ? 'var(--red)' : draft.tone === 'friendly' ? 'var(--green)' : 'var(--accent-blue)', textTransform: 'capitalize', fontWeight: 600 }}>{draft.tone}</span>
                  </div>
                  <div style={{ padding: '12px', background: 'var(--bg-card2)', borderRadius: 6, border: '1px solid var(--border)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontFamily: 'var(--font)' }}>
                    {draft.body}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={() => copyToClipboard(`Subject: ${draft.subject}\n\n${draft.body}`)}>
                    📋 Copy to Clipboard
                  </button>
                  <button className="btn btn-ghost" onClick={() => openDraft(draftModal)}>🔄 Regenerate</button>
                  <button className="btn btn-ghost" onClick={() => { setDraftModal(null); setDraft(null); }}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AiBadge() {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase',
      background: 'linear-gradient(135deg, rgba(165,94,234,0.15), rgba(79,124,255,0.15))',
      color: 'var(--purple)', border: '1px solid rgba(165,94,234,0.4)',
      borderRadius: 4, padding: '2px 6px', marginLeft: 4, verticalAlign: 'middle',
    }}>✦ AI</span>
  );
}
