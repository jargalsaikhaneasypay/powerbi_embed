import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { msalInstance } from './msalConfig';
import './styles.css';

async function bootstrap() {
  await msalInstance.initialize();

  const hasAuthCode =
    window.location.search.includes('code=') ||
    window.location.hash.includes('code=');

  // If this is a MSAL popup redirect window, process and close it
  if (hasAuthCode && window.opener) {
    try {
      await msalInstance.handleRedirectPromise();
    } finally {
      window.close();
    }
    return;
  }

  await msalInstance.handleRedirectPromise();

  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
}

bootstrap();
