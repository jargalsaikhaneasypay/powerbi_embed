const express = require('express');
const axios = require('axios');
const msal = require('@azure/msal-node');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

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
// Dynamic Data — SSO Users + Dashboards
// Loaded from data.json; written back on changes.
// On Render: persists between restarts but resets
// to the committed data.json on each new deploy.
// =============================================
const DATA_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  ssoUsers: {},
  dashboards: [],
  nextDashboardId: 1
};

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load data.json, using empty defaults:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dynamicData, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to save data.json:', e.message);
  }
}

let dynamicData = loadData();

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
  const dashboard = dynamicData.dashboards.find(d => d.id === reportNum);
  if (!dashboard) throw new Error(`Dashboard ${reportNum} not found`);
  const reportId = dashboard.reportId;

  const authResult = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://analysis.windows.net/powerbi/api/.default']
  });

  if (!authResult?.accessToken) {
    throw new Error('MSAL returned no access token — check CLIENT_ID, TENANT_ID, CLIENT_SECRET');
  }
  console.log('✅ MSAL token acquired, expires:', authResult.expiresOn);

  const headers = { Authorization: `Bearer ${authResult.accessToken}` };

  const reportRes = await axios.get(
    `https://api.powerbi.com/v1.0/myorg/groups/${CONFIG.WORKSPACE_ID}/reports/${reportId}`,
    { headers }
  ).catch(err => {
    const detail = err.response?.data;
    console.error('❌ GET report failed:', JSON.stringify(detail, null, 2));
    throw err;
  });

  const embedTokenRes = await axios.post(
    `https://api.powerbi.com/v1.0/myorg/groups/${CONFIG.WORKSPACE_ID}/reports/${reportId}/GenerateToken`,
    { accessLevel: 'View', allowSaveAs: false },
    { headers }
  ).catch(err => {
    const detail = err.response?.data;
    console.error('❌ GenerateToken failed:', JSON.stringify(detail, null, 2));
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
  const token = req.cookies?.auth_token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, CONFIG.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Not authenticated' });
  }
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.auth_token;
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
}

// =============================================
// API Routes
// =============================================

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = CONFIG.USERS[username];
  if (!user) return res.status(401).json({ success: false, error: 'Invalid credentials' });

  const isHashed = user.password.startsWith('$2b$') || user.password.startsWith('$2a$');
  const valid = isHashed ? await bcrypt.compare(password, user.password) : password === user.password;

  if (valid) {
    // Admin always gets access to all current dashboards
    const reports = user.reports === 'all'
      ? dynamicData.dashboards.map(d => d.id)
      : user.reports;
    setAuthCookie(res, { username, name: user.name, allowedReports: reports });
    return res.json({ success: true, name: user.name, allowedReports: reports });
  }
  return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// Check auth status
app.get('/api/auth-status', (req, res) => {
  const token = req.cookies?.auth_token;
  if (!token) return res.json({ authenticated: false });
  try {
    const user = jwt.verify(token, CONFIG.JWT_SECRET);
    return res.json({ authenticated: true, name: user.name, allowedReports: user.allowedReports });
  } catch {
    return res.json({ authenticated: false });
  }
});

// Get dashboards list for authenticated user (id + name only, no reportId)
app.get('/api/dashboards', requireAuth, (req, res) => {
  const allowed = req.user.allowedReports || [];
  const dashboards = dynamicData.dashboards
    .filter(d => allowed.includes(d.id))
    .map(d => ({ id: d.id, name: d.name }));
  res.json({ success: true, dashboards });
});

// Get embed info (protected)
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
// Admin API Routes (Admin user only)
// =============================================

// Get all dynamic data
app.get('/api/admin/data', requireAdmin, (req, res) => {
  res.json({ success: true, ...dynamicData });
});

// Add or update SSO user
app.post('/api/admin/sso-users', requireAdmin, (req, res) => {
  const { email, name, reports } = req.body;
  if (!email || !name || !Array.isArray(reports)) {
    return res.status(400).json({ success: false, error: 'email, name, and reports[] are required' });
  }
  const key = email.toLowerCase().trim();
  dynamicData.ssoUsers[key] = { name: name.trim(), reports };
  saveData();
  res.json({ success: true });
});

// Delete SSO user
app.delete('/api/admin/sso-users/:email', requireAdmin, (req, res) => {
  const key = decodeURIComponent(req.params.email).toLowerCase();
  if (!dynamicData.ssoUsers[key]) {
    return res.status(404).json({ success: false, error: 'User not found' });
  }
  delete dynamicData.ssoUsers[key];
  saveData();
  res.json({ success: true });
});

