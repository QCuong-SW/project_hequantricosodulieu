// web/src/features/auth/LoginPage.jsx
import { useState } from 'react'
import { Drone } from 'lucide-react'
import { loginWithCredentials, registerAccount } from '../dashboard/authBridge'
import { showToast } from '../../utils/toast'

export default function LoginPage({ onLoginSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    setError('')

    if (!email || !email.includes('@')) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.')
      return
    }
    if (!password || password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }

    setLoading(true)

    try {
      if (mode === 'login') {
        const res = await loginWithCredentials(email, password)
        if (!res.success) {
          setError(res.error || 'Đăng nhập không thành công.')
          setLoading(false)
          return
        }

        const user = res.data?.user || { email, roles: ['CUSTOMER'] }
        const role = user.roles?.[0] || 'CUSTOMER'
        showToast(`Xin chào ${user.fullName || user.email}! Đăng nhập thành công.`, 'success')
        if (onLoginSuccess) {
          onLoginSuccess(user, role)
        }
      } else {
        if (!fullName.trim()) {
          setError('Vui lòng nhập họ và tên của bạn.')
          setLoading(false)
          return
        }

        const res = await registerAccount({ fullName, email, password, phone })
        if (!res.success) {
          setError(res.error || 'Đăng ký tài khoản không thành công.')
          setLoading(false)
          return
        }

        const user = res.data?.user || { email, fullName, roles: ['CUSTOMER'] }
        showToast(`Chào mừng ${user.fullName}! Tài khoản của bạn đã được tạo thành công.`, 'success')
        if (onLoginSuccess) {
          onLoginSuccess(user, 'CUSTOMER')
        }
      }
    } catch (err) {
      setError(err.message || 'Lỗi hệ thống khi kết nối xác thực.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8F7] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans text-slate-900 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Background Decorative Rings */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-200/30 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-500/10 mb-4 transition-transform hover:scale-105">
            <Drone className="w-8 h-8 text-white stroke-[2.2]" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Smart Drone Delivery
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Hệ thống vận tải Drone giao nhận thông minh • TP. Hồ Chí Minh
          </p>
        </div>

        {/* Card */}
        <div className="mt-7 bg-white py-8 px-6 sm:px-8 shadow-xl shadow-slate-900/5 rounded-3xl border border-slate-200/80 relative">
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError('')
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'login'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Đăng Nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError('')
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'register'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Đăng Ký Tài Khoản Mới
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                !
              </span>
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Họ và Tên *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ví dụ: Nguyễn Minh Quân"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Số Điện Thoại (Tùy chọn)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ví dụ: 0912 345 678"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Đăng Nhập *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten.nguoidung@smartdrone.vn"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                  Mật Khẩu *
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold cursor-pointer"
                >
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition font-mono"
              />
            </div>

            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-slate-600 font-medium">Ghi nhớ đăng nhập</span>
                </label>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-md shadow-emerald-600/25 transition cursor-pointer flex items-center justify-center gap-2 text-xs disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang xử lý xác thực...</span>
                  </>
                ) : mode === 'login' ? (
                  'Đăng Nhập Vào Hệ Thống'
                ) : (
                  'Tạo Tài Khoản & Bắt Đầu'
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-xs text-slate-400 font-medium">
          Dự án Hệ Quản Trị Cơ Sở Dữ Liệu • Giao thức điều hướng Drone tự hành
        </p>
      </div>
    </div>
  )
}
