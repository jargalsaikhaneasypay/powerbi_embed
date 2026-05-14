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
