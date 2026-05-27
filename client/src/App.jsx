import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { checkAuth, logout as apiLogout } from './api';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

export default function App() {
  const [auth, setAuth] = useState({ checked: false, authenticated: false, name: '', allowedReports: [] });
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth().then(data => {
      setAuth({
        checked: true,
        authenticated: data.authenticated,
        name: data.name || '',
        allowedReports: data.allowedReports || []
      });
    }).catch(() => {
      setAuth({ checked: true, authenticated: false, name: '', allowedReports: [] });
    });
  }, []);

  const handleLogin = (name, allowedReports) => {
    setAuth({ checked: true, authenticated: true, name, allowedReports: allowedReports || [] });
    navigate('/dashboard');
  };

  const handleMicrosoftLogin = () => {
    const popup = window.open('/api/auth/microsoft', 'microsoft-sso', 'width=500,height=650,left=400,top=100');

    const onMessage = async (event) => {
      if (event.data?.type === 'sso_success') {
        window.removeEventListener('message', onMessage);
        if (popup && !popup.closed) popup.close();
        const data = await checkAuth();
        if (data.authenticated) {
          setAuth({ checked: true, authenticated: true, name: data.name, allowedReports: data.allowedReports || [] });
          navigate('/dashboard');
        }
      } else if (event.data?.type === 'sso_error') {
        window.removeEventListener('message', onMessage);
        if (popup && !popup.closed) popup.close();
      }
    };

    window.addEventListener('message', onMessage);
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
