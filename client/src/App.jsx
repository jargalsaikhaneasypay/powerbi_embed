import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { checkAuth, logout as apiLogout, ssoLogin } from './api';
import { msalInstance, loginScopes } from './msalConfig';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

async function tryAzureSSO() {
  await msalInstance.initialize();
  await msalInstance.handleRedirectPromise();

  const accounts = msalInstance.getAllAccounts();
  const silentRequest = {
    scopes: loginScopes,
    account: accounts[0] || undefined,
  };

  try {
    const result = accounts.length > 0
      ? await msalInstance.acquireTokenSilent(silentRequest)
      : await msalInstance.ssoSilent(silentRequest);
    return result.accessToken;
  } catch {
    return null;
  }
}

export default function App() {
  const [auth, setAuth] = useState({ checked: false, authenticated: false, name: '', allowedReports: [] });
  const navigate = useNavigate();

  useEffect(() => {
    async function initAuth() {
      // 1. Check existing JWT cookie first
      try {
        const data = await checkAuth();
        if (data.authenticated) {
          setAuth({ checked: true, authenticated: true, name: data.name, allowedReports: data.allowedReports || [] });
          return;
        }
      } catch {}

      // 2. Try Azure AD SSO silently
      try {
        const accessToken = await tryAzureSSO();
        if (accessToken) {
          const data = await ssoLogin(accessToken);
          if (data.success) {
            setAuth({ checked: true, authenticated: true, name: data.name, allowedReports: data.allowedReports || [] });
            navigate('/dashboard');
            return;
          }
        }
      } catch {}

      // 3. Fall back to login page
      setAuth({ checked: true, authenticated: false, name: '', allowedReports: [] });
    }

    initAuth();
  }, []);

  const handleLogin = (name, allowedReports) => {
    setAuth({ checked: true, authenticated: true, name, allowedReports: allowedReports || [] });
    navigate('/dashboard');
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
            : <LoginPage onLogin={handleLogin} />
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
