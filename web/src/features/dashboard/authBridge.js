// web/src/features/dashboard/authBridge.js
import { AUTH_API_URL, ROLE_ACCOUNTS } from '../../config/apiConfig.js';

export function getAccessToken() {
  return window.__accessToken || localStorage.getItem('accessToken') || null;
}

export function getCurrentUser() {
  try {
    const raw = localStorage.getItem('currentUser');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
    const uid = authData.user.userId || authData.user.id;
    if (uid) {
      localStorage.setItem('customerId', String(uid));
    }
  }
}

export async function loginWithCredentials(email, password = 'Password123!') {
  try {
    const res = await fetch(`${AUTH_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.detail || data?.message || data?.title || 'Email hoặc mật khẩu không chính xác.';
      return { success: false, error: errorMsg };
    }

    setAuthSession(data);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message || 'Không thể kết nối đến máy chủ xác thực.' };
  }
}

export async function registerAccount({ fullName, email, password, phone = '' }) {
  try {
    const res = await fetch(`${AUTH_API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || null,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const errorMsg = data?.detail || data?.message || data?.title || 'Đăng ký không thành công.';
      return { success: false, error: errorMsg };
    }

    setAuthSession(data);
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message || 'Không thể kết nối đến máy chủ.' };
  }
}

export async function loginAsRole(role) {
  const account = ROLE_ACCOUNTS[role] || ROLE_ACCOUNTS.CUSTOMER;
  const res = await loginWithCredentials(account.email, 'Password123!');
  return res.success ? res.data : null;
}

export function clearAuthSession() {
  window.__accessToken = null;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('currentUser');
  localStorage.removeItem('customerId');
}

