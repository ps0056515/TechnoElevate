import React, { useState } from 'react';
import ContractsPanel from './ContractsPanel.jsx';
import InvoicesPanel from './InvoicesPanel.jsx';
import ForecastPanel from './ForecastPanel.jsx';

const TABS = [
  { id: 'contracts', label: '📄 Contracts & SOW' },
  { id: 'invoices', label: '🧾 Invoices & Billing' },
  { id: 'forecast', label: '📈 Revenue Forecast & P&L' },
];

export default function ContractsPage() {
  const [activeTab, setActiveTab] = useState('contracts');

  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
            color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
            fontWeight: activeTab === tab.id ? 700 : 400, fontSize: 13, cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s',
          }}>{tab.label}</button>
        ))}
      </div>
      {activeTab === 'contracts' && <ContractsPanel />}
      {activeTab === 'invoices' && <InvoicesPanel />}
      {activeTab === 'forecast' && <ForecastPanel />}
    </div>
  );
}
