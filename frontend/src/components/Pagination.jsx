import React from 'react';

export default function Pagination({ page, totalPages, total, pageSize, onPageChange }) {
  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }

  const btn = (content, active, disabled, onClick) => (
    <button
      key={content + (active ? '-a' : '')}
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 32, height: 30, padding: '0 8px',
        borderRadius: 6, border: '1px solid var(--border)',
        background: active ? 'var(--accent-blue)' : 'var(--bg-card)',
        color: active ? '#fff' : disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        fontSize: 12, fontWeight: active ? 700 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!disabled && !active) e.currentTarget.style.background = 'var(--bg-hover)'; }}
      onMouseLeave={e => { if (!disabled && !active) e.currentTarget.style.background = 'var(--bg-card)'; }}
    >
      {content}
    </button>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, flexWrap: 'wrap', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        Showing {from}–{to} of {total}
      </span>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {btn('‹ Prev', false, page === 1, () => onPageChange(page - 1))}
        {pages.map((p, i) =>
          p === '…'
            ? <span key={'ellipsis-' + i} style={{ lineHeight: '30px', padding: '0 4px', color: 'var(--text-muted)', fontSize: 12 }}>…</span>
            : btn(p, p === page, false, () => onPageChange(p))
        )}
        {btn('Next ›', false, page === totalPages, () => onPageChange(page + 1))}
      </div>
    </div>
  );
}
