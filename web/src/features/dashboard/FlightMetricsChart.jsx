// web/src/features/dashboard/FlightMetricsChart.jsx
const W = 760
const H = 300
const MARGIN = { top: 16, right: 16, bottom: 36, left: 40 }

const formatDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

export default function FlightMetricsChart({ daily }) {
  if (!daily || daily.every((d) => d.totalFlights === 0)) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        Chưa có chuyến bay nào được ghi nhận trong khoảng thời gian này.
      </div>
    )
  }

  const innerW = W - MARGIN.left - MARGIN.right
  const innerH = H - MARGIN.top - MARGIN.bottom
  const maxTotal = Math.max(1, ...daily.map((d) => d.totalFlights))
  const yMax = Math.ceil(maxTotal / 4) * 4
  const ticks = [0, 1, 2, 3, 4].map((i) => (yMax * i) / 4)
  const step = innerW / daily.length
  const barW = Math.max(1, step * 0.7)
  const labelEvery = Math.max(1, Math.ceil(daily.length / 8))
  const scale = (v) => (v / yMax) * innerH
  const baseY = MARGIN.top + innerH

  return (
    <div className="space-y-4">
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto max-h-[300px] block font-mono"
          role="img"
          aria-label="Biểu đồ số chuyến bay theo ngày"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={MARGIN.left}
                x2={W - MARGIN.right}
                y1={baseY - scale(t)}
                y2={baseY - scale(t)}
                stroke="#e2e8f0"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <text
                x={MARGIN.left - 8}
                y={baseY - scale(t) + 4}
                textAnchor="end"
                className="text-[11px] fill-slate-400 font-medium"
              >
                {t}
              </text>
            </g>
          ))}

          {daily.map((d, i) => {
            const other = Math.max(0, d.totalFlights - d.completedFlights - d.abortedFlights)
            const x = MARGIN.left + i * step + (step - barW) / 2
            const hDone = scale(d.completedFlights)
            const hAbort = scale(d.abortedFlights)
            const hOther = scale(other)
            return (
              <g key={d.date} className="cursor-pointer group">
                <title>
                  {`${formatDay(d.date)}: ${d.totalFlights} chuyến (${d.completedFlights} hoàn thành, ${d.abortedFlights} hủy, ${other} khác)`}
                </title>
                {/* Completed - Emerald Green */}
                <rect
                  x={x}
                  y={baseY - hDone}
                  width={barW}
                  height={hDone}
                  fill="#059669"
                  rx="2"
                  className="transition hover:opacity-85"
                />
                {/* Aborted - Rose Red */}
                <rect
                  x={x}
                  y={baseY - hDone - hAbort}
                  width={barW}
                  height={hAbort}
                  fill="#f43f5e"
                  rx="2"
                  className="transition hover:opacity-85"
                />
                {/* Other (Scheduled / In-flight) - Mint */}
                <rect
                  x={x}
                  y={baseY - hDone - hAbort - hOther}
                  width={barW}
                  height={hOther}
                  fill="#34d399"
                  rx="2"
                  className="transition hover:opacity-85"
                />
                {i % labelEvery === 0 && (
                  <text
                    x={x + barW / 2}
                    y={H - 12}
                    textAnchor="middle"
                    className="text-[10px] fill-slate-500 font-semibold"
                  >
                    {formatDay(d.date)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-6 pt-2 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-emerald-600"></span>
          <span className="text-slate-700 font-medium">Hoàn thành an toàn</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-rose-500"></span>
          <span className="text-slate-700 font-medium">Hủy giữa chừng (Aborted)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm bg-emerald-400"></span>
          <span className="text-slate-700 font-medium">Khác (Đang bay, Đã xếp lịch, Đổi tuyến)</span>
        </div>
      </div>
    </div>
  )
}
