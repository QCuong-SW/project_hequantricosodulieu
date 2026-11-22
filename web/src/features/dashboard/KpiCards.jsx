const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 })

const ORDER_STATUS_CONFIG = {
  DRAFT: { label: 'Bản nháp', color: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' },
  PENDING_APPROVAL: { label: 'Chờ duyệt', color: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  REJECTED: { label: 'Từ chối', color: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
  APPROVED: { label: 'Đã duyệt', color: 'bg-cyan-50 text-cyan-800 border-cyan-200', dot: 'bg-cyan-500' },
  SCHEDULED: { label: 'Đã lên lịch', color: 'bg-purple-50 text-purple-800 border-purple-200', dot: 'bg-purple-500' },
  IN_TRANSIT: { label: 'Đang vận chuyển', color: 'bg-blue-50 text-blue-800 border-blue-200', dot: 'bg-blue-500 animate-pulse' },
  DELIVERING: { label: 'Đang tiếp cận', color: 'bg-indigo-50 text-indigo-800 border-indigo-200', dot: 'bg-indigo-500 animate-pulse' },
  ARRIVED: { label: 'Đã đến bãi', color: 'bg-teal-50 text-teal-800 border-teal-200', dot: 'bg-teal-500' },
  DELIVERED: { label: 'Giao thành công', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  DELIVERY_FAILED: { label: 'Giao thất bại', color: 'bg-orange-50 text-orange-800 border-orange-200', dot: 'bg-orange-500' },
  CANCELLED: { label: 'Đã hủy đơn', color: 'bg-red-50 text-red-800 border-red-200', dot: 'bg-red-500' },
}

function KpiCard({ label, value, unit, hint, tone = 'neutral' }) {
  let borderTone = 'border-slate-200 bg-white'
  let textTone = 'text-slate-900'
  let dotTone = 'bg-blue-600'

  if (tone === 'good') {
    borderTone = 'border-emerald-200 bg-emerald-50/30'
    textTone = 'text-emerald-700'
    dotTone = 'bg-emerald-500'
  } else if (tone === 'warn') {
    borderTone = 'border-amber-200 bg-amber-50/30'
    textTone = 'text-amber-700'
    dotTone = 'bg-amber-500'
  } else if (tone === 'bad') {
    borderTone = 'border-rose-200 bg-rose-50/30'
    textTone = 'text-rose-700'
    dotTone = 'bg-rose-500'
  }

  return (
    <div className={`p-5 rounded-2xl border ${borderTone} shadow-xs space-y-1.5 transition hover:shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
        <span className={`w-2 h-2 rounded-full ${dotTone}`}></span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl lg:text-3xl font-black font-mono tracking-tight ${textTone}`}>{value}</span>
        {unit && <span className="text-xs font-bold text-slate-500 uppercase">{unit}</span>}
      </div>
      {hint && <p className="text-[11px] text-slate-500 pt-0.5">{hint}</p>}
    </div>
  )
}

function onTimeTone(summary) {
  if (!summary || summary.completedFlights === 0) return 'neutral'
  if (summary.onTimeRatePercent >= 90) return 'good'
  if (summary.onTimeRatePercent >= 70) return 'warn'
  return 'bad'
}

export default function KpiCards({ summary, orders = [] }) {
  const totalOrders = orders.reduce((sum, o) => sum + (o.count || 0), 0)
  const delivered = orders.find((o) => o.status === 'DELIVERED')?.count ?? 0
  const delayTone = summary.avgArrivalDelayMinutes > 5 ? 'warn' : 'neutral'

  return (
    <section className="space-y-4" aria-label="Chỉ số KPI vận hành">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Tổng chuyến bay"
          value={nf.format(summary.totalFlights || 0)}
          hint={`${summary.completedFlights || 0} hoàn thành · ${summary.abortedFlights || 0} hủy giữa chừng`}
        />
        <KpiCard
          label="Tỷ lệ đúng giờ"
          value={nf.format(summary.onTimeRatePercent || 0)}
          unit="%"
          hint={`${summary.onTimeFlights || 0}/${summary.completedFlights || 0} chuyến hoàn tất`}
          tone={onTimeTone(summary)}
        />
        <KpiCard
          label="Độ trễ trung bình"
          value={nf.format(summary.avgArrivalDelayMinutes || 0)}
          unit="phút"
          hint="Giá trị âm biểu thị đến sớm hơn dự kiến"
          tone={delayTone}
        />
        <KpiCard
          label="Tổng cự ly bay"
          value={nf.format(summary.totalDistanceKm || 0)}
          unit="km"
          hint={`Tốc độ hành trình TB: ${nf.format(summary.avgSpeedKmh || 0)} km/h`}
        />
        <KpiCard
          label="Tổng đơn hàng"
          value={nf.format(totalOrders)}
          hint={`${nf.format(delivered)} đơn đã giao an toàn`}
          tone="good"
        />
      </div>

      {orders.length > 0 && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">
            Phân bổ đơn hàng theo trạng thái quy trình:
          </div>
          <div className="flex flex-wrap gap-2">
            {orders.map((o) => {
              const cfg = ORDER_STATUS_CONFIG[o.status] || {
                label: o.status,
                color: 'bg-slate-100 text-slate-700 border-slate-200',
                dot: 'bg-slate-400',
              }
              return (
                <span
                  key={o.status}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${cfg.color}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}></span>
                  <span>{cfg.label}:</span>
                  <strong className="font-mono text-slate-900">{o.count}</strong>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
