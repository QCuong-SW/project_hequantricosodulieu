// web/src/features/dashboard/authBridge.js
//
// >>> CHỈ CẦN SỬA FILE NÀY để Dashboard lấy được token đăng nhập. <<<
// Token do Thành (M1) lưu trong LoginPage / auth store. Hãy mở code của Thành,
// xem token được giữ ở đâu rồi trả về đúng giá trị (chuỗi JWT) trong hàm dưới đây.
//
// Ví dụ nếu Thành có file features/auth/authStore.js:
//   import { getAccessToken as getToken } from '../auth/authStore.js';
//   export const getAccessToken = () => getToken();
export function getAccessToken() {
  return window.__accessToken ?? null; // tạm thời: thay bằng cách lấy token thật
}
