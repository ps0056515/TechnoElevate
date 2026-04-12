import React, { useEffect, useState } from 'react';
import TalentLifecycle from './TalentLifecycle.jsx';
import EngagementChecklist from './EngagementChecklist.jsx';
import ExportButton from './ExportButton.jsx';
import SendReportModal from './SendReportModal.jsx';
import { apiFetch } from '../api.js';

export default function TalentPage() {
  const [talent, setTalent] = useState([]);
  const [showSend, setShowSend] = useState(false);

  useEffect(() => {
    apiFetch('/api/talent/lifecycle').then(r => r.json()).then(d => setTalent(d.talents || []));
  }, []);

  const reportData = {
    title: 'Talent Report',
    sections: [{
      heading: 'Talent Roster',
      rows: talent.map(t => ({
        Name: t.name,
        Role: t.role,
        Status: t.status,
        Client: t.current_client || '—',
        Skills: Array.isArray(t.skills) ? t.skills.join(', ') : '',
        'Idle Hours': t.idle_hours || 0,
      })),
    }],
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <ExportButton data={reportData} filename="talent-report" />
        <button className="btn btn-secondary" onClick={() => setShowSend(true)} style={{ fontSize: 13 }}>📧 Send Report</button>
      </div>
      <TalentLifecycle />
      <EngagementChecklist />
      {showSend && (
        <SendReportModal reportType="Talent" data={reportData} onClose={() => setShowSend(false)} />
      )}
    </div>
  );
}
