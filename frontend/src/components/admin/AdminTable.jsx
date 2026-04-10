import React, { useState } from 'react';

export default function AdminTable({ columns, rows, onEdit, onDelete, loading }) {
  const [deletingId, setDeletingId] = useState(null);

  const handleDelete = async (id) => {
    if (deletingId === id) {
      await onDelete(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(prev => prev === id ? null : prev), 3000);
    }
  };

  if (loading) return (
    <div className="loading"><div className="spinner" /> Loading…</div>
  );

  if (!rows.length) return (
    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: 13 }}>
      No records yet. Click <strong style={{ color: 'var(--accent-blue)' }}>+ Add New</strong> to create one.
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {columns.map(col => (
              <th key={col.key} style={{
                padding: '8px 10px', textAlign: 'left', fontWeight: 700,
                fontSize: 10, color: 'var(--text-muted)', letterSpacing: 0.8,
                textTransform: 'uppercase', whiteSpace: 'nowrap',
              }}>{col.label}</th>
            ))}
            <th style={{ padding: '8px 10px', width: 90 }} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} style={{
              borderBottom: '1px solid var(--border)',
              transition: 'background 0.1s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {columns.map(col => (
                <td key={col.key} style={{ padding: '9px 10px', color: 'var(--text-primary)', maxWidth: 200 }}>
                  {col.render ? col.render(row[col.key], row) : (
                    <span style={{
                      display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }} title={String(row[col.key] ?? '')}>
                      {row[col.key] ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </span>
                  )}
                </td>
              ))}
              <td style={{ padding: '9px 10px' }}>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button onClick={() => onEdit(row)} className="btn btn-ghost btn-sm" style={{ padding: '3px 9px' }}>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(row.id)}
                    className="btn btn-sm"
                    style={{
                      padding: '3px 9px',
                      background: deletingId === row.id ? 'var(--red)' : 'var(--red-dim)',
                      color: deletingId === row.id ? '#fff' : 'var(--red)',
                      border: '1px solid rgba(255,71,87,0.3)',
                      borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {deletingId === row.id ? 'Confirm?' : 'Del'}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
