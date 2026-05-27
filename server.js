const express = require('express');
const axios = require('axios');
const msal = require('@azure/msal-node');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
app.set('trust proxy', 1); // Required: Render terminates SSL at its proxy
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
  REPORT_ID_1: '2f3ed948-726c-45f4-9701-f773445e29d4',   // Dashboard 1 (EasypayAll)
  REPORT_ID_2: '59b65d18-7735-4bcc-a4e6-35ce557aeb43',   // Dashboard 2 (Easypay)
  REPORT_ID_3: 'df629503-90e7-4546-8700-2d445e39f673',   // Dashboard 3 (EasypayShts)
  JWT_SECRET: process.env.JWT_SECRET || 'easypay-jwt-secret-2026',

  // Web login users only
  USERS: {
    'Admin':      { password: 'Easypay321',     name: 'Admin',       reports: [1, 2, 3] },
    'EasypayAll': { password: 'easypay2026',    name: 'EasypayAll',  reports: [1] },
    'Easypay':    { password: 'Easypay123',     name: 'Easypay',     reports: [2] },
    'EasypayShts':{ password: 'EasypayShts123', name: 'EasypayShts', reports: [3] },
  },

  // SharePoint SSO users only (company email — no password needed)
  SSO_USERS: {
    'jargalsaikhan@easypay.mn': { name: 'Jargalsaikhan', reports: [1, 2, 3] },
    'bolor-erdene@easypay.mn':  { name: 'Bolor-Erdene',  reports: [1, 2, 3] },
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
  const reportId = reportNum === 3 ? CONFIG.REPORT_ID_3 : reportNum === 2 ? CONFIG.REPORT_ID_2 : CONFIG.REPORT_ID_1;

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
// JWT Auth Middleware
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
    setAuthCookie(res, { username, name: user.name, allowedReports: user.reports });
    return res.json({ success: true, name: user.name, allowedReports: user.reports });
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

// Get embed info (protected)
app.get('/api/embed-info', requireAuth, async (req, res) => {
  try {
    const reportNum = parseInt(req.query.report) || 1;
    const allowed = req.user.allowedReports || [1];

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

// Azure AD SSO Login
app.post('/api/sso-login', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ success: false, error: 'No token provided' });

  try {
    const graphRes = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const email = (graphRes.data.userPrincipalName || graphRes.data.mail || '').toLowerCase();
    const userKey = Object.keys(CONFIG.SSO_USERS).find(k => k.toLowerCase() === email);
    const user = userKey ? CONFIG.SSO_USERS[userKey] : null;

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
  console.log(`   Tenant ID:    ${CONFIG.TENANT_ID === 'YOUR_TENANT_ID_HERE' ? '❌ NOT SET' : '✅ Set'}`);
  console.log(`   Secret:       ${CONFIG.CLIENT_SECRET === 'YOUR_CLIENT_SECRET_HERE' ? '❌ NOT SET' : '✅ Set'}`);
  console.log(`   Workspace:    ${CONFIG.WORKSPACE_ID}`);
  console.log(`   Report ID 1:  ${CONFIG.REPORT_ID_1 === 'YOUR_REPORT_ID_HERE' ? '❌ NOT SET' : '✅ Set'}`);
  console.log(`   Report ID 2:  ${CONFIG.REPORT_ID_2 === 'YOUR_SECOND_REPORT_ID_HERE' ? '❌ NOT SET' : '✅ Set'}`);
  console.log(`   Report ID 3:  ${CONFIG.REPORT_ID_3 === 'YOUR_THIRD_REPORT_ID_HERE' ? '❌ NOT SET' : '✅ Set'}`);
  console.log('');
});
