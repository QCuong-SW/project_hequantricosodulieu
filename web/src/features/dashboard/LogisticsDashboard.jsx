import { useState, useEffect } from 'react'
import { useAnalyticsData } from './useAnalyticsData.js'
import { getAccessToken } from './authBridge.js'
import { API_V1_URL } from '../../config/apiConfig.js'
import StationUtilizationTable from './StationUtilizationTable.jsx'
import KpiCards from './KpiCards.jsx'
import FlightMetricsChart from './FlightMetricsChart.jsx'

const PRESETS = [
  { label: '7 ngày qua', days: 7 },
  { label: '30 ngày qua', days: 30 },
  { label: '90 ngày qua', days: 90 },
]

function toIsoDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function exportToCsv(data, from, to) {
  if (!data) return

  const headers = ['Ngay', 'TongChuyenBay', 'HoanThanh', 'HuyGiuaChung', 'DungGio', 'TongQuangDuongKm']
  const rows = (data.daily || []).map((d) => [
    d.date,
    d.totalFlights,
    d.completedFlights,
    d.abortedFlights,
    d.onTimeFlights,
    d.totalDistanceKm,
  ])

  const csvContent =
    'data:text/csv;charset=utf-8,\uFEFF' +
    [headers.join(','), ...rows.map((e) => e.join(','))].join('\n')

  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `smartdrone-logistics-report-${from}-to-${to}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export default function LogisticsDashboard() {
  const [to, setTo] = useState(() => toIsoDate(new Date()))
  const [from, setFrom] = useState(() => toIsoDate(daysAgo(29)))
  const rangeInvalid = from > to

  const { loading, error, data, reload } = useAnalyticsData({ from, to, enabled: !rangeInvalid })

  // Tích hợp AI ETA Predictor (Module M5 của Nhân: /api/v1/ai/eta/{orderId})
  const [ordersList, setOrdersList] = useState([])
  const [selectedOrderKey, setSelectedOrderKey] = useState('a1111111-1111-1111-1111-111111111001')
  const [windSpeedKmh, setWindSpeedKmh] = useState(12)
  const [aiEtaLoading, setAiEtaLoading] = useState(false)
  const [aiEtaResult, setAiEtaResult] = useState(null)
  const [aiEtaError, setAiEtaError] = useState('')

  async function predictAiEta(orderKey = selectedOrderKey, wind = windSpeedKmh) {
    if (!orderKey) return
    setAiEtaLoading(true)
    setAiEtaError('')
    try {
      const token = getAccessToken()
      const headers = { Accept: 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`
      const res = await fetch(
        `${API_V1_URL}/ai/eta/${encodeURIComponent(orderKey)}?windSpeedKmh=${encodeURIComponent(wind)}`,
        { headers }
      )
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.detail || json?.message || `Không thể tính thời gian dự kiến đến nơi (HTTP ${res.status})`)
      }
      setAiEtaResult(json?.data || json)
    } catch (err) {
      setAiEtaError(err.message)
    } finally {
      setAiEtaLoading(false)
    }
  }

  useEffect(() => {
    fetch(`${API_V1_URL}/delivery-orders`)
      .then((r) => (r.ok ? r.json() : null))
      .then((payload) => {
        const list = Array.isArray(payload) ? payload : payload?.data || []
        setOrdersList(list)
        if (list.length > 0) {
          const firstId = list[0].id || list[0].trackingNumber
          setSelectedOrderKey(firstId)
          predictAiEta(firstId, windSpeedKmh)
        } else {
          predictAiEta('a1111111-1111-1111-1111-111111111001', windSpeedKmh)
        }
      })
      .catch(() => {
        predictAiEta('a1111111-1111-1111-1111-111111111001', windSpeedKmh)
      })
  }, [])

  const applyPreset = (days) => {
    setFrom(toIsoDate(daysAgo(days - 1)))
    setTo(toIsoDate(new Date()))
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-slate-900 pb-16">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-emerald-900/10 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Dashboard Vận Hành Logistics &amp; Trạm Tiếp Đất
          </h1>
        </div>

        {/* Date Filter & Actions Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Quick Presets */}
          <div className="flex rounded-xl bg-slate-100/90 p-1 text-xs font-semibold border border-slate-200/80">
            {PRESETS.map((p) => (
              <button
                key={p.days}
                type="button"
                onClick={() => applyPreset(p.days)}
                className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-emerald-800 hover:bg-white transition cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Date pickers */}
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
            <span className="text-slate-400 font-bold">→</span>
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
            />
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={reload}
            disabled={loading || rangeInvalid}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white border border-slate-300 hover:border-emerald-500 hover:text-emerald-700 shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Đang tải...' : 'Làm Mới'}
          </button>

          {/* Export CSV button */}
          {data && (
            <button
              type="button"
              onClick={() => exportToCsv(data, from, to)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20 transition cursor-pointer"
            >
              Xuất Báo Cáo CSV
            </button>
          )}
        </div>
      </div>

      {/* Validation & Error Alerts */}
      {rangeInvalid && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-semibold">
          Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
        </div>
      )}
      {error && (
        <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-semibold flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={reload}
            className="text-xs font-bold underline cursor-pointer"
          >
            Thử lại
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="py-16 text-center text-slate-400 text-sm">
          <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
          Đang tổng hợp số liệu vận hành từ máy chủ...
        </div>
      )}

      {data && (
        <>
          {/* KPI Summary Cards */}
          <KpiCards summary={data.summary} orders={data.orders} />

          {/* AI ETA Prediction Widget (Module M5 - LLM + Rule-Based Fallback) */}
          <section className="bg-white rounded-2xl border border-emerald-200/90 shadow-xs p-6 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  DỰ BÁO THỜI GIAN ĐẾN NƠI BẰNG AI (LLM + VẬT LÝ)
                </div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Thời Gian Dự Kiến Đến Nơi Của Drone Bằng AI
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Kết nối trực tiếp API <code>GET /api/v1/ai/eta/&#123;orderId&#125;</code> — ưu tiên gọi mô hình LLM (OpenAI GPT-4o-mini) và tự động chuyển sang công thức Haversine &amp; vận tốc gió khi ngoại tuyến.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs">
                <select
                  value={selectedOrderKey}
                  onChange={(e) => {
                    setSelectedOrderKey(e.target.value)
                    predictAiEta(e.target.value, windSpeedKmh)
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono font-bold focus:bg-white focus:outline-none focus:border-emerald-600"
                >
                  {ordersList.length > 0 ? (
                    ordersList.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.trackingNumber} ({o.status})
                      </option>
                    ))
                  ) : (
                    <option value="a1111111-1111-1111-1111-111111111001">
                      SDD-20261108-482910
                    </option>
                  )}
                </select>

                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                  <span className="text-slate-600 font-semibold">Gió ngược:</span>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={windSpeedKmh}
                    onChange={(e) => setWindSpeedKmh(Number(e.target.value) || 0)}
                    className="w-14 px-2 py-0.5 rounded border border-slate-300 bg-white font-mono font-bold text-center"
                  />
                  <span className="text-slate-500 font-mono">km/h</span>
                </div>

                <button
                  type="button"
                  onClick={() => predictAiEta(selectedOrderKey, windSpeedKmh)}
                  disabled={aiEtaLoading}
                  className="px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50"
                >
                  {aiEtaLoading ? 'Đang tính AI...' : 'Tính Thời Gian Đến Nơi'}
                </button>
              </div>
            </div>

            {aiEtaError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
                {aiEtaError}
              </div>
            )}

            {aiEtaResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Thời Gian Dự Kiến Đến Nơi
                  </div>
                  <div className="mt-1 text-2xl font-black font-mono text-emerald-700">
                    {aiEtaResult.estimatedMinutes} phút
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Mã vận đơn: <strong className="font-mono text-slate-800">{aiEtaResult.trackingNumber}</strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Cự Ly Đường Chim Bay (Haversine)
                  </div>
                  <div className="mt-1 text-2xl font-black font-mono text-slate-900">
                    {aiEtaResult.distanceKm} km
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Xét tốc độ gió ngược: {windSpeedKmh} km/h
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Nguồn Mô Hình Dự Đoán
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-extrabold border ${
                        aiEtaResult.source === 'LLM'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-teal-50 text-teal-800 border-teal-200'
                      }`}
                    >
                      {aiEtaResult.source === 'LLM' ? 'LLM (GPT-4o-mini)' : 'FALLBACK (Rule-Based)'}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1.5">
                    Dự kiến hạ cánh:{' '}
                    <strong className="font-mono text-slate-700">
                      {aiEtaResult.estimatedArrival
                        ? new Date(aiEtaResult.estimatedArrival).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </strong>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Chi Tiết Giải Thuật / Ghi Chú
                  </div>
                  <div className="mt-1.5 text-xs font-medium text-slate-700 leading-relaxed">
                    {aiEtaResult.note || 'Dự đoán hoàn tất bởi mô hình ngôn ngữ lớn (LLM).'}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Daily Flight Chart Card */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Biểu Đồ Xu Hướng Chuyến Bay Theo Ngày
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Phân bố số lượng chuyến hoàn thành, chuyến bị hủy và chuyến đang điều phối.
                </p>
              </div>
              <span className="font-mono text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 font-semibold">
                Khoảng: {from} đến {to}
              </span>
            </div>
            <FlightMetricsChart daily={data.daily} />
          </section>

          {/* Station Utilization Table Card */}
          <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h2 className="text-base font-bold text-slate-900">
                Hiệu Suất Sử Dụng Slot Tại Các Trạm Tiếp Đất
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Dữ liệu thời gian thực truy vấn từ SQL View <code>dbo.v_station_slot_utilization</code>.
              </p>
            </div>
            <StationUtilizationTable stations={data.stations} />
          </section>
        </>
      )}
    </div>
  )
}
