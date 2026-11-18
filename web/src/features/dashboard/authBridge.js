// web/src/features/dashboard/authBridge.js

export function getAccessToken() {
  // Lấy token từ localStorage hoặc sessionStorage tùy theo cách bạn lưu khi đăng nhập
  return localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken') || window.__accessToken || null;
}

export function setAccessToken(token) {
  if (token) {
    localStorage.setItem('accessToken', token);
  } else {
    localStorage.removeItem('accessToken');
  }
}