import { useEffect, useState } from 'react'
import { API_V1_URL } from '../../config/apiConfig'
import { showToast } from '../../utils/toast'

export default function AdminFeedbacksPage() {
  const [feedbacks, setFeedbacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [replyingId, setReplyingId] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [filterRating, setFilterRating] = useState('ALL')

  async function loadFeedbacks() {
    setLoading(true)
    try {
      const res = await fetch(`${API_V1_URL}/feedbacks`)
      const json = await res.json().catch(() => null)
      const items = json?.data || (Array.isArray(json) ? json : [])
      setFeedbacks(items)
    } catch {
      showToast('Không thể tải danh sách phản hồi khách hàng.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFeedbacks()
  }, [])

  async function handleSendReply(feedbackId) {
    if (!replyText.trim()) return
    try {
      const res = await fetch(`${API_V1_URL}/feedbacks/${feedbackId}/reply`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminReply: replyText.trim() }),
      })
      if (!res.ok) throw new Error('Không thể gửi phản hồi.')
      showToast('Đã gửi phản hồi tới khách hàng thành công!', 'success')
      setReplyingId(null)
      setReplyText('')
      await loadFeedbacks()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const filteredFeedbacks = feedbacks.filter((f) => {
    if (filterRating === 'ALL') return true
    if (filterRating === 'UNREPLIED') return !f.adminReply
    return Number(f.rating) === Number(filterRating)
  })

  const avgRating =
    feedbacks.length > 0
      ? (
          feedbacks.reduce((sum, f) => sum + (Number(f.rating) || 5), 0) / feedbacks.length
        ).toFixed(1)
      : '5.0'
  const unrepliedCount = feedbacks.filter((f) => !f.adminReply).length

  return (
    <section className="max-w-6xl mx-auto space-y-6 text-slate-900 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-900/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Phản Hồi &amp; Đánh Giá Từ Khách Hàng
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tiếp nhận đánh giá dịch vụ giao hàng bằng Drone gửi trực tiếp từ ứng dụng Mobile của khách.
          </p>
        </div>

        <button
          type="button"
          onClick={loadFeedbacks}
          className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs transition cursor-pointer"
        >
          {loading ? 'Đang đồng bộ...' : 'Làm Mới Phản Hồi'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Tổng số lượt đánh giá
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono mt-1">
            {feedbacks.length}
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Điểm hài lòng trung bình
          </div>
          <div className="text-2xl font-black text-emerald-700 font-mono mt-1">
            {avgRating} / 5.0 ★
          </div>
        </div>
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs">
          <div className="text-xs font-semibold text-amber-600 uppercase tracking-wider">
            Chờ Admin phản hồi
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono mt-1">
            {unrepliedCount}
          </div>
        </div>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: 'ALL', label: 'Tất cả phản hồi' },
          { key: 'UNREPLIED', label: `Chưa trả lời (${unrepliedCount})` },
          { key: '5', label: '5 Sao (★★★★★)' },
          { key: '4', label: '4 Sao (★★★★)' },
          { key: '3', label: '3 Sao trở xuống' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilterRating(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterRating === tab.key
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback List */}
      <div className="space-y-4">
        {filteredFeedbacks.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-xs text-slate-400">
            Chưa có phản hồi nào trong mục này.
          </div>
        ) : (
          filteredFeedbacks.map((fb) => (
            <div
              key={fb.id}
              className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center">
                    {(fb.customerName || 'K')[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{fb.customerName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{fb.customerEmail}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono text-xs font-bold">
                    Đơn: {fb.trackingNumber || 'SDD-ORDER'}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs">
                    {'★'.repeat(Math.max(1, Math.min(5, Number(fb.rating) || 5)))} ({fb.rating}/5)
                  </span>
                </div>
              </div>

              <p className="text-sm text-slate-800 bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
                “{fb.comment}”
              </p>

              {fb.adminReply ? (
                <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/80 text-xs space-y-1">
                  <div className="font-bold text-emerald-900 flex items-center justify-between">
                    <span>Phản hồi từ Quản trị viên:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingId(fb.id)
                        setReplyText(fb.adminReply)
                      }}
                      className="text-[11px] text-emerald-700 hover:underline cursor-pointer"
                    >
                      Sửa phản hồi
                    </button>
                  </div>
                  <p className="text-emerald-950">{fb.adminReply}</p>
                </div>
              ) : null}

              {replyingId === fb.id ? (
                <div className="pt-2 space-y-2">
                  <textarea
                    rows={2}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Nhập nội dung phản hồi gửi tới khách hàng..."
                    className="w-full px-3.5 py-2 rounded-xl border border-emerald-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingId(null)
                        setReplyText('')
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendReply(fb.id)}
                      className="px-4 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                    >
                      Gửi Phản Hồi
                    </button>
                  </div>
                </div>
              ) : (
                !fb.adminReply && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setReplyingId(fb.id)
                        setReplyText('')
                      }}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
                    >
                      Trả lời khách hàng
                    </button>
                  </div>
                )
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
