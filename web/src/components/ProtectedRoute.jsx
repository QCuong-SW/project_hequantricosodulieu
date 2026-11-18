import { Navigate } from 'react-router-dom';
import { getAccessToken } from '../features/dashboard/authBridge';

export function ProtectedRoute({ children, allowedRoles }) {
  const token = getAccessToken();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Nếu có phân quyền (allowedRoles), bạn có thể giải mã JWT hoặc check role từ user state
  // Tạm thời cho phép qua nếu đã có token, hoặc tích hợp hàm check role ở đây.
  return children;
}