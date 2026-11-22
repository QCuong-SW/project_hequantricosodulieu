// web/src/features/dashboard/StationUtilizationTable.jsx
const STATUS_CONFIG = {
  ACTIVE: { label: 'Đang hoạt động', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-500' },
  MAINTENANCE: { label: 'Bảo trì trạm', color: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-500' },
  OFFLINE: { label: 'Ngừng hoạt động', color: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-500' },
}

function barTone(percent) {
  if (percent >= 85) return 'bg-rose-500'
  if (percent >= 60) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function StationUtilizationTable({ stations = [] }) {
  if (!stations || stations.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        Chưa có dữ liệu trạm tiếp đất.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-4">Tên Trạm &amp; Mã</th>
            <th className="py-3 px-4">Trạng Thái</th>
            <th className="py-3 px-4 text-center">Slot Khả Dụng</th>
            <th className="py-3 px-4 text-center">Đang Bận</th>
            <th className="py-3 px-4 text-center">Bãi Đáp Bận</th>
            <th className="py-3 px-4">Mức Sử Dụng (SQL View)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {stations.map((s) => {
            const stCfg = STATUS_CONFIG[s.stationStatus] || {
              label: s.stationStatus,
              color: 'bg-slate-100 text-slate-700 border-slate-200',
              dot: 'bg-slate-400',
            }
            return (
              <tr key={s.stationId} className="hover:bg-slate-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-900 text-sm">{s.stationName}</div>
                  <div className="font-mono text-[11px] text-blue-700 font-semibold">{s.stationCode}</div>
                </td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${stCfg.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${stCfg.dot}`}></span>
                    {stCfg.label}
                  </span>
                </td>
                <td className="py-3 px-4 text-center font-mono font-bold text-slate-900 text-sm">
                  {s.usableSlots} / {s.actualSlots}
                </td>
                <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                  {s.busySlots}
                </td>
                <td className="py-3 px-4 text-center font-mono font-semibold text-slate-700">
                  {s.landingPadBusy} / {s.landingPadSlots}
                </td>
                <td className="py-3 px-4 min-w-[180px]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${barTone(s.utilizationPercent)}`}
                        style={{ width: `${Math.min(100, Math.max(2, s.utilizationPercent))}%` }}
                      />
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-xs w-12 text-right">
                      {s.utilizationPercent.toFixed(1)}%
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
