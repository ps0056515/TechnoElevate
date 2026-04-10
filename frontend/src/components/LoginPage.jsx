import React, { useState } from 'react';

const DEMO_USERS = [
  { email: 'sarah@techno.com', password: 'admin123', name: 'Sarah K.', role: 'Delivery Lead', initials: 'SK', color: 'linear-gradient(135deg, #4f7cff, #a55eea)' },
  { email: 'admin@techno.com', password: 'admin123', name: 'Admin User', role: 'Administrator', initials: 'AU', color: 'linear-gradient(135deg, #ff4757, #a55eea)' },
  { email: 'ops@techno.com',   password: 'ops123',   name: 'Ops Manager', role: 'Operations', initials: 'OM', color: 'linear-gradient(135deg, #2ed573, #4f7cff)' },
];

export default function LoginPage({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const inputBase = {
    width: '100%', background: '#1a1d32', border: '1px solid #252847',
    borderRadius: 8, padding: '11px 14px', color: '#e8eaf6',
    fontSize: 14, fontFamily: 'Inter, system-ui, sans-serif', outline: 'none',
    transition: 'border-color 0.15s', boxSizing: 'border-box',
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    const user = DEMO_USERS.find(u => u.email === email.toLowerCase().trim() && u.password === password);
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid email or password. Try sarah@techno.com / admin123');
    }
    setLoading(false);
  };

  const quickLogin = (user) => { setEmail(user.email); setPassword(user.password); };

  return (
    <div style={{
      minHeight: '100vh', background: '#0c0e18',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, system-ui, sans-serif', padding: 20,
      backgroundImage: 'radial-gradient(ellipse at 20% 50%, rgba(79,124,255,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(165,94,234,0.05) 0%, transparent 60%)',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'linear-gradient(135deg, #4f7cff, #a55eea)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 800, color: '#fff',
            margin: '0 auto 14px', boxShadow: '0 8px 32px rgba(79,124,255,0.3)',
          }}>TE</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#e8eaf6', marginBottom: 4 }}>TechnoElevate</div>
          <div style={{ fontSize: 13, color: '#555a8a', letterSpacing: 1.5, textTransform: 'uppercase' }}>Operations Platform</div>
        </div>

        {/* Card */}
        <div style={{
          background: '#13162a', border: '1px solid #252847',
          borderRadius: 14, padding: '32px 32px 28px',
          boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#e8eaf6', margin: '0 0 6px' }}>Sign in to your account</h2>
          <p style={{ fontSize: 13, color: '#555a8a', margin: '0 0 24px' }}>Enter your credentials to access the dashboard</p>

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#8b91c4', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
                Email Address
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@techno.com" required autoFocus
                style={inputBase}
                onFocus={e => e.target.style.borderColor = '#4f7cff'}
                onBlur={e => e.target.style.borderColor = '#252847'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#8b91c4', letterSpacing: 0.6, textTransform: 'uppercase' }}>Password</label>
                <span style={{ fontSize: 11, color: '#4f7cff', cursor: 'pointer' }}>Forgot password?</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ ...inputBase, paddingRight: 44 }}
                  onFocus={e => e.target.style.borderColor = '#4f7cff'}
                  onBlur={e => e.target.style.borderColor = '#252847'}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#555a8a', cursor: 'pointer', fontSize: 14, padding: 2,
                }}>
                  {showPass ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(255,71,87,0.1)', border: '1px solid rgba(255,71,87,0.3)',
                borderRadius: 7, padding: '10px 14px', marginBottom: 16,
                fontSize: 12, color: '#ff4757', lineHeight: 1.4,
              }}>
                ⚠ {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: 8, border: 'none',
              background: loading ? '#2a3d80' : 'linear-gradient(135deg, #4f7cff, #3d6aff)',
              color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', boxShadow: loading ? 'none' : '0 4px 16px rgba(79,124,255,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {loading ? (
                <><span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Signing in…</>
              ) : 'Sign In →'}
            </button>
          </form>
        </div>

        {/* Quick access demo */}
        <div style={{ marginTop: 20, background: '#13162a', border: '1px solid #252847', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#555a8a', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
            Quick Demo Access
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {DEMO_USERS.map(u => (
              <button key={u.email} onClick={() => quickLogin(u)} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'transparent', border: '1px solid #252847', borderRadius: 7,
                padding: '8px 10px', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = '#1a1d32'; e.currentTarget.style.borderColor = '#4f7cff'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#252847'; }}
              >
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{u.initials}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e8eaf6' }}>{u.name}</div>
                  <div style={{ fontSize: 10, color: '#555a8a' }}>{u.email}</div>
                </div>
                <span style={{ fontSize: 10, color: '#4f7cff' }}>Use →</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#2e3260' }}>
          TechnoElevate © 2026 · Operations Platform v1.0
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
