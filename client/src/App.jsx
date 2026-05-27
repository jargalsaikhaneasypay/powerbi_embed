import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { checkAuth, logout as apiLogout, ssoLogin } from './api';
import { msalInstance, loginScopes, triggerMicrosoftLogin } from './msalConfig';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

async function trySilentSSO() {
  const accounts = msalInstance.getAllAccounts();
  const request = { scopes: loginScopes, account: accounts[0] || undefined };

  if (accounts.length > 0) {
    try {
      const result = await msalInstance.acquireTokenSilent(request);
      return result.accessToken;
    } catch {}
  }

  try {
    const result = await msalInstance.ssoSilent(request);
    return result.accessToken;
  } catch {}

  return null;
}

export default function App() {
  const [auth, setAuth] = useState({ checked: false, authenticated: false, name: '', allowedReports: [] });
  const navigate = useNavigate();

  useEffect(() => {
    async function initAuth() {
      // 1. Check existing JWT cookie
      try {
        const data = await checkAuth();
        if (data.authenticated) {
          setAuth({ checked: true, authenticated: true, name: data.name, allowedReports: data.allowedReports || [] });
          return;
        }
      } catch {}

      // 2. Try Azure AD silent SSO
      try {
        const accessToken = await trySilentSSO();
        if (accessToken) {
          const data = await ssoLogin(accessToken);
          if (data.success) {
            setAuth({ checked: true, authenticated: true, name: data.name, allowedReports: data.allowedReports || [] });
            navigate('/dashboard');
            return;
          }
        }
      } catch {}

      // 3. Show login page with "Sign in with Microsoft" button
      setAuth({ checked: true, authenticated: false, name: '', allowedReports: [] });
    }

    initAuth();
  }, []);

  const handleLogin = (name, allowedReports) => {
    setAuth({ checked: true, authenticated: true, name, allowedReports: allowedReports || [] });
    navigate('/dashboard');
  };

  const handleMicrosoftLogin = async () => {
    try {
      const accessToken = await triggerMicrosoftLogin();
      const data = await ssoLogin(accessToken);
      if (data.success) {
        setAuth({ checked: true, authenticated: true, name: data.name, allowedReports: data.allowedReports || [] });
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Microsoft login failed:', err);
    }
  };

  const handleLogout = async () => {
    await apiLogout();
    setAuth({ checked: true, authenticated: false, name: '' });
    navigate('/');
  };

  if (!auth.checked) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--bg-primary)'
      }}>
        <div style={{
          width: 40,
          height: 40,
          border: '3px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite'
        }} />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          auth.authenticated
            ? <Navigate to="/dashboard" replace />
            : <LoginPage onLogin={handleLogin} onMicrosoftLogin={handleMicrosoftLogin} />
        }
      />
      <Route
        path="/dashboard"
        element={
          auth.authenticated
            ? <DashboardPage userName={auth.name} allowedReports={auth.allowedReports} onLogout={handleLogout} />
            : <Navigate to="/" replace />
        }
      />
    </Routes>
  );
}
