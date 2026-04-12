import React, { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../api.js';

const DOC_TYPES = ['RFP', 'SOW', 'Proposal', 'Amendment', 'Other'];

const DOC_ICONS = { RFP: '📋', SOW: '📄', Proposal: '💼', Amendment: '🔄', Other: '📎' };

function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ProjectDocuments({ project, onCaseStudyGenerated }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState('SOW');
  const [generating, setGenerating] = useState(null);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const load = () => {
    if (!project?.id) return;
    setLoading(true);
    apiFetch(`/api/projects/${project.id}/documents`)
      .then(r => r.json())
      .then(d => { setDocs(Array.isArray(d) ? d : []); setLoading(false); });
  };
  useEffect(load, [project?.id]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    const token = localStorage.getItem('te_token');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`/api/projects/${project.id}/documents`, { method: 'POST', headers, body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    await apiFetch(`/api/projects/documents/${docId}`, { method: 'DELETE' });
    load();
  };

  const handleDownload = (doc) => {
    const token = localStorage.getItem('te_token');
    const url = `/api/projects/documents/${doc.id}/file`;
    const a = document.createElement('a');
    a.href = url + (token ? `?token=${token}` : '');
    a.download = doc.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGenerate = async (doc) => {
    if (!['RFP', 'SOW', 'Proposal'].includes(doc.doc_type)) {
      return alert('AI generation is only available for RFP, SOW, and Proposal documents.');
    }
    setGenerating(doc.id);
    setError('');
    try {
      const res = await apiFetch(`/api/projects/documents/${doc.id}/generate-case-study`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (onCaseStudyGenerated) onCaseStudyGenerated(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(null);
    }
  };

  if (!project) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Select a project to view documents.</div>;

  return (
    <div>
      {/* Upload bar */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', minWidth: 100 }}>{project.name}</span>
        <select
          value={docType}
          onChange={e => setDocType(e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-hover)', color: 'var(--text-primary)', fontSize: 13 }}
        >
          {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <label style={{
          padding: '7px 14px', borderRadius: 6, background: uploading ? 'var(--bg-hover)' : 'var(--accent-blue)',
          color: '#fff', fontSize: 13, fontWeight: 600, cursor: uploading ? 'not-allowed' : 'pointer',
        }}>
          {uploading ? '⏳ Uploading…' : '+ Upload Document'}
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={handleUpload} disabled={uploading} />
        </label>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>PDF, DOC, DOCX, TXT · max 20 MB</span>
      </div>

      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)', fontSize: 13, marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
      ) : docs.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 10, border: '1px dashed var(--border)' }}>
          No documents uploaded yet. Upload an RFP or SOW to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map(doc => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
            }}>
              <span style={{ fontSize: 20 }}>{DOC_ICONS[doc.doc_type] || '📎'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doc.file_name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span style={{ padding: '1px 7px', borderRadius: 8, background: 'var(--bg-hover)', marginRight: 8, fontSize: 11 }}>{doc.doc_type}</span>
                  {formatBytes(doc.file_size)} · Uploaded {formatDate(doc.uploaded_at)}
                  {doc.uploaded_by_name && ` · ${doc.uploaded_by_name}`}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => handleGenerate(doc)}
                  disabled={generating === doc.id}
                  style={{
                    padding: '5px 12px', borderRadius: 6, border: '1px solid var(--accent-blue)', background: 'transparent',
                    color: 'var(--accent-blue)', fontSize: 12, fontWeight: 600, cursor: generating === doc.id ? 'wait' : 'pointer',
                  }}
                >{generating === doc.id ? '⏳ Generating…' : '✨ Generate Case Study'}</button>
                <button
                  onClick={() => handleDownload(doc)}
                  style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}
                >↓ Download</button>
                <button
                  onClick={() => handleDelete(doc.id)}
                  style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--red)', background: 'transparent', color: 'var(--red)', fontSize: 12, cursor: 'pointer' }}
                >✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
