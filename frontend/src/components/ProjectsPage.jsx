import React, { useState } from 'react';
import ManagedServices from './ManagedServices.jsx';
import Pipeline from './Pipeline.jsx';
import IndustriesSectors from './IndustriesSectors.jsx';
import CaseStudiesTab from './CaseStudiesTab.jsx';
import ProjectDocuments from './ProjectDocuments.jsx';
import { apiFetch } from '../api.js';

const TABS = [
  { id: 'projects', label: '🏗️ Projects' },
  { id: 'industries', label: '🏭 Industries & Sectors' },
  { id: 'casestudies', label: '📘 Case Studies' },
  { id: 'documents', label: '📁 Documents' },
];

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [generatedDraft, setGeneratedDraft] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);

  // Load projects once for the Documents tab selector
  React.useEffect(() => {
    apiFetch('/api/projects').then(r => r && r.json ? r.json() : []).then(d => {
      const safe = Array.isArray(d) ? d : [];
      setProjects(safe);
      if (safe.length) setSelectedProject(safe[0]);
    }).catch(() => setProjects([]));
  }, []);

  const handleCaseStudyGenerated = (draft) => {
    setGeneratedDraft(draft);
    setDraftSaved(false);
  };

  const saveDraft = async () => {
    if (!generatedDraft) return;
    setSavingDraft(true);
    try {
      await apiFetch('/api/admin/case-studies', {
        method: 'POST',
        body: JSON.stringify({
          ...generatedDraft,
          published: false,
        }),
      });
      setDraftSaved(true);
      setGeneratedDraft(null);
    } catch {
      alert('Failed to save draft. Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 18px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 700 : 400,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'all 0.15s ease',
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <ManagedServices />
          <Pipeline />
        </div>
      )}

      {activeTab === 'industries' && <IndustriesSectors />}

      {activeTab === 'casestudies' && (
        <>
          {draftSaved && (
            <div style={{ padding: '10px 16px', borderRadius: 8, background: 'var(--green-dim)', border: '1px solid var(--green)', color: 'var(--green)', fontSize: 13, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>✅ Case study draft saved successfully! Review and publish it below.</span>
              <button onClick={() => setDraftSaved(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)', fontSize: 16 }}>✕</button>
            </div>
          )}
          <CaseStudiesTab />
        </>
      )}

      {activeTab === 'documents' && (
        <div>
          {/* Project selector */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Project:</label>
            <select
              value={selectedProject?.id || ''}
              onChange={e => setSelectedProject(projects.find(p => p.id === Number(e.target.value)))}
              style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 13 }}
            >
              {projects.map(p => <option key={p.id} value={p.id}>{p.name} — {p.client}</option>)}
            </select>
          </div>

          <ProjectDocuments
            project={selectedProject}
            onCaseStudyGenerated={(draft) => {
              handleCaseStudyGenerated(draft);
              setActiveTab('casestudies');
            }}
          />

          {/* AI draft preview */}
          {generatedDraft && (
            <div style={{ marginTop: 24, padding: 20, borderRadius: 12, background: 'var(--bg-card)', border: '2px solid var(--accent-blue)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, color: 'var(--accent-blue)', fontSize: 15 }}>✨ AI-Generated Case Study Draft</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" onClick={saveDraft} disabled={savingDraft}>{savingDraft ? 'Saving…' : 'Save as Draft'}</button>
                  <button className="btn btn-secondary" onClick={() => setGeneratedDraft(null)}>Discard</button>
                </div>
              </div>
              <h4 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>{generatedDraft.title}</h4>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                {generatedDraft.industry && <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: 'var(--accent-blue)', color: '#fff' }}>{generatedDraft.industry}</span>}
                {generatedDraft.sector && <span style={{ fontSize: 12, padding: '2px 10px', borderRadius: 12, background: 'var(--bg-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>{generatedDraft.sector}</span>}
              </div>
              {generatedDraft.challenge && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}><strong>Challenge:</strong> {generatedDraft.challenge}</p>}
              {generatedDraft.solution && <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--text-secondary)' }}><strong>Solution:</strong> {generatedDraft.solution}</p>}
              {generatedDraft.results && <p style={{ margin: 0, fontSize: 13, color: 'var(--green)' }}><strong>Results:</strong> {generatedDraft.results}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
