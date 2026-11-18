// web/src/features/dashboard/authBridge.js
import { AUTH_API_URL, ROLE_ACCOUNTS } from '../../config/apiConfig.js';

export function getAccessToken() {
  return window.__accessToken || localStorage.getItem('accessToken') || null;
}

export function setAuthSession(authData) {
  if (!authData?.accessToken) return;
  window.__accessToken = authData.accessToken;
  localStorage.setItem('accessToken', authData.accessToken);
  if (authData.refreshToken) {
    localStorage.setItem('refreshToken', authData.refreshToken);
  }
  if (authData.user) {
    localStorage.setItem('currentUser', JSON.stringify(authData.user));
    if (authData.user.userId) {
      localStorage.setItem('customerId', String(authData.user.userId));
    }
  }
}

export async function loginWithCredentials(email, password = 'P@ssword123!') {
  try {
    const res = await fetch(`${AUTH_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    setAuthSession(data);
    return data;
  } catch {
    return null;
  }
}

export async function loginAsRole(role) {
  const account = ROLE_ACCOUNTS[role] || ROLE_ACCOUNTS.CUSTOMER;
  return loginWithCredentials(account.email, 'P@ssword123!');
}

