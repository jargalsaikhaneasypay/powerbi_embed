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
