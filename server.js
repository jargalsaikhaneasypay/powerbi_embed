const express = require('express');
const axios = require('axios');
const msal = require('@azure/msal-node');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');
const fs = require('fs');

// =============================================
// SQLite Setup
// =============================================
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

console.log('🚀 Starting server...');
const db = new Database(path.join(DATA_DIR, 'dashboard.db'));
db.pragma('journal_mode = WAL');

function parseReports(str) {
  try { return JSON.parse(str || '[]'); } catch { return []; }
}

function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      report_id TEXT NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sso_users (
      email   TEXT PRIMARY KEY,
      name    TEXT NOT NULL,
      reports TEXT NOT NULL DEFAULT '[]'
    )
  `);

  const dbCount = db.prepare('SELECT COUNT(*) AS count FROM dashboards').get();
  if (dbCount.count === 0) {
    const ins = db.prepare('INSERT INTO dashboards (name, report_id) VALUES (?, ?)');
    ins.run('Dashboard 1', '2f3ed948-726c-45f4-9701-f773445e29d4');
    ins.run('Dashboard 2', '59b65d18-7735-4bcc-a4e6-35ce557aeb43');
    ins.run('Dashboard 3', 'df629503-90e7-4546-8700-2d445e39f673');
    ins.run('Dashboard 4', '61a6e8ff-f8ba-4bb7-8b8b-25a520b60f4b');
    console.log('✅ Seeded initial dashboards');
  }

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM sso_users').get();
  if (userCount.count === 0) {
    const ins = db.prepare('INSERT INTO sso_users (email, name, reports) VALUES (?, ?, ?)');
    ins.run('jargalsaikhan@easypay.mn', 'Jargalsaikhan', JSON.stringify([1, 2, 3]));
    ins.run('bolor-erdene@easypay.mn',  'Bolor-Erdene',  JSON.stringify([1, 2, 3]));
    ins.run('naranbaatar@easypay.mn',   'Naranbaatar',   JSON.stringify([1, 2, 3]));
    ins.run('zolzaya@easypay.mn',       'Zolzaya',       JSON.stringify([2]));
    ins.run('ganbold@easypay.mn',       'Ganbold',       JSON.stringify([2]));
    console.log('✅ Seeded initial SSO users');
  }

  console.log('✅ Database ready');
}

// =============================================
// Express Setup
// =============================================
const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const isProduction = !!process.env.PORT;

const ALLOWED_ORIGINS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
  /^https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
  /^https:\/\/.*\.onrender\.com$/,
  /^https:\/\/.*\.trycloudflare\.com$/,
  /^https:\/\/.*\.cloudflareaccess\.com$/,
  /^https?:\/\/.*\.easypay\.mn$/,
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.some(re => re.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

const CONFIG = {
  CLIENT_ID: 'da995cce-e2d6-4064-92bd-a6c90a9da6fd',
  TENANT_ID: 'c7c2eb81-57fd-4e38-bec1-d91a88228111',
  CLIENT_SECRET: process.env.CLIENT_SECRET || '~Hy8Q~-g~8Rwq108VQOIalybLVhtGUkjV~Y6QbFv',
  WORKSPACE_ID: 'd4c47192-dd35-4291-bf95-ad16bce5e0b2',
  JWT_SECRET: process.env.JWT_SECRET || 'easypay-jwt-secret-2026',

  USERS: {
    'Admin':       { password: 'Easypay321',     name: 'Admin',       reports: 'all' },
    'EasypayAll':  { password: 'easypay2026',    name: 'EasypayAll',  reports: [1] },
    'Easypay':     { password: 'Easypay123',     name: 'Easypay',     reports: [2] },
    'EasypayShts': { password: 'EasypayShts123', name: 'EasypayShts', reports: [3] },
  },

  PORT: process.env.PORT || 3001
};

// =============================================
// MSAL Setup
// =============================================
const msalClient = new msal.ConfidentialClientApplication({
  auth: {
    clientId: CONFIG.CLIENT_ID,
    authority: `https://login.microsoftonline.com/${CONFIG.TENANT_ID}`,
    clientSecret: CONFIG.CLIENT_SECRET
  }
});

