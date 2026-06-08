import React, { useState } from 'react';
import { login } from '../api';

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  bgOrb: {
    position: 'fixed',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    filter: 'blur(120px)',
    opacity: 0.5,
    animation: 'bgDrift 25s ease-in-out infinite',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    zIndex: 1,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '24px',
    padding: '56px 48px',
    width: '100%',
    maxWidth: '430px',
    boxShadow: '0 40px 80px rgba(0, 0, 0, 0.5)',
    animation: 'fadeIn 0.5s ease-out',
  },
  logoMark: {
    width: '56px',
    height: '56px',
    background: 'linear-gradient(135deg, var(--accent), #7c5bf5)',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    marginBottom: '32px',
    boxShadow: '0 12px 32px var(--accent-glow)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
    marginBottom: '6px',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '14px',
    fontWeight: 300,
    marginBottom: '40px',
  },
  formGroup: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--text-muted)',
    marginBottom: '10px',
    textTransform: 'uppercase',
    letterSpacing: '1.2px',
  },
  input: {
    width: '100%',
    padding: '15px 18px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    color: 'var(--text-primary)',
    fontSize: '15px',
    fontFamily: 'Outfit, sans-serif',
    outline: 'none',
    transition: 'all 0.25s ease',
  },
  button: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, var(--accent), #6366f1)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'Outfit, sans-serif',
    cursor: 'pointer',
    marginTop: '12px',
    transition: 'all 0.25s ease',
    letterSpacing: '0.3px',
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  error: {
    background: 'var(--danger-bg)',
    border: '1px solid rgba(232, 84, 84, 0.15)',
    color: 'var(--danger)',
    padding: '13px 18px',
    borderRadius: '12px',
    fontSize: '13px',
    marginBottom: '24px',
    animation: 'fadeIn 0.3s ease',
  },
};

export default function LoginPage({ onLogin, onMicrosoftLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inSharePoint = window.self !== window.top;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await login(username, password);
      if (data.success) {
        onLogin(data.name, data.allowedReports);
      } else {
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Server unavailable. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      {/* Background orbs */}
      <div style={{
        ...styles.bgOrb,
        top: '-200px',
        left: '-100px',
        background: 'radial-gradient(circle, rgba(79,125,245,0.08) 0%, transparent 70%)',
      }} />
      <div style={{
        ...styles.bgOrb,
        bottom: '-300px',
        right: '-200px',
        background: 'radial-gradient(circle, rgba(124,91,245,0.06) 0%, transparent 70%)',
        animationDelay: '-12s',
      }} />

      <div style={styles.card}>
        <div style={styles.logoMark}>📊</div>
        <h1 style={styles.title}>Management Dashboard</h1>
        <p style={styles.subtitle}>Sign in to access the embedded report</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoComplete="off"
              style={styles.input}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(79,125,245,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(79,125,245,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              autoComplete="new-password"
              style={styles.input}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(79,125,245,0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(79,125,245,0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.boxShadow = '0 8px 28px var(--accent-glow)';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.boxShadow = 'none';
              e.target.style.transform = 'translateY(0)';
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        {inSharePoint && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '24px 0 8px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>
            <button
              type="button"
              onClick={onMicrosoftLogin}
              style={{
                width: '100%', padding: '14px',
                background: '#fff', color: '#333',
                border: '1px solid var(--border)', borderRadius: '14px',
                fontSize: '14px', fontWeight: 600,
                fontFamily: 'Outfit, sans-serif', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#00a4ef"/>
                <rect x="1" y="11" width="9" height="9" fill="#7fba00"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              Sign in with Microsoft
            </button>
          </>
        )}
      </div>
    </div>
  );
}
