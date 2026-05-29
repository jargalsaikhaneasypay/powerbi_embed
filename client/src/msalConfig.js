import { PublicClientApplication } from '@azure/msal-browser';

const msalConfig = {
  auth: {
    clientId: 'da995cce-e2d6-4064-92bd-a6c90a9da6fd',
    authority: 'https://login.microsoftonline.com/c7c2eb81-57fd-4e38-bec1-d91a88228111',
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: true, // required for iframe/SharePoint
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

export const loginScopes = ['User.Read'];

export async function triggerMicrosoftLogin() {
  const result = await msalInstance.loginPopup({ scopes: loginScopes });
  return result.accessToken;
}

export async function tryMicrosoftSilentLogin() {
  const accounts = msalInstance.getAllAccounts();
  if (!accounts.length) return null;

  try {
    const result = await msalInstance.ssoSilent({ scopes: loginScopes, account: accounts[0] });
    return result.accessToken;
  } catch (error) {
    console.warn('MSAL silent login failed:', error.errorCode || error.message || error);
    return null;
  }
}
