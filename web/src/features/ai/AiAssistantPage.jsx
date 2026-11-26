import { useEffect, useState } from 'react'
import { API_V1_URL } from '../../config/apiConfig'
import { getAccessToken } from '../dashboard/authBridge'

const QUICK_PROMPTS = [
  'Tóm tắt tình hình giao hàng hôm nay',
  'Đơn nào đang bay giao hàng?',
  'Ước tính thời gian bay tới Thủ Đức khi gió 20 km/h',
  'Quy định tải trọng Drone và xác nhận OTP',
]

export default function AiAssistantPage({ currentUser }) {
  const [activeTab, setActiveTab] = useState('CHAT') // 'CHAT' | 'SUMMARY' | 'ETA'
  const [orders, setOrders] = useState([])

  // 1. AI Chat State
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'ai',
      source: 'SMARTDRONE AI',
      text: 'Xin chào! Mình là Trợ lý AI của SmartDroneDelivery. Bạn muốn kiểm tra đơn đang bay, tóm tắt vận hành hôm nay hay tính thời gian dự kiến đến nơi?',
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  // 2. AI Summarization State
  const [summaryTarget, setSummaryTarget] = useState('ALL')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryResult, setSummaryResult] = useState(null)

  // 3. AI Arrival Time Prediction State
  const [etaOrderKey, setEtaOrderKey] = useState('')
  const [windSpeedKmh, setWindSpeedKmh] = useState(12)
  const [etaLoading, setEtaLoading] = useState(false)
  const [etaResult, setEtaResult] = useState(null)

  useEffect(() => {
    fetch(`${API_V1_URL}/delivery-orders`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : payload?.data || []
        setOrders(list)
        if (list.length > 0) {
          const firstKey = list[0].id || list[0].trackingNumber
          setEtaOrderKey(firstKey)
          runEtaPrediction(firstKey, windSpeedKmh)
        }
      })
      .catch(() => { })

    runSummary('ALL')
  }, [])

  async function sendChatMessage(textToSend) {
    const prompt = (textToSend ?? chatInput).trim()
    if (!prompt || chatLoading) return

    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, sender: 'user', text: prompt, time: nowStr },
    ])
    setChatInput('')
    setChatLoading(true)

    try {
      const token = getAccessToken()
      const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(`${API_V1_URL}/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: prompt,
          role: currentUser?.roles?.[0] || 'ADMIN',
        }),
      })
      const json = await res.json().catch(() => null)
      const data = json?.data || json

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          sender: 'ai',
          source: data?.source || 'AI ENGINE',
          text: data?.reply || 'Không nhận được phản hồi từ dịch vụ AI.',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'ai',
          source: 'SYSTEM',
          text: 'Không kết nối được tới máy chủ AI. Vui lòng kiểm tra Backend API (cổng 5028).',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setChatLoading(false)
    }
  }

  async function runSummary(targetKey = summaryTarget) {
    setSummaryLoading(true)
    try {
      const res = await fetch(`${API_V1_URL}/ai/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ orderKey: targetKey }),
      })
      const json = await res.json().catch(() => null)
      if (res.ok && json?.data) {
        setSummaryResult(json.data)
      }
    } catch {
      // ignore
    } finally {
      setSummaryLoading(false)
    }
  }

  async function runEtaPrediction(orderKey = etaOrderKey, wind = windSpeedKmh) {
    if (!orderKey) return
    setEtaLoading(true)
    try {
      const token = getAccessToken()
      const headers = { Accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch(
        `${API_V1_URL}/ai/eta/${encodeURIComponent(orderKey)}?windSpeedKmh=${encodeURIComponent(wind)}`,
        { headers }
      )
      const json = await res.json().catch(() => null)
      if (res.ok && json) {
        setEtaResult(json.data || json)
      }
    } catch {
      // ignore
    } finally {
      setEtaLoading(false)
    }
  }

  return (
    <section className="max-w-7xl mx-auto space-y-6 text-slate-900 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-emerald-900/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Trợ Lý AI
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Hỏi đáp trợ lý AI, tóm tắt báo cáo giao hàng tự động và dự báo thời gian dự kiến đến nơi theo thời tiết.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 bg-white p-1.5 rounded-2xl border border-emerald-200/80 shadow-xs">
          {[
            { key: 'CHAT', label: 'Trợ Lý Hỏi Đáp AI' },
            { key: 'SUMMARY', label: 'Tóm Tắt Giao Hàng AI' },
            { key: 'ETA', label: 'Dự Báo Thời Gian Đến Nơi' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${activeTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB 1: AI ASSISTANT CHAT */}
      {activeTab === 'CHAT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-emerald-200/90 shadow-xs flex flex-col h-[560px] overflow-hidden">
            {/* Messages list */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#F8FAF9]/60">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-line shadow-2xs ${m.sender === 'user'
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-white border border-emerald-100 text-slate-800 rounded-bl-sm'
                      }`}
                  >
                    {m.sender === 'ai' && m.source && (
                      <div className="text-[10px] font-mono font-bold text-emerald-700 uppercase tracking-wider mb-1">
                        {m.source}
                      </div>
                    )}
                    <div>{m.text}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{m.time}</span>
                </div>
              ))}
              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
                  <span className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  Trợ lý AI đang phân tích dữ liệu thời gian thực...
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                sendChatMessage()
              }}
              className="p-4 bg-white border-t border-slate-100 flex items-center gap-2.5"
            >
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Nhập câu hỏi cho Trợ lý AI (VD: Đơn nào đang bay? Tóm tắt hôm nay?)..."
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <button
                type="submit"
                disabled={chatLoading || !chatInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                Gửi Câu Hỏi
              </button>
            </form>
          </div>

          {/* Right Sidebar: Quick Prompts */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">Câu Hỏi Gợi Ý Nhanh</h2>
              <p className="text-xs text-slate-500">
                Chọn nhanh một yêu cầu để AI phân tích trực tiếp từ dữ liệu đơn hàng đang chạy.
              </p>
              <div className="flex flex-col gap-2 pt-1">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendChatMessage(q)}
                    className="text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-50/70 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 transition cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-emerald-50/60 rounded-2xl border border-emerald-200 p-5 space-y-2 text-xs">
              <div className="font-extrabold text-emerald-900">Kiến Trúc Dịch Vụ AI</div>
              <p className="text-emerald-950/80 leading-relaxed">
                Hệ thống sử dụng mô hình <strong>LLM (OpenAI GPT-4o-mini)</strong> kết hợp bộ máy suy luận dữ liệu thời gian thực và công thức vật lý Haversine dự phòng khi không có API Key.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI DELIVERY SUMMARIZATION */}
      {activeTab === 'SUMMARY' && (
        <div className="bg-white rounded-2xl border border-emerald-200/90 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Tóm Tắt Hành Trình &amp; Báo Cáo Giao Hàng Tự Động Bằng AI
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Chọn toàn hệ thống hoặc từng mã đơn cụ thể để AI tổng hợp trạng thái, tải trọng và khuyến nghị điều phối.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <select
                value={summaryTarget}
                onChange={(e) => {
                  setSummaryTarget(e.target.value)
                  runSummary(e.target.value)
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 font-mono font-bold text-slate-900"
              >
                <option value="ALL">Tóm tắt toàn hệ thống hôm nay</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.trackingNumber || o.id}>
                    Đơn {o.trackingNumber} ({o.status})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => runSummary(summaryTarget)}
                disabled={summaryLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                {summaryLoading ? 'Đang phân tích...' : 'Tạo Tóm Tắt AI'}
              </button>
            </div>
          </div>

          {summaryResult && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold text-emerald-950">{summaryResult.title}</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-white border border-emerald-200 text-emerald-800 font-mono text-[10px] font-bold whitespace-nowrap">
                    {summaryResult.source}
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed">{summaryResult.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(summaryResult.highlights || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-800 flex items-start gap-2.5"
                  >
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>

              {summaryResult.recommendation && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950">
                  <strong className="font-extrabold">Khuyến nghị từ AI: </strong>
                  {summaryResult.recommendation}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AI ARRIVAL TIME PREDICTION */}
      {activeTab === 'ETA' && (
        <div className="bg-white rounded-2xl border border-emerald-200/90 p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Tính Thời Gian Dự Kiến Đến Nơi Của Drone Bằng AI
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Phân tích khoảng cách Haversine thực tế giữa Trạm xuất phát và địa chỉ giao hàng kết hợp tốc độ gió ngược.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <select
                value={etaOrderKey}
                onChange={(e) => {
                  setEtaOrderKey(e.target.value)
                  runEtaPrediction(e.target.value, windSpeedKmh)
                }}
                className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 font-mono font-bold text-slate-900"
              >
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.trackingNumber} ({o.status})
                  </option>
                ))}
              </select>

              <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span className="font-semibold text-slate-600">Gió ngược:</span>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={windSpeedKmh}
                  onChange={(e) => setWindSpeedKmh(Number(e.target.value))}
                  className="accent-emerald-600"
                />
                <span className="font-mono font-bold text-emerald-800 w-14">{windSpeedKmh} km/h</span>
              </div>

              <button
                type="button"
                onClick={() => runEtaPrediction(etaOrderKey, windSpeedKmh)}
                disabled={etaLoading}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition cursor-pointer whitespace-nowrap"
              >
                {etaLoading ? 'Đang tính...' : 'Tính Thời Gian Đến Nơi'}
              </button>
            </div>
          </div>

          {etaResult && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Thời Gian Dự Kiến Đến Nơi
                </div>
                <div className="mt-1 text-2xl font-black font-mono text-emerald-700">
                  {etaResult.estimatedMinutes} phút
                </div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Cự Ly Đường Chim Bay
                </div>
                <div className="mt-1 text-2xl font-black font-mono text-slate-900">
                  {etaResult.distanceKm} km
                </div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Nguồn Mô Hình AI
                </div>
                <div className="mt-1.5">
                  <span className="inline-flex items-center whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold bg-emerald-600 text-white">
                    {etaResult.source}
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Chi Tiết Tính Toán
                </div>
                <div className="mt-1 text-xs font-medium text-slate-700 leading-relaxed">
                  {etaResult.note || 'Dự báo hoàn tất bằng mô hình AI LLM.'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
