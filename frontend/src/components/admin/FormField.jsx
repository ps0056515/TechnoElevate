import React from 'react';

const labelStyle = {
  display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
  letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 5,
};

const inputStyle = {
  width: '100%', background: 'var(--bg-card2)', border: '1px solid var(--border-light)',
  borderRadius: 7, padding: '8px 10px', color: 'var(--text-primary)',
  fontSize: 13, fontFamily: 'var(--font)', outline: 'none', transition: 'border-color 0.15s',
};

export function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={labelStyle}>{label}{required && <span style={{ color: 'var(--red)' }}> *</span>}</label>
      {children}
      {hint && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Input({ value, onChange, placeholder, type = 'text', ...props }) {
  return (
    <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} style={inputStyle}
      onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
      onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
      {...props}
    />
  );
}

export function Select({ value, onChange, options }) {
  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}
      onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
      onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o} style={{ background: 'var(--bg-card2)' }}>
          {o.label ?? o}
        </option>
      ))}
    </select>
  );
}

export function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea value={value ?? ''} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
      onFocus={e => e.target.style.borderColor = 'var(--accent-blue)'}
      onBlur={e => e.target.style.borderColor = 'var(--border-light)'}
    />
  );
}

export function Toggle({ label, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div onClick={() => onChange(!value)} style={{
        width: 38, height: 20, borderRadius: 10,
        background: value ? 'var(--accent-blue)' : 'var(--bg-hover)',
        border: '1px solid var(--border-light)', cursor: 'pointer', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}>
        <div style={{
          position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  );
}

export function Row({ children, cols = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
      {children}
    </div>
  );
}
