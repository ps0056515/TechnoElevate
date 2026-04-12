import React, { useState, useEffect } from 'react';
import { Field, Input, Select, Row, Toggle, Textarea } from './admin/FormField.jsx';
import ThemePicker from './ThemePicker.jsx';
import { apiFetch } from '../api.js';

const SETTING_TABS = [
  { key: 'profile',       label: '👤 Profile',         desc: 'Your personal details and preferences' },
  { key: 'team',          label: '👥 Team & Roles',     desc: 'Manage team members and their access' },
  { key: 'notifications', label: '🔔 Notifications',    desc: 'Control how and when you get alerted' },
  { key: 'platform',      label: '⚙ Platform',          desc: 'General platform configuration' },
  { key: 'security',      label: '🔒 Security',          desc: 'Password and access control' },
  { key: 'integrations',  label: '🔗 Integrations',     desc: 'Connect external tools and APIs' },
];

const TEAM_MEMBERS = [
  { id: 1, name: 'Sarah K.',      email: 'sarah@techno.com',  role: 'Delivery Lead',    status: 'active',   initials: 'SK', color: 'linear-gradient(135deg,#4f7cff,#a55eea)' },
  { id: 2, name: 'Admin User',    email: 'admin@techno.com',  role: 'Administrator',    status: 'active',   initials: 'AU', color: 'linear-gradient(135deg,#ff4757,#a55eea)' },
  { id: 3, name: 'Ops Manager',   email: 'ops@techno.com',    role: 'Operations',       status: 'active',   initials: 'OM', color: 'linear-gradient(135deg,#2ed573,#4f7cff)' },
  { id: 4, name: 'Raj Patel',     email: 'raj@techno.com',    role: 'Sourcing Lead',    status: 'inactive', initials: 'RP', color: 'linear-gradient(135deg,#ffa502,#ff4757)' },
  { id: 5, name: 'Tina Zhou',     email: 'tina@techno.com',   role: 'Accounts Manager', status: 'active',   initials: 'TZ', color: 'linear-gradient(135deg,#00d4ff,#4f7cff)' },
];

const ROLE_OPTIONS = ['Administrator', 'Delivery Lead', 'Operations', 'Sourcing Lead', 'Accounts Manager', 'View Only'];
const TIMEZONE_OPTIONS = ['UTC', 'IST (UTC+5:30)', 'EST (UTC-5)', 'PST (UTC-8)', 'CET (UTC+1)', 'SGT (UTC+8)', 'AEST (UTC+10)'];
const DATE_FORMAT_OPTIONS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
const CURRENCY_OPTIONS = ['USD ($)', 'INR (₹)', 'EUR (€)', 'GBP (£)', 'SGD (S$)'];

function SectionCard({ title, subtitle, children }) {
  return (
    <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      <div style={{ padding: '20px' }}>{children}</div>
    </div>
  );
}

function SaveBar({ onSave, saved }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
      {saved && <span style={{ fontSize: 12, color: 'var(--green)', alignSelf: 'center' }}>✓ Saved</span>}
      <button className="btn btn-primary" onClick={onSave}>Save Changes</button>
    </div>
  );
}

export default function SettingsPage({ user, onLogout, onUpdateUser }) {
  const [tab, setTab] = useState('profile');
  const [saved, setSaved] = useState({});
  const [teamMembers, setTeamMembers] = useState(TEAM_MEMBERS);
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({ name: '', email: '', role: 'View Only' });

  // Profile form
  const [profile, setProfile] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    phone: '',
    bio: '',
  });

  // Platform settings
  const [platform, setPlatform] = useState({
    timezone: 'IST (UTC+5:30)',
    dateFormat: 'DD/MM/YYYY',
    currency: 'USD ($)',
    companyName: 'TechnoElevate',
    staleThresholdDays: 3,
    benchAlertDays: 7,
  });

  // Notifications
  const [notifs, setNotifs] = useState({
    emailAlerts: true, pushAlerts: true, stalledReqs: true,
    expiringSOW: true, benchIdle: true, invoiceOverdue: true,
    weeklyDigest: true, dailyStandup: false,
  });

  // Security
  const [security, setSecurity] = useState({ currentPwd: '', newPwd: '', confirmPwd: '' });
  const [pwdError, setPwdError] = useState('');

  // Load persisted settings on mount
  useEffect(() => {
    apiFetch('/api/auth/settings')
      .then(r => r?.json())
      .then(s => {
        if (!s) return;
        setProfile(p => ({ ...p, phone: s.phone || '', bio: s.bio || '' }));
        setPlatform({
          timezone: s.timezone || 'IST (UTC+5:30)',
          dateFormat: s.date_format || 'DD/MM/YYYY',
          currency: s.currency || 'USD ($)',
          companyName: s.company_name || 'TechnoElevate',
          staleThresholdDays: s.stale_threshold_days ?? 3,
          benchAlertDays: s.bench_alert_days ?? 7,
        });
        setNotifs({
          stalledReqs: s.notif_stalled_reqs ?? true,
          expiringSOW: s.notif_expiring_sow ?? true,
          benchIdle: s.notif_bench_idle ?? true,
          invoiceOverdue: s.notif_invoice_overdue ?? true,
          emailAlerts: s.notif_email_alerts ?? true,
          pushAlerts: s.notif_push_alerts ?? true,
          weeklyDigest: s.notif_weekly_digest ?? true,
          dailyStandup: s.notif_daily_standup ?? false,
        });
      })
      .catch(() => {});
  }, []);

  const persistSettings = async (extra = {}) => {
    await apiFetch('/api/auth/settings', {
      method: 'PUT',
      body: JSON.stringify({
        phone: profile.phone, bio: profile.bio,
        timezone: platform.timezone, date_format: platform.dateFormat,
        currency: platform.currency, company_name: platform.companyName,
        stale_threshold_days: platform.staleThresholdDays,
        bench_alert_days: platform.benchAlertDays,
        notif_stalled_reqs: notifs.stalledReqs, notif_expiring_sow: notifs.expiringSOW,
        notif_bench_idle: notifs.benchIdle, notif_invoice_overdue: notifs.invoiceOverdue,
        notif_email_alerts: notifs.emailAlerts, notif_push_alerts: notifs.pushAlerts,
        notif_weekly_digest: notifs.weeklyDigest, notif_daily_standup: notifs.dailyStandup,
        ...extra,
      }),
    });
  };

  const save = async (key) => {
    try {
      if (key === 'profile') {
        await apiFetch('/api/auth/profile', {
          method: 'PUT',
          body: JSON.stringify({ name: profile.name, role: profile.role }),
        });
        await persistSettings({ phone: profile.phone, bio: profile.bio });
        onUpdateUser?.({ ...user, name: profile.name, role: profile.role });
      } else {
        await persistSettings();
      }
      setSaved(s => ({ ...s, [key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [key]: false })), 2500);
    } catch {
      alert('Save failed — please try again');
    }
  };

  const savePassword = async () => {
    if (!security.currentPwd) return setPwdError('Enter your current password');
    if (security.newPwd.length < 6) return setPwdError('New password must be at least 6 characters');
    if (security.newPwd !== security.confirmPwd) return setPwdError('Passwords do not match');
    setPwdError('');
    try {
      const res = await apiFetch('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ current_password: security.currentPwd, new_password: security.newPwd }),
      });
      const data = await res.json();
      if (!res.ok) return setPwdError(data.error || 'Failed to change password');
      setSecurity({ currentPwd: '', newPwd: '', confirmPwd: '' });
      setSaved(s => ({ ...s, security: true }));
      setTimeout(() => setSaved(s => ({ ...s, security: false })), 2500);
    } catch {
      setPwdError('Could not reach server');
    }
  };

  const addMember = () => {
    if (!invite.name || !invite.email) return;
    setTeamMembers(prev => [...prev, {
      id: Date.now(), ...invite, status: 'active',
      initials: invite.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
      color: 'linear-gradient(135deg,#4f7cff,#2ed573)',
    }]);
    setInvite({ name: '', email: '', role: 'View Only' });
    setShowInvite(false);
  };

  const removeMember = (id) => setTeamMembers(prev => prev.filter(m => m.id !== id));
  const toggleMember = (id) => setTeamMembers(prev => prev.map(m => m.id === id ? { ...m, status: m.status === 'active' ? 'inactive' : 'active' } : m));

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px' }}>Settings</h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>Manage your account, team, and platform preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left nav */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', position: 'sticky', top: 80 }}>
          {SETTING_TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: 'flex', flexDirection: 'column', width: '100%', padding: '11px 14px',
              background: tab === t.key ? 'var(--bg-hover)' : 'transparent',
              border: 'none', borderLeft: tab === t.key ? '2px solid var(--accent-blue)' : '2px solid transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 13, fontWeight: tab === t.key ? 600 : 400 }}>{t.label}</span>
            </button>
          ))}
          {/* Logout */}
          <button onClick={onLogout} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 14px',
            background: 'transparent', border: 'none', borderTop: '1px solid var(--border)',
            color: 'var(--red)', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--red-dim)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ⏏ Sign Out
          </button>
        </div>

        {/* Right panel */}
        <div>
          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <>
              <SectionCard title="Profile Information" subtitle="Update your name, role, and contact details">
                {/* Avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: '50%', background: user?.color || 'linear-gradient(135deg, #4f7cff, #a55eea)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff',
                    flexShrink: 0, boxShadow: '0 4px 16px rgba(79,124,255,0.3)',
                  }}>{user?.initials || 'SK'}</div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{profile.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{profile.role}</div>
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, fontSize: 11 }}>Change Avatar</button>
                  </div>
                </div>

                <Row>
                  <Field label="Full Name"><Input value={profile.name} onChange={v => setProfile(p => ({ ...p, name: v }))} /></Field>
                  <Field label="Role / Title"><Input value={profile.role} onChange={v => setProfile(p => ({ ...p, role: v }))} /></Field>
                </Row>
                <Row>
                  <Field label="Email Address"><Input type="email" value={profile.email} onChange={v => setProfile(p => ({ ...p, email: v }))} /></Field>
                  <Field label="Phone"><Input value={profile.phone} onChange={v => setProfile(p => ({ ...p, phone: v }))} /></Field>
                </Row>
                <Field label="Bio">
                  <Textarea value={profile.bio} onChange={v => setProfile(p => ({ ...p, bio: v }))} rows={2} placeholder="Short description about yourself…" />
                </Field>
                <SaveBar onSave={() => save('profile')} saved={saved.profile} />
              </SectionCard>
            </>
          )}

          {/* ── TEAM ── */}
          {tab === 'team' && (
            <>
              <SectionCard title="Team Members" subtitle="Manage who has access to this platform">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
                  <button className="btn btn-primary" onClick={() => setShowInvite(!showInvite)}>+ Invite Member</button>
                </div>

                {showInvite && (
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-blue)', borderRadius: 8, padding: '16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 12 }}>Invite New Member</div>
                    <Row>
                      <Field label="Name"><Input value={invite.name} onChange={v => setInvite(i => ({ ...i, name: v }))} placeholder="Full Name" /></Field>
                      <Field label="Email"><Input type="email" value={invite.email} onChange={v => setInvite(i => ({ ...i, email: v }))} placeholder="email@company.com" /></Field>
                    </Row>
                    <Row>
                      <Field label="Role"><Select value={invite.role} onChange={v => setInvite(i => ({ ...i, role: v }))} options={ROLE_OPTIONS} /></Field>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, paddingBottom: 14 }}>
                        <button className="btn btn-primary" onClick={addMember} style={{ flex: 1 }}>Send Invite</button>
                        <button className="btn btn-ghost" onClick={() => setShowInvite(false)}>Cancel</button>
                      </div>
                    </Row>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {teamMembers.map(m => (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                      opacity: m.status === 'inactive' ? 0.55 : 1,
                    }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{m.initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.email}</div>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-hover)', padding: '3px 8px', borderRadius: 4 }}>{m.role}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: m.status === 'active' ? 'var(--green)' : 'var(--text-muted)', padding: '2px 7px', borderRadius: 20, background: m.status === 'active' ? 'var(--green-dim)' : 'var(--bg-hover)' }}>
                        {m.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => toggleMember(m.id)} className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}>
                          {m.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => removeMember(m.id)} className="btn btn-sm" style={{ fontSize: 10, background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 5, padding: '3px 9px', cursor: 'pointer' }}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </>
          )}

          {/* ── NOTIFICATIONS ── */}
          {tab === 'notifications' && (
            <>
              <SectionCard title="Alert Preferences" subtitle="Choose which events trigger notifications">
                {[
                  { key: 'stalledReqs',    label: 'Stalled Requirements', desc: 'Alert when a requirement sits in a stage too long' },
                  { key: 'expiringSOW',    label: 'Expiring SOWs', desc: 'Alert 7 days before a contract expires' },
                  { key: 'benchIdle',      label: 'Bench Idle Alerts', desc: 'Alert when talent is idle beyond threshold' },
                  { key: 'invoiceOverdue', label: 'Invoice Overdue', desc: 'Alert when an invoice is past due date' },
                ].map(n => (
                  <div key={n.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <div onClick={() => setNotifs(prev => ({ ...prev, [n.key]: !prev[n.key] }))} style={{
                      width: 42, height: 22, borderRadius: 11,
                      background: notifs[n.key] ? 'var(--accent-blue)' : 'var(--bg-hover)',
                      border: '1px solid var(--border-light)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}>
                      <div style={{ position: 'absolute', top: 3, left: notifs[n.key] ? 21 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    </div>
                  </div>
                ))}
              </SectionCard>

              <SectionCard title="Delivery Channels" subtitle="How you receive notifications">
                {[
                  { key: 'emailAlerts', label: 'Email Alerts', desc: 'Receive alerts via email' },
                  { key: 'pushAlerts', label: 'In-App Notifications', desc: 'Show notifications inside the platform' },
                  { key: 'weeklyDigest', label: 'Weekly Digest Email', desc: 'Receive a weekly summary every Monday' },
                  { key: 'dailyStandup', label: 'Daily Standup Email', desc: 'Auto-email the daily standup report at 9am' },
                ].map(n => (
                  <div key={n.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{n.desc}</div>
                    </div>
                    <div onClick={() => setNotifs(prev => ({ ...prev, [n.key]: !prev[n.key] }))} style={{
                      width: 42, height: 22, borderRadius: 11,
                      background: notifs[n.key] ? 'var(--accent-blue)' : 'var(--bg-hover)',
                      border: '1px solid var(--border-light)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                    }}>
                      <div style={{ position: 'absolute', top: 3, left: notifs[n.key] ? 21 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    </div>
                  </div>
                ))}
                <SaveBar onSave={() => save('notifications')} saved={saved.notifications} />
              </SectionCard>
            </>
          )}

          {/* ── PLATFORM ── */}
          {tab === 'platform' && (
            <>
              <SectionCard title="Theme" subtitle="Choose how the platform looks">
                <ThemePicker />
              </SectionCard>

              <SectionCard title="Company Settings" subtitle="Basic company and display preferences">
                <Field label="Company Name"><Input value={platform.companyName} onChange={v => setPlatform(p => ({ ...p, companyName: v }))} /></Field>
                <Row>
                  <Field label="Timezone"><Select value={platform.timezone} onChange={v => setPlatform(p => ({ ...p, timezone: v }))} options={TIMEZONE_OPTIONS} /></Field>
                  <Field label="Date Format"><Select value={platform.dateFormat} onChange={v => setPlatform(p => ({ ...p, dateFormat: v }))} options={DATE_FORMAT_OPTIONS} /></Field>
                </Row>
                <Field label="Default Currency"><Select value={platform.currency} onChange={v => setPlatform(p => ({ ...p, currency: v }))} options={CURRENCY_OPTIONS} /></Field>
              </SectionCard>

              <SectionCard title="Attention Engine Rules" subtitle="Configure when issues are escalated">
                <Row>
                  <Field label="Stale Requirement Threshold (days)">
                    <Input type="number" value={platform.staleThresholdDays} onChange={v => setPlatform(p => ({ ...p, staleThresholdDays: v }))} />
                  </Field>
                  <Field label="Bench Idle Alert Threshold (days)">
                    <Input type="number" value={platform.benchAlertDays} onChange={v => setPlatform(p => ({ ...p, benchAlertDays: v }))} />
                  </Field>
                </Row>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: '8px 10px', background: 'var(--bg-hover)', borderRadius: 6, marginBottom: 14 }}>
                  💡 Requirements with no movement beyond <strong style={{ color: 'var(--amber)' }}>{platform.staleThresholdDays} days</strong> are marked stalled. Talent idle beyond <strong style={{ color: 'var(--amber)' }}>{platform.benchAlertDays} days</strong> triggers a bench alert.
                </div>
                <SaveBar onSave={() => save('platform')} saved={saved.platform} />
              </SectionCard>
            </>
          )}

          {/* ── SECURITY ── */}
          {tab === 'security' && (
            <>
              <SectionCard title="Change Password" subtitle="Update your login password">
                <Field label="Current Password"><Input type="password" value={security.currentPwd} onChange={v => setSecurity(s => ({ ...s, currentPwd: v }))} placeholder="••••••••" /></Field>
                <Row>
                  <Field label="New Password"><Input type="password" value={security.newPwd} onChange={v => setSecurity(s => ({ ...s, newPwd: v }))} placeholder="Min 6 characters" /></Field>
                  <Field label="Confirm New Password"><Input type="password" value={security.confirmPwd} onChange={v => setSecurity(s => ({ ...s, confirmPwd: v }))} placeholder="Repeat password" /></Field>
                </Row>
                {pwdError && <div style={{ fontSize: 12, color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid rgba(255,71,87,0.3)', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>⚠ {pwdError}</div>}
                <SaveBar onSave={savePassword} saved={saved.security} />
              </SectionCard>

              <SectionCard title="Active Sessions" subtitle="Devices currently logged in to your account">
                {[
                  { device: 'Windows 10 · Chrome', location: 'Mumbai, IN', time: 'Now (current)', current: true },
                  { device: 'MacBook Pro · Safari', location: 'Bengaluru, IN', time: '2 hours ago', current: false },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 22 }}>{s.device.includes('Windows') ? '🖥' : '💻'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{s.device}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.location} · {s.time}</div>
                    </div>
                    {s.current
                      ? <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)', background: 'var(--green-dim)', padding: '2px 8px', borderRadius: 10 }}>Current</span>
                      : <button className="btn btn-red btn-sm" style={{ fontSize: 10 }}>Revoke</button>}
                  </div>
                ))}
              </SectionCard>
            </>
          )}

          {/* ── INTEGRATIONS ── */}
          {tab === 'integrations' && (
            <>
              <SectionCard title="Connected Tools" subtitle="Manage integrations with third-party platforms">
                {[
                  { name: 'Slack', icon: '💬', desc: 'Push attention alerts and daily standup to a Slack channel', connected: true, channel: '#ops-alerts' },
                  { name: 'JIRA', icon: '📌', desc: 'Sync requirements and project issues with JIRA boards', connected: false },
                  { name: 'Google Sheets', icon: '📊', desc: 'Export talent pipeline data to Google Sheets automatically', connected: false },
                  { name: 'QuickBooks', icon: '🧾', desc: 'Sync invoice and contract data with QuickBooks Online', connected: true, channel: 'TechnoElevate Ops' },
                  { name: 'LinkedIn Recruiter', icon: '🔵', desc: 'Pull sourcing data and candidate profiles from LinkedIn', connected: false },
                  { name: 'Webhook / API', icon: '🔗', desc: 'Send events to any external URL via webhooks', connected: false },
                ].map(intg => (
                  <div key={intg.name} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 26, flexShrink: 0, width: 36, textAlign: 'center' }}>{intg.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {intg.name}
                        {intg.connected && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', background: 'var(--green-dim)', padding: '1px 6px', borderRadius: 10 }}>Connected</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{intg.desc}</div>
                      {intg.connected && intg.channel && <div style={{ fontSize: 10, color: 'var(--accent-blue)', marginTop: 3 }}>→ {intg.channel}</div>}
                    </div>
                    <button className={`btn btn-sm ${intg.connected ? 'btn-red' : 'btn-primary'}`} style={{ fontSize: 11, flexShrink: 0 }}>
                      {intg.connected ? 'Disconnect' : 'Connect'}
                    </button>
                  </div>
                ))}
              </SectionCard>

              <SectionCard title="API Access" subtitle="Manage API keys for external access">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 7, border: '1px solid var(--border)', marginBottom: 12 }}>
                  <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 12, color: 'var(--accent-blue)', letterSpacing: 1 }}>te_live_••••••••••••••••••••••••xxxx</div>
                  <button className="btn btn-ghost btn-sm">Copy</button>
                  <button className="btn btn-red btn-sm">Revoke</button>
                </div>
                <button className="btn btn-primary btn-sm">Generate New API Key</button>
              </SectionCard>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
