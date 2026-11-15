// web/src/features/dashboard/FlightMetricsChart.jsx
// Biểu đồ cột chồng SVG (không cần thư viện ngoài): chuyến hoàn thành / hủy / khác theo từng ngày.
const W = 760;
const H = 300;
const MARGIN = { top: 16, right: 16, bottom: 36, left: 40 };

const formatDay = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export default function FlightMetricsChart({ daily }) {
  if (!daily || daily.every((d) => d.totalFlights === 0)) {
    return <p className="ld-muted">Chưa có chuyến bay trong khoảng thời gian này.</p>;
  }

  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top - MARGIN.bottom;
  const maxTotal = Math.max(1, ...daily.map((d) => d.totalFlights));
  const yMax = Math.ceil(maxTotal / 4) * 4;          // trục Y chia 4 khoảng nguyên
  const ticks = [0, 1, 2, 3, 4].map((i) => (yMax * i) / 4);
  const step = innerW / daily.length;
  const barW = Math.max(1, step * 0.7);
  const labelEvery = Math.max(1, Math.ceil(daily.length / 8));
  const scale = (v) => (v / yMax) * innerH;
  const baseY = MARGIN.top + innerH;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="ld-chart" role="img"
           aria-label="Biểu đồ số chuyến bay theo ngày">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={MARGIN.left} x2={W - MARGIN.right} y1={baseY - scale(t)} y2={baseY - scale(t)}
                  className="ld-chart__grid" />
            <text x={MARGIN.left - 6} y={baseY - scale(t) + 4} textAnchor="end" className="ld-chart__axis">
              {t}
            </text>
          </g>
        ))}

        {daily.map((d, i) => {
          const other = Math.max(0, d.totalFlights - d.completedFlights - d.abortedFlights);
          const x = MARGIN.left + i * step + (step - barW) / 2;
          const hDone = scale(d.completedFlights);
          const hAbort = scale(d.abortedFlights);
          const hOther = scale(other);
          return (
            <g key={d.date}>
              <title>
                {`${formatDay(d.date)}: ${d.totalFlights} chuyến (${d.completedFlights} hoàn thành, ${d.abortedFlights} hủy, ${other} khác)`}
              </title>
              <rect x={x} y={baseY - hDone} width={barW} height={hDone} className="ld-chart__bar--done" />
              <rect x={x} y={baseY - hDone - hAbort} width={barW} height={hAbort} className="ld-chart__bar--abort" />
              <rect x={x} y={baseY - hDone - hAbort - hOther} width={barW} height={hOther} className="ld-chart__bar--other" />
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 12} textAnchor="middle" className="ld-chart__axis">
                  {formatDay(d.date)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <ul className="ld-legend">
        <li><span className="ld-swatch ld-swatch--done" /> Hoàn thành</li>
        <li><span className="ld-swatch ld-swatch--abort" /> Hủy giữa chừng</li>
        <li><span className="ld-swatch ld-swatch--other" /> Khác (đã lên lịch, đang bay, đổi tuyến)</li>
      </ul>
    </div>
  );
}
