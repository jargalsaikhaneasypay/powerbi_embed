import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { msalInstance } from './msalConfig';
import './styles.css';

async function bootstrap() {
  await msalInstance.initialize();

  // If this window is a MSAL popup redirect, let MSAL handle it and stop —
  // the popup will close itself automatically, don't render the app.
  await msalInstance.handleRedirectPromise();
  if (window.opener && window.location.hash.includes('code=')) return;

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

bootstrap();
