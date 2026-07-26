const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });
  const data = await res.json();
  if (data.success && data.token) {
    localStorage.setItem('auth_token', data.token);
  }
  return data;
}

export async function checkAuth() {
  const res = await fetch(`${API_BASE}/auth-status`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function getDashboards() {
  const res = await fetch(`${API_BASE}/dashboards`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function getEmbedInfo(reportNum = 1) {
  const res = await fetch(`${API_BASE}/embed-info?report=${reportNum}`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  if (res.status === 401) throw new Error('Unauthorized');
  return res.json();
}

export async function logout() {
  localStorage.removeItem('auth_token');
  await fetch(`${API_BASE}/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: getAuthHeaders()
  });
}

export async function ssoLogin(accessToken) {
  const res = await fetch(`${API_BASE}/sso-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
    body: JSON.stringify({ accessToken })
  });
  const data = await res.json();
  if (data.success && data.token) {
    localStorage.setItem('auth_token', data.token);
  }
  return data;
}

// Admin API
export async function getAdminData() {
  const res = await fetch(`${API_BASE}/admin/data`, {
    credentials: 'include',
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function addSsoUser(email, name, reports) {
  const res = await fetch(`${API_BASE}/admin/sso-users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
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
    credentials: 'include',
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function addDashboard(name, reportId) {
  const res = await fetch(`${API_BASE}/admin/dashboards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
    body: JSON.stringify({ name, reportId })
  });
  return res.json();
}

export async function deleteDashboard(id) {
  const res = await fetch(`${API_BASE}/admin/dashboards/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: getAuthHeaders()
  });
  return res.json();
}
