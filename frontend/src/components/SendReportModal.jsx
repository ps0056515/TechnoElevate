import React, { useState } from 'react';
import { apiFetch } from '../api.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function buildHTMLSummary(data) {
  if (!data?.sections?.length) return '';
  return data.sections.map(s => {
    const rows = s.rows?.slice(0, 10) || [];
    if (!rows.length) return '';
    const cols = Object.keys(rows[0]);
    const thead = `<tr>${cols.map(c => `<th style="background:#0f172a;color:#94a3b8;padding:6px 10px;font-size:12px;text-align:left">${c}</th>`).join('')}</tr>`;
    const tbody = rows.map(r =>
      `<tr>${cols.map(c => `<td style="padding:6px 10px;font-size:12px;border-bottom:1px solid #e2e8f0;color:#374151">${r[c] ?? ''}</td>`).join('')}</tr>`
    ).join('');
    return `<h4 style="color:#1e293b;margin:16px 0 8px">${s.heading || ''}</h4>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden">
        <thead>${thead}</thead><tbody>${tbody}</tbody>
      </table>`;
  }).join('');
}

function buildPDFBlob(data) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(79, 124, 255);
  doc.text('TechnoElevate', 12, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(data.title || 'Report', 12, 17);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, pageW - 12, 17, { align: 'right' });
  let yPos = 30;
  for (const section of (data.sections || [])) {
    if (section.heading) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(section.heading, 12, yPos);
      yPos += 6;
    }
    if (section.rows?.length) {
      const cols = Object.keys(section.rows[0]);
      autoTable(doc, {
        startY: yPos,
        head: [cols],
        body: section.rows.map(r => cols.map(c => r[c] ?? '')),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [79, 124, 255], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 12, right: 12 },
      });
      yPos = doc.lastAutoTable.finalY + 14;
    }
  }
  return doc.output('blob');
}

export default function SendReportModal({ reportType, data, onClose }) {
  const [recipients, setRecipients] = useState('');
  const [message, setMessage] = useState('');
  const [format, setFormat] = useState('html');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    const emails = recipients.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (!emails.length) return setError('Please enter at least one valid email address.');
    setSending(true);
    setError('');
    try {
      const htmlContent = buildHTMLSummary(data);
      const res = await apiFetch('/api/reports/send', {
        method: 'POST',
        body: JSON.stringify({
          reportType,
          recipients: emails,
          message,
          subject: `TechnoElevate — ${reportType} Report`,
          htmlContent,
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 520, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>📧 Send Report for Review</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{reportType} · {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
        </div>

        {sent ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <h3 style={{ color: 'var(--green)', margin: '0 0 8px' }}>Report Sent!</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>The report has been sent to {recipients}</p>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>Close</button>
          </div>
        ) : (
          <div style={{ padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>To (emails, comma-separated) *</label>
              <input
                value={recipients}
                onChange={e => setRecipients(e.target.value)}
                placeholder="manager@company.com, client@example.com"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Message (optional)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                placeholder="Please review the attached report and share feedback…"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Format</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[['html', '📊 Inline HTML'], ['pdf', '📄 PDF Summary']].map(([v, l]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>
                    <input type="radio" name="format" value={v} checked={format === v} onChange={() => setFormat(v)} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSend} disabled={sending}>
                {sending ? '⏳ Sending…' : '📧 Send Report'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