// Add dashboard
app.post('/api/admin/dashboards', requireAdmin, (req, res) => {
  const { name, reportId } = req.body;
  if (!name || !reportId) {
    return res.status(400).json({ success: false, error: 'name and reportId are required' });
  }
  const newDashboard = {
    id: dynamicData.nextDashboardId,
    name: name.trim(),
    reportId: reportId.trim()
  };
  dynamicData.nextDashboardId += 1;
  dynamicData.dashboards.push(newDashboard);
  saveData();
  res.json({ success: true, dashboard: newDashboard });
});

// Delete dashboard
app.delete('/api/admin/dashboards/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id);
  const idx = dynamicData.dashboards.findIndex(d => d.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Dashboard not found' });
  }
  dynamicData.dashboards.splice(idx, 1);
  // Remove this dashboard from all SSO users' report lists
  for (const key of Object.keys(dynamicData.ssoUsers)) {
    dynamicData.ssoUsers[key].reports = dynamicData.ssoUsers[key].reports.filter(r => r !== id);
  }
  saveData();
  res.json({ success: true });
});

// =============================================
// Azure AD SSO Routes
// =============================================

// Redirect to Microsoft login
app.get('/api/auth/microsoft', async (req, res) => {
  try {
    const redirectUri = `https://powerbi-embed-455h.onrender.com/api/auth/callback`;
    const authCodeUrl = await msalClient.getAuthCodeUrl({
      scopes: ['User.Read'],
      redirectUri,
    });
    res.redirect(authCodeUrl);
  } catch (err) {
    console.error('Auth URL error:', err.message);
    res.status(500).send('Authentication error');
  }
});

// OAuth callback after Microsoft login
app.get('/api/auth/callback', async (req, res) => {
  const redirectUri = `https://powerbi-embed-455h.onrender.com/api/auth/callback`;
  try {
    const tokenResponse = await msalClient.acquireTokenByCode({
      code: req.query.code,
      scopes: ['User.Read'],
      redirectUri,
    });

    const email = (tokenResponse.account.username || '').toLowerCase();
    const userKey = Object.keys(dynamicData.ssoUsers).find(k => k.toLowerCase() === email);
    const user = userKey ? dynamicData.ssoUsers[userKey] : null;

    if (!user) {
      return res.send(`<html><body><script>
        if (window.opener) { window.opener.postMessage({ type: 'sso_error', reason: 'not_authorized' }, '*'); }
        window.close();
      </script></body></html>`);
    }

    setAuthCookie(res, { username: userKey, name: user.name, allowedReports: user.reports });
    res.send(`<html><body><script>
      if (window.opener) { window.opener.postMessage({ type: 'sso_success' }, '*'); }
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

// SSO login via access token (fallback)
app.post('/api/sso-login', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ success: false, error: 'No token provided' });

  try {
    const graphRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const email = (graphRes.data.userPrincipalName || graphRes.data.mail || '').toLowerCase();
    const userKey = Object.keys(dynamicData.ssoUsers).find(k => k.toLowerCase() === email);
    const user = userKey ? dynamicData.ssoUsers[userKey] : null;

    if (!user) {
      return res.status(403).json({ success: false, error: 'Access denied. User not authorized.' });
    }

    setAuthCookie(res, { username: userKey, name: user.name, allowedReports: user.reports });
    return res.json({ success: true, name: user.name, allowedReports: user.reports });
  } catch (err) {
    console.error('SSO login error:', err.response?.data || err.message);
    return res.status(401).json({ success: false, error: 'Invalid Azure AD token' });
  }
});

// Logout
app.post('/api/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });
  res.json({ success: true });
});

// In production, serve React build
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// =============================================
// Start
// =============================================
app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`\n✅ API server running at http://localhost:${CONFIG.PORT}`);
  console.log(`\n📋 Config:`);
  console.log(`   Client ID:    ${CONFIG.CLIENT_ID}`);
  console.log(`   Tenant ID:    ${CONFIG.TENANT_ID}`);
  console.log(`   Workspace:    ${CONFIG.WORKSPACE_ID}`);
  console.log(`   Dashboards:   ${dynamicData.dashboards.length}`);
  console.log(`   SSO Users:    ${Object.keys(dynamicData.ssoUsers).length}`);
  console.log('');
});
