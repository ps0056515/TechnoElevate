import React from 'react';
import AttentionEngine from './AttentionEngine.jsx';
import TalentLifecycle from './TalentLifecycle.jsx';
import Pipeline from './Pipeline.jsx';
import ManagedServices from './ManagedServices.jsx';
import ContractsPanel from './ContractsPanel.jsx';
import EngagementChecklist from './EngagementChecklist.jsx';
import HealthMetrics from './HealthMetrics.jsx';
import FlowOverview from './FlowOverview.jsx';
import ForecastPanel from './ForecastPanel.jsx';

import { apiFetch } from '../api.js';

export default function DashboardOverview({ activeTab, onNavigate }) {
  // Auto-generate alerts on mount
  React.useEffect(() => {
    apiFetch('/api/attention/auto-generate', { method: 'POST' }).catch(() => {});
  }, []);
  if (activeTab === 'Talent') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TalentLifecycle />
        <EngagementChecklist />
      </div>
    );
  }
  if (activeTab === 'Pro Services') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Pipeline />
      </div>
    );
  }
  if (activeTab === 'Managed Services') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <ManagedServices />
      </div>
    );
  }
  if (activeTab === 'Contracts') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <ContractsPanel />
      </div>
    );
  }
  // Overview
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <FlowOverview onNavigate={onNavigate} />
      <HealthMetrics />
      <ForecastPanel />
      <AttentionEngine />
      <TalentLifecycle />
      <Pipeline />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ManagedServices compact />
        <ContractsPanel compact />
      </div>
      <EngagementChecklist />
    </div>
  );
}
