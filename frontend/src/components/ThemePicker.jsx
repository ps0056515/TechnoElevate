import React from 'react';
import { useTheme, THEMES } from '../ThemeContext.jsx';

export default function ThemePicker({ compact = false }) {
  const { theme, setTheme } = useTheme();

  if (compact) {
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {THEMES.map(t => (
          <button
            key={t.key}
            onClick={() => setTheme(t.key)}
            title={t.label}
            style={{
              width: 26, height: 26, borderRadius: '50%', border: 'none',
              background: `linear-gradient(135deg, ${t.preview[0]} 50%, ${t.preview[2]} 100%)`,
              cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0,
              boxShadow: theme === t.key
                ? `0 0 0 2px var(--accent-blue), 0 0 0 4px var(--bg-base)`
                : '0 1px 4px rgba(0,0,0,0.25)',
              transform: theme === t.key ? 'scale(1.15)' : 'scale(1)',
              transition: 'all 0.2s ease',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {THEMES.map(t => (
        <button
          key={t.key}
          onClick={() => setTheme(t.key)}
          style={{
            flex: 1, padding: '12px 10px', borderRadius: 10, cursor: 'pointer',
            border: theme === t.key ? '2px solid var(--accent-blue)' : '2px solid var(--border)',
            background: theme === t.key ? 'var(--accent-blue-dim)' : 'var(--bg-card2)',
            transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
          }}
        >
          {/* Mini preview swatch */}
          <div style={{ width: 48, height: 32, borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: 2, padding: 4, background: t.preview[0] }}>
            <div style={{ height: 6, borderRadius: 3, background: t.preview[1], width: '100%' }} />
            <div style={{ height: 4, borderRadius: 2, background: t.preview[2], width: '70%' }} />
            <div style={{ height: 4, borderRadius: 2, background: t.preview[1], width: '85%', opacity: 0.6 }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: theme === t.key ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
            {t.icon} {t.label}
          </div>
          {theme === t.key && (
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-blue)', letterSpacing: 0.5 }}>ACTIVE</div>
          )}
        </button>
      ))}
    </div>
  );
}
