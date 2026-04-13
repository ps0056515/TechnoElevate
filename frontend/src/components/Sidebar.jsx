import React from 'react';

const navItems = [
  { label: 'Dashboard', icon: '⊞' },
  { label: 'Leads', icon: '◎', dot: true },
  { label: 'Requirements', icon: '☰' },
  { label: 'Projects', icon: '▣' },
  { label: 'Talent', icon: '◉' },
  { label: 'Contracts', icon: '📋', dot: true },
  { label: 'Client 360', icon: '🔭' },
  { label: 'Admin', icon: '⚙', highlight: true },
  { label: 'Settings', icon: '🔧' },
];

export default function Sidebar({ activeNav, setActiveNav }) {
  return (
    <div style={{
      width: 200, background: 'var(--bg-card)', borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '0 0 20px 0', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 16px 20px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: 'linear-gradient(135deg, #4f7cff, #a55eea)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 800, color: '#fff', flexShrink: 0,
        }}>TE</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>TechnoElevate</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase' }}>Operations</div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {navItems.map(item => (
          <button key={item.label} onClick={() => setActiveNav(item.label)} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '9px 10px', borderRadius: 7, border: 'none',
            background: activeNav === item.label ? 'var(--bg-hover)' : 'transparent',
            color: activeNav === item.label ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: activeNav === item.label ? 600 : 400,
            cursor: 'pointer', transition: 'all 0.15s', marginBottom: 2,
            borderLeft: activeNav === item.label ? '2px solid var(--accent-blue)' : '2px solid transparent',
          }}>
            <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{item.icon}</span>
            <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
            {item.dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', marginLeft: 'auto' }} />}
            {item.highlight && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)', padding: '1px 5px', borderRadius: 3, marginLeft: 'auto' }}>DATA</span>}
          </button>
        ))}
      </nav>

      {/* Live indicator */}
      <div style={{
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 11, color: 'var(--text-muted)',
        borderTop: '1px solid var(--border)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 4px var(--green)' }} className="pulse" />
        Live · Last sync 2 min ago
      </div>
    </div>
  );
}
