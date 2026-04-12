import React, { useState, useRef, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

/**
 * data shape:
 * {
 *   title: string,
 *   sections: [
 *     { heading: string, rows: [{ colName: value, ... }] }
 *   ]
 * }
 */
export default function ExportButton({ data, filename = 'report' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const exportPDF = () => {
    setOpen(false);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();

    // Header
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
          didDrawPage: () => { yPos = doc.lastAutoTable.finalY + 14; },
        });
        yPos = doc.lastAutoTable.finalY + 14;
      }
    }

    doc.save(`${filename}.pdf`);
  };

  const exportExcel = () => {
    setOpen(false);
    const wb = XLSX.utils.book_new();
    for (const section of (data.sections || [])) {
      if (!section.rows?.length) continue;
      const ws = XLSX.utils.json_to_sheet(section.rows);
      const sheetName = (section.heading || 'Sheet').slice(0, 31);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, `${filename}.xlsx`);
  };

  const printPage = () => {
    setOpen(false);
    window.print();
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        className="btn btn-secondary"
        onClick={() => setOpen(o => !o)}
        style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
      >
        ↓ Export <span style={{ fontSize: 10 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 4,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 200, minWidth: 160, overflow: 'hidden',
        }}>
          {[
            { icon: '📄', label: 'Export as PDF', action: exportPDF },
            { icon: '📊', label: 'Export as Excel', action: exportExcel },
            { icon: '🖨️', label: 'Print', action: printPage },
          ].map(item => (
            <button
              key={item.label}
              onClick={item.action}
              style={{
                width: '100%', padding: '10px 16px', background: 'none', border: 'none',
                display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                color: 'var(--text-primary)', fontSize: 13, textAlign: 'left',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
