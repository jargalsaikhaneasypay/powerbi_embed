const API_BASE = '/api';

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

export async function checkAuth() {
  const res = await fetch(`${API_BASE}/auth-status`, {
    credentials: 'include'
  });
  return res.json();
}

export async function getDashboards() {
  const res = await fetch(`${API_BASE}/dashboards`, {
    credentials: 'include'
  });
  return res.json();
}

export async function getEmbedInfo(reportNum = 1) {
  const res = await fetch(`${API_BASE}/embed-info?report=${reportNum}`, {
    credentials: 'include'
  });
  if (res.status === 401) throw new Error('Unauthorized');
  return res.json();
}

export async function logout() {
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include'
  });
}

export async function ssoLogin(accessToken) {
  const res = await fetch(`${API_BASE}/sso-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ accessToken })
  });
  return res.json();
}

// Admin API
export async function getAdminData() {
  const res = await fetch(`${API_BASE}/admin/data`, { credentials: 'include' });
  return res.json();
}

export async function addSsoUser(email, name, reports) {
  const res = await fetch(`${API_BASE}/admin/sso-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, name, reports })
  });
  return res.json();
}

export async function updateSsoUser(email, name, reports) {
  return addSsoUser(email, name, reports);
}

export async function deleteSsoUser(email) {
  const res = await fetch(`${API_BASE}/admin/sso-users/${encodeURIComponent(email)}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return res.json();
}

export async function addDashboard(name, reportId) {
  const res = await fetch(`${API_BASE}/admin/dashboards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, reportId })
  });
  return res.json();
}

export async function deleteDashboard(id) {
  const res = await fetch(`${API_BASE}/admin/dashboards/${id}`, {
    method: 'DELETE',
    credentials: 'include'
  });
  return res.json();
}