// =============================================
// Get Embed Token
// =============================================
async function getEmbedInfo(reportNum) {
  const row = db.prepare('SELECT * FROM dashboards WHERE id = ?').get(reportNum);
  if (!row) throw new Error(`Dashboard ${reportNum} not found`);
  const reportId = row.report_id;

  const authResult = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://analysis.windows.net/powerbi/api/.default']
  });

  if (!authResult?.accessToken) throw new Error('MSAL returned no access token');

  const headers = { Authorization: `Bearer ${authResult.accessToken}` };

  const reportRes = await axios.get(
    `https://api.powerbi.com/v1.0/myorg/groups/${CONFIG.WORKSPACE_ID}/reports/${reportId}`,
    { headers }
  ).catch(err => {
    console.error('❌ GET report failed:', JSON.stringify(err.response?.data, null, 2));
    throw err;
  });

  const embedTokenRes = await axios.post(
    `https://api.powerbi.com/v1.0/myorg/groups/${CONFIG.WORKSPACE_ID}/reports/${reportId}/GenerateToken`,
    { accessLevel: 'View', allowSaveAs: false },
    { headers }
  ).catch(err => {
    console.error('❌ GenerateToken failed:', JSON.stringify(err.response?.data, null, 2));
    throw err;
  });

  return {
    reportId: reportRes.data.id,
    reportName: reportRes.data.name,
    embedUrl: reportRes.data.embedUrl,
    embedToken: embedTokenRes.data.token,
    tokenExpiry: embedTokenRes.data.expiration
  };
}

// =============================================
// Auth Middleware
// =============================================
function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, CONFIG.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Not authenticated' });
  }
}

function requireAdmin(req, res, next) {
  const token = getTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const user = jwt.verify(token, CONFIG.JWT_SECRET);
    if (user.username !== 'Admin') return res.status(403).json({ error: 'Admin only' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Not authenticated' });
  }
}

function setAuthCookie(res, payload) {
  const token = jwt.sign(payload, CONFIG.JWT_SECRET, { expiresIn: '8h' });
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 8 * 60 * 60 * 1000
  });
  return token;
}

function getTokenFromRequest(req) {
  if (req.cookies?.auth_token) return req.cookies.auth_token;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

// =============================================
// API Routes
// =============================================

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = CONFIG.USERS[username];
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  const isHashed = user.password.startsWith('$2b$') || user.password.startsWith('$2a$');
  const valid = isHashed ? await bcrypt.compare(password, user.password) : password === user.password;

  if (valid) {
    let reports;
    if (user.reports === 'all') {
      reports = db.prepare('SELECT id FROM dashboards ORDER BY id').all().map(r => r.id);
    } else {
      reports = user.reports;
    }
    const token = setAuthCookie(res, { username, name: user.name, allowedReports: reports });
    return res.json({ success: true, name: user.name, allowedReports: reports, token });
  }
  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

app.get('/api/auth-status', (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) return res.json({ authenticated: false });
  try {
    const user = jwt.verify(token, CONFIG.JWT_SECRET);
    return res.json({ authenticated: true, name: user.name, allowedReports: user.allowedReports });
  } catch {
    return res.json({ authenticated: false });
  }
});

app.get('/api/dashboards', requireAuth, (req, res) => {
  const allowed = req.user.allowedReports || [];
  if (!allowed.length) return res.json({ success: true, dashboards: [] });
  const placeholders = allowed.map(() => '?').join(',');
  const rows = db.prepare(`SELECT id, name FROM dashboards WHERE id IN (${placeholders}) ORDER BY id`).all(allowed);
  res.json({ success: true, dashboards: rows });
});

app.get('/api/embed-info', requireAuth, async (req, res) => {
  try {
    const reportNum = parseInt(req.query.report) || 1;
    const allowed = req.user.allowedReports || [];
    if (!allowed.includes(reportNum)) {
      return res.status(403).json({ success: false, error: 'Access denied to this dashboard' });
    }
    const embedInfo = await getEmbedInfo(reportNum);
    res.json({ success: true, ...embedInfo, user: req.user.name });
  } catch (error) {
    console.error('Embed error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message
    });
  }
});

// =============================================
// Admin API Routes
// =============================================

app.get('/api/admin/data', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT * FROM sso_users ORDER BY email').all();
  const dashboards = db.prepare('SELECT * FROM dashboards ORDER BY id').all();

  const ssoUsers = {};
  users.forEach(r => { ssoUsers[r.email] = { name: r.name, reports: parseReports(r.reports) }; });
  const dashboardsList = dashboards.map(r => ({ id: r.id, name: r.name, reportId: r.report_id }));

  res.json({ success: true, ssoUsers, dashboards: dashboardsList });
});

app.post('/api/admin/sso-users', requireAdmin, (req, res) => {
  const { email, name, reports } = req.body;
  if (!email || !name || !Array.isArray(reports)) {
    return res.status(400).json({ success: false, error: 'email, name, and reports[] are required' });
  }
  db.prepare(`
    INSERT INTO sso_users (email, name, reports) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET name = excluded.name, reports = excluded.reports
  `).run(email.toLowerCase().trim(), name.trim(), JSON.stringify(reports));
  res.json({ success: true });
});

