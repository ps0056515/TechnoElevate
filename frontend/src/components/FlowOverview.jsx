import React, { useEffect, useState } from 'react';
import { apiFetch } from '../api.js';

// Arrow connector between nodes
function Arrow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, padding: '0 2px' }}>
      <div style={{ width: 16, height: 1, background: 'var(--border-light)' }} />
      <div style={{ width: 0, height: 0, borderTop: '4px solid transparent', borderBottom: '4px solid transparent', borderLeft: '6px solid var(--border-light)' }} />
    </div>
  );
}

// Individual stage node
function Node({ icon, label, count, color, bg, onClick, highlight, sublabel }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '10px 12px', borderRadius: 10, minWidth: 100,
        background: hovered ? bg : highlight ? bg : 'var(--bg-card2)',
        border: `1px solid ${hovered || highlight ? color : 'var(--border)'}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s', flexShrink: 0,
        boxShadow: highlight ? `0 0 0 1px ${color}44` : 'none',
      }}
    >
      <div style={{ fontSize: 16, marginBottom: 3 }}>{icon}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1, marginBottom: 2 }}>
        {count ?? '—'}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.3, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
      {sublabel && (
        <div style={{ fontSize: 9, color, marginTop: 2, fontWeight: 600 }}>{sublabel}</div>
      )}
    </div>
  );
}

// A single flow row
function FlowRow({ label, labelColor, nodes }) {
  return (
    <div>
      <div style={{
        fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
        color: labelColor, marginBottom: 10, paddingLeft: 2,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: labelColor }} />
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
        {nodes.map((node, i) => (
          <React.Fragment key={node.label}>
            {i > 0 && <Arrow />}
            <Node {...node} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function FlowOverview({ onNavigate }) {
  const [leads, setLeads] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [engagements, setEngagements] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/api/leads').then(r => r.json()).catch(() => []),
      apiFetch('/api/pipeline').then(r => r.json()).catch(() => []),
      apiFetch('/api/projects').then(r => r.json()).catch(() => []),
      apiFetch('/api/engagements').then(r => r.json()).catch(() => []),
      apiFetch('/api/contracts').then(r => r.json()).catch(() => []),
    ]).then(([l, r, p, e, c]) => {
      setLeads(Array.isArray(l) ? l : []);
      setReqs(Array.isArray(r) ? r : []);
      setProjects(Array.isArray(p) ? p : []);
      setEngagements(Array.isArray(e) ? e : []);
      setContracts(Array.isArray(c) ? c : []);
      setLoading(false);
    });
  }, []);

  // ── Pro Services counts ──────────────────────────────────────────────────────
  const proLeadsOpen   = leads.filter(l => ['new', 'follow_up'].includes(l.status)).length;
  const proLeadsWon    = leads.filter(l => l.status === 'won').length;
  const reqsOpen       = reqs.filter(r => r.stage !== 'closure').length;
  const reqsAssigned   = reqs.filter(r => r.assigned_talent_id && r.stage !== 'closure').length;
  const reqsInterview  = reqs.filter(r => r.stage === 'interviewing').length;
  const reqsClosed     = reqs.filter(r => r.stage === 'closure').length;
  const engActive      = engagements.length;
  const contractsActive = contracts.filter(c => c.status === 'active').length;

  // ── Managed Services counts ──────────────────────────────────────────────────
  const msLeads     = leads.length;
  const projTotal   = projects.length;
  const projGreen   = projects.filter(p => p.stage === 'green').length;
  const projAtRisk  = projects.filter(p => p.stage === 'at_risk').length;
  const projBlocked = projects.filter(p => p.stage === 'blocked').length;
  const projDone    = projects.filter(p => p.stage === 'completed').length;

  const proNodes = [
    {
      icon: '📋', label: 'Open Leads', count: proLeadsOpen,
      color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)',
      onClick: onNavigate ? () => onNavigate('Leads') : null,
      sublabel: 'pursuing',
    },
    {
      icon: '🏆', label: 'Won & Qualified', count: proLeadsWon,
      color: 'var(--purple)', bg: 'rgba(165,94,234,0.12)',
      onClick: onNavigate ? () => onNavigate('Leads') : null,
      highlight: proLeadsWon > 0,
    },
    {
      icon: '📌', label: 'Open Requirements', count: reqsOpen,
      color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)',
      onClick: onNavigate ? () => onNavigate('Requirements') : null,
      sublabel: 'active reqs',
    },
    {
      icon: '👤', label: 'Talent Mapped', count: reqsAssigned,
      color: 'var(--accent-cyan)', bg: 'rgba(0,210,211,0.1)',
      onClick: onNavigate ? () => onNavigate('Requirements') : null,
      highlight: reqsAssigned > 0,
      sublabel: 'engineer assigned',
    },
    {
      icon: '🎙', label: 'In Interview', count: reqsInterview,
      color: 'var(--amber)', bg: 'var(--amber-dim)',
      onClick: onNavigate ? () => onNavigate('Requirements') : null,
      highlight: reqsInterview > 0,
      sublabel: 'client screening',
    },
    {
      icon: '✅', label: 'Req Closed', count: reqsClosed,
      color: 'var(--green)', bg: 'var(--green-dim)',
      onClick: onNavigate ? () => onNavigate('Requirements') : null,
      highlight: reqsClosed > 0,
      sublabel: 'placement done',
    },
    {
      icon: '🚀', label: 'Live Engagements', count: engActive,
      color: 'var(--green)', bg: 'var(--green-dim)',
      onClick: onNavigate ? () => onNavigate('Dashboard') : null,
      highlight: engActive > 0,
      sublabel: 'on-site / remote',
    },
    {
      icon: '📄', label: 'Active Contracts', count: contractsActive,
      color: 'var(--green)', bg: 'var(--green-dim)',
      onClick: onNavigate ? () => onNavigate('Contracts') : null,
      sublabel: 'signed SOW',
    },
  ];

  const msNodes = [
    {
      icon: '📋', label: 'Total Leads', count: msLeads,
      color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)',
      onClick: onNavigate ? () => onNavigate('Leads') : null,
      sublabel: 'all opportunities',
    },
    {
      icon: '🗂', label: 'Projects Initiated', count: projTotal,
      color: 'var(--accent-blue)', bg: 'var(--accent-blue-dim)',
      onClick: onNavigate ? () => onNavigate('Projects') : null,
      sublabel: 'in delivery',
    },
    {
      icon: '🟢', label: 'On Track', count: projGreen,
      color: 'var(--green)', bg: 'var(--green-dim)',
      onClick: onNavigate ? () => onNavigate('Projects') : null,
      highlight: projGreen > 0,
      sublabel: 'healthy',
    },
    {
      icon: '⚠️', label: 'Needs Attention', count: projAtRisk,
      color: 'var(--amber)', bg: 'var(--amber-dim)',
      onClick: onNavigate ? () => onNavigate('Projects') : null,
      highlight: projAtRisk > 0,
      sublabel: 'at risk',
    },
    {
      icon: '🔴', label: 'Escalation Needed', count: projBlocked,
      color: 'var(--red)', bg: 'var(--red-dim)',
      onClick: onNavigate ? () => onNavigate('Projects') : null,
      highlight: projBlocked > 0,
      sublabel: 'blocked',
    },
    {
      icon: '🏁', label: 'Project Delivered', count: projDone,
      color: 'var(--green)', bg: 'var(--green-dim)',
      onClick: onNavigate ? () => onNavigate('Projects') : null,
      sublabel: 'completed',
    },
    {
      icon: '📄', label: 'Active Contracts', count: contractsActive,
      color: 'var(--green)', bg: 'var(--green-dim)',
      onClick: onNavigate ? () => onNavigate('Contracts') : null,
      sublabel: 'signed SOW',
    },
  ];

  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>Business Pipeline Flow</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            Live counts across both service lines — click any stage to navigate
          </div>
        </div>
        {loading && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Loading…</div>}
      </div>

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <FlowRow
            label="Professional Services"
            labelColor="var(--accent-blue)"
            nodes={proNodes}
          />
          <div style={{ borderTop: '1px solid var(--border)' }} />
          <FlowRow
            label="Managed Services · Projects"
            labelColor="var(--green)"
            nodes={msNodes}
          />
        </div>
      )}
    </div>
  );
}
