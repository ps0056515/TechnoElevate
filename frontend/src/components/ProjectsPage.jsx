import React from 'react';
import ManagedServices from './ManagedServices.jsx';
import Pipeline from './Pipeline.jsx';

export default function ProjectsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <ManagedServices />
      <Pipeline />
    </div>
  );
}
