# Power BI

Full-stack app to embed Power BI reports. React frontend, Express backend, service principal auth.

## Project Structure

```
powerbi-react/
├── server.js              ← Express backend (auth + embed token API)
├── package.json           ← Root dependencies + scripts
├── client/
│   ├── index.html
│   ├── vite.config.js     ← Vite + proxy to backend
│   ├── package.json       ← React dependencies
│   └── src/
│       ├── main.jsx       ← Entry point
│       ├── App.jsx        ← Router (Login ↔ Dashboard)
│       ├── api.js         ← API calls to backend
│       ├── styles.css     ← Global styles
│       └── pages/
│           ├── LoginPage.jsx
│           └── DashboardPage.jsx  ← Power BI embed
```

## Setup

### 1. Install everything
```bash
npm install
cd client && npm install && cd ..
```

### 2. Configure server.js
Open `server.js` and fill in:
- `TENANT_ID` — from Azure App → Overview
- `CLIENT_SECRET` — from Azure App → Certificates & secrets
- `REPORT_ID` — from Power BI report URL

Already set for you:
- `CLIENT_ID`: da995cce-e2d6-4064-92bd-a6c90a9da6fd
- `WORKSPACE_ID`: d4c47192-dd35-4291-bf95-ad16bce5e0b2
6
### 3. Run in development
```bash
npm run dev
```
This starts both the backend (port 3001) and React dev server (port 5173).

Open http://localhost:5173

### 4. Build for production
```bash
npm start
```
This builds React and serves everything from Express on port 3001.

## Features

-   React SPA with client-side routing
-  Power BI JS SDK integration
-  Auto token refresh before expiry
-  Session-based authentication
-  Responsive layout
-  Loading and error states
-  Clean component architecture

## Deploy

Build the React app, then deploy the whole folder:

```bash
npm run build
# Deploy to Railway, Render, Azure App Service, etc.
```

The Express server serves the built React app in production.
