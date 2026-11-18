import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setAccessToken } from '../dashboard/authBridge';
import './LoginPage.css'; // Tuỳ chọn file CSS nếu có

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Đăng nhập thất bại.');
      }

      // Lấy token từ response (giả sử cấu trúc trả về có token hoặc data.token)
      const token = result.data?.token || result.token;
      if (token) {
        setAccessToken(token);
        navigate('/dashboard');
      } else {
        throw new Error('Không nhận được token từ máy chủ.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sdd-login-container">
      <form className="sdd-login-form" onSubmit={handleLogin}>
        <h2>Smart Drone Delivery</h2>
        <p>Đăng nhập hệ thống quản trị</p>

        {error && <div className="sdd-error-msg">{error}</div>}

        <div className="sdd-form-group">
          <label>Tài khoản / Email</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="sdd-form-group">
          <label>Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading} className="sdd-submit-btn">
          {loading ? 'Đang xử lý...' : 'Đăng nhập'}
        </button>
      </form>
    </div>
  );
}