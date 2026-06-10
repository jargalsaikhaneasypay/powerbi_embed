const express = require('express');
const axios = require('axios');
const msal = require('@azure/msal-node');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

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
// PostgreSQL — Supabase
// =============================================
const pool = new Pool({
  host: 'aws-1-ap-northeast-2.pooler.supabase.com',
  port: 6543,
  user: 'postgres.lbtxnukgarzuqoysclhf',
  password: process.env.DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dashboards (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      report_id TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sso_users (
      email TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      reports INTEGER[] NOT NULL DEFAULT '{}'
    )
  `);

  // Seed dashboards if empty
  const { rows: dbRows } = await pool.query('SELECT COUNT(*) FROM dashboards');
  if (parseInt(dbRows[0].count) === 0) {
    await pool.query(`
      INSERT INTO dashboards (name, report_id) VALUES
      ('Dashboard 1', '2f3ed948-726c-45f4-9701-f773445e29d4'),
      ('Dashboard 2', '59b65d18-7735-4bcc-a4e6-35ce557aeb43'),
      ('Dashboard 3', 'df629503-90e7-4546-8700-2d445e39f673')
    `);
    console.log('✅ Seeded initial dashboards');
  }

  // Seed SSO users if empty
  const { rows: userRows } = await pool.query('SELECT COUNT(*) FROM sso_users');
  if (parseInt(userRows[0].count) === 0) {
    await pool.query(`
      INSERT INTO sso_users (email, name, reports) VALUES
      ('jargalsaikhan@easypay.mn', 'Jargalsaikhan', '{1,2,3}'),
      ('bolor-erdene@easypay.mn',  'Bolor-Erdene',  '{1,2,3}'),
      ('naranbaatar@easypay.mn',   'Naranbaatar',   '{1,2,3}'),
      ('zolzaya@easypay.mn',       'Zolzaya',       '{2}'),
      ('ganbold@easypay.mn',       'Ganbold',       '{2}')
    `);
    console.log('✅ Seeded initial SSO users');
  }

  console.log('✅ Database ready');
}

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
  const { rows } = await pool.query('SELECT * FROM dashboards WHERE id = $1', [reportNum]);
  if (!rows.length) throw new Error(`Dashboard ${reportNum} not found`);
  const reportId = rows[0].report_id;

  const authResult = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://analysis.windows.net/powerbi/api/.default']
  });

  if (!authResult?.accessToken) {
    throw new Error('MSAL returned no access token');
  }

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
    let reports;
    if (user.reports === 'all') {
      const { rows } = await pool.query('SELECT id FROM dashboards ORDER BY id');
      reports = rows.map(r => r.id);
    } else {
      reports = user.reports;
    }
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

// Get dashboards list for authenticated user
app.get('/api/dashboards', requireAuth, async (req, res) => {
  const allowed = req.user.allowedReports || [];
  if (!allowed.length) return res.json({ success: true, dashboards: [] });
  const { rows } = await pool.query(
    'SELECT id, name FROM dashboards WHERE id = ANY($1) ORDER BY id',
    [allowed]
  );
  res.json({ success: true, dashboards: rows });
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
// Admin API Routes
// =============================================

// Get all data
app.get('/api/admin/data', requireAdmin, async (req, res) => {
  const [usersRes, dashboardsRes] = await Promise.all([
    pool.query('SELECT * FROM sso_users ORDER BY email'),
    pool.query('SELECT * FROM dashboards ORDER BY id')
  ]);

  const ssoUsers = {};
  usersRes.rows.forEach(r => { ssoUsers[r.email] = { name: r.name, reports: r.reports }; });
  const dashboards = dashboardsRes.rows.map(r => ({ id: r.id, name: r.name, reportId: r.report_id }));

  res.json({ success: true, ssoUsers, dashboards });
});

// Add or update SSO user
app.post('/api/admin/sso-users', requireAdmin, async (req, res) => {
  const { email, name, reports } = req.body;
  if (!email || !name || !Array.isArray(reports)) {
    return res.status(400).json({ success: false, error: 'email, name, and reports[] are required' });
  }
  await pool.query(
    `INSERT INTO sso_users (email, name, reports) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET name = $2, reports = $3`,
    [email.toLowerCase().trim(), name.trim(), reports]
  );
  res.json({ success: true });
});

// Delete SSO user
app.delete('/api/admin/sso-users/:email', requireAdmin, async (req, res) => {
  const email = decodeURIComponent(req.params.email).toLowerCase();
  const { rowCount } = await pool.query('DELETE FROM sso_users WHERE email = $1', [email]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'User not found' });
  res.json({ success: true });
});

// Add dashboard
app.post('/api/admin/dashboards', requireAdmin, async (req, res) => {
  const { name, reportId } = req.body;
  if (!name || !reportId) {
    return res.status(400).json({ success: false, error: 'name and reportId are required' });
  }
  const { rows } = await pool.query(
    'INSERT INTO dashboards (name, report_id) VALUES ($1, $2) RETURNING *',
    [name.trim(), reportId.trim()]
  );
  res.json({ success: true, dashboard: { id: rows[0].id, name: rows[0].name, reportId: rows[0].report_id } });
});

// Delete dashboard
app.delete('/api/admin/dashboards/:id', requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM dashboards WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ success: false, error: 'Dashboard not found' });
  // Remove from all SSO users' report lists
  await pool.query('UPDATE sso_users SET reports = array_remove(reports, $1)', [id]);
  res.json({ success: true });
});

// =============================================
// Azure AD SSO Routes
// =============================================

app.get('/api/auth/microsoft', async (req, res) => {
  try {
    const redirectUri = `https://powerbi-embed-455h.onrender.com/api/auth/callback`;
    const authCodeUrl = await msalClient.getAuthCodeUrl({ scopes: ['User.Read'], redirectUri });
    res.redirect(authCodeUrl);
  } catch (err) {
    console.error('Auth URL error:', err.message);
    res.status(500).send('Authentication error');
  }
});

app.get('/api/auth/callback', async (req, res) => {
  const redirectUri = `https://powerbi-embed-455h.onrender.com/api/auth/callback`;
  try {
    const tokenResponse = await msalClient.acquireTokenByCode({
      code: req.query.code,
      scopes: ['User.Read'],
      redirectUri,
    });

    const email = (tokenResponse.account.username || '').toLowerCase();
    const { rows } = await pool.query('SELECT * FROM sso_users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) {
      return res.send(`<html><body><script>
        if (window.opener) { window.opener.postMessage({ type: 'sso_error', reason: 'not_authorized' }, '*'); }
        window.close();
      </script></body></html>`);
    }

    setAuthCookie(res, { username: email, name: user.name, allowedReports: user.reports });
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

app.post('/api/sso-login', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ success: false, error: 'No token provided' });

  try {
    const graphRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const email = (graphRes.data.userPrincipalName || graphRes.data.mail || '').toLowerCase();
    const { rows } = await pool.query('SELECT * FROM sso_users WHERE email = $1', [email]);
    const user = rows[0];

    if (!user) {
      return res.status(403).json({ success: false, error: 'Access denied. User not authorized.' });
    }

    setAuthCookie(res, { username: email, name: user.name, allowedReports: user.reports });
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

// Serve React build
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// =============================================
// Start
// =============================================
initDB()
  .then(() => {
    app.listen(CONFIG.PORT, '0.0.0.0', () => {
      console.log(`\n✅ Server running at http://localhost:${CONFIG.PORT}`);
      console.log(`   Database: ${process.env.DB_PASSWORD ? '✅ Supabase connected' : '⚠️  DB_PASSWORD not set'}`);
    });
  })
  .catch(err => {
    console.error('❌ Failed to initialize database:', err.message || err.code || JSON.stringify(err));
    process.exit(1);
  });