app.delete('/api/admin/sso-users/:email', requireAdmin, (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase();
  const info = db.prepare('DELETE FROM sso_users WHERE email = ?').run(email);
  if (!info.changes) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true });
});

app.post('/api/admin/dashboards', requireAdmin, (req, res) => {
  const { name, reportId } = req.body;
  if (!name || !reportId) {
    return res.status(400).json({ success: false, error: 'name and reportId are required' });
  }
  const info = db.prepare('INSERT INTO dashboards (name, report_id) VALUES (?, ?)').run(name.trim(), reportId.trim());
  res.json({ success: true, dashboard: { id: info.lastInsertRowid, name: name.trim(), reportId: reportId.trim() } });
});

app.delete('/api/admin/dashboards/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const info = db.prepare('DELETE FROM dashboards WHERE id = ?').run(id);
  if (!info.changes) return res.status(404).json({ success: false, error: 'Dashboard not found' });
  const users = db.prepare('SELECT email, reports FROM sso_users').all();
  const update = db.prepare('UPDATE sso_users SET reports = ? WHERE email = ?');
  for (const user of users) {
    const updated = parseReports(user.reports).filter(r => r !== id);
    update.run(JSON.stringify(updated), user.email);
  }
  res.json({ success: true });
});

// =============================================
// Azure AD SSO Routes
// =============================================

app.get('/api/auth/microsoft', async (req, res) => {
  try {
    const redirectUri = process.env.REDIRECT_URI || `http://localhost:${CONFIG.PORT}/api/auth/callback`;
    const authCodeUrl = await msalClient.getAuthCodeUrl({ scopes: ['User.Read'], redirectUri });
    res.redirect(authCodeUrl);
  } catch (err) {
    console.error('Auth URL error:', err.message);
    res.status(500).send('Authentication error');
  }
});

app.get('/api/auth/callback', async (req, res) => {
  const redirectUri = process.env.REDIRECT_URI || `http://localhost:${CONFIG.PORT}/api/auth/callback`;
  try {
    const tokenResponse = await msalClient.acquireTokenByCode({
      code: req.query.code,
      scopes: ['User.Read'],
      redirectUri,
    });

    const email = (tokenResponse.account.username || '').toLowerCase();
    const row = db.prepare('SELECT * FROM sso_users WHERE email = ?').get(email);

    if (!row) {
      return res.send(`<html><body><script>
        if (window.opener) { window.opener.postMessage({ type: 'sso_error', reason: 'not_authorized' }, '*'); }
        window.close();
      </script></body></html>`);
    }

    const token = setAuthCookie(res, { username: email, name: row.name, allowedReports: parseReports(row.reports) });
    res.send(`<html><body><script>
      if (window.opener) { window.opener.postMessage({ type: 'sso_success', token: '${token}' }, '*'); }
      window.close();
    </script></body></html>`);
  } catch (err) {
    console.error('Auth callback error:', err.message);
    res.send(`<html><body><script>
      if (window.opener) { window.opener.postMessage({ type: 'sso_error', reason: 'auth_failed' }, '*'); }
      window.close();
    </script></body></html>`);
  }
});

app.post('/api/sso-login', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ success: false, error: 'No token provided' });

  try {
    const graphRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const email = (graphRes.data.userPrincipalName || graphRes.data.mail || '').toLowerCase();
    const row = db.prepare('SELECT * FROM sso_users WHERE email = ?').get(email);

    if (!row) {
      return res.status(403).json({ success: false, error: 'Access denied. User not authorized.' });
    }

    const reports = parseReports(row.reports);
    const token = setAuthCookie(res, { username: email, name: row.name, allowedReports: reports });
    return res.json({ success: true, name: row.name, allowedReports: reports, token });
  } catch (err) {
    console.error('SSO login error:', err.response?.data || err.message);
    return res.status(401).json({ success: false, error: 'Invalid Azure AD token' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });
  res.json({ success: true });
});

// =============================================
// APEX Embed Endpoint (API key auth)
// =============================================
const APEX_API_KEY = process.env.APEX_API_KEY || 'easypay-apex-2026';

app.get('/api/apex-embed', async (req, res) => {
  const { apiKey, report } = req.query;
  if (apiKey !== APEX_API_KEY) {
    return res.status(401).json({ success: false, error: 'Invalid API key' });
  }
  try {
    const reportNum = parseInt(report) || 1;
    const embedInfo = await getEmbedInfo(reportNum);
    res.json({ success: true, ...embedInfo });
  } catch (error) {
    console.error('APEX embed error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve React build
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// =============================================
// Start
// =============================================
initDB();
app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`\n✅ Server running at http://localhost:${CONFIG.PORT}`);
  console.log(`   Database: SQLite at ${path.join(DATA_DIR, 'dashboard.db')}`);
});
