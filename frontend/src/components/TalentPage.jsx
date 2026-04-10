import React from 'react';
import TalentLifecycle from './TalentLifecycle.jsx';
import EngagementChecklist from './EngagementChecklist.jsx';

export default function TalentPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <TalentLifecycle />
      <EngagementChecklist />
    </div>
  );
}
