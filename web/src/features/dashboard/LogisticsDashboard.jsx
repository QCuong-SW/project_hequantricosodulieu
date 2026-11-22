import { useState } from 'react'
import { useAnalyticsData } from './useAnalyticsData.js'
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
