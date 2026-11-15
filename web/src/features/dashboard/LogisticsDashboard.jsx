// web/src/features/dashboard/LogisticsDashboard.jsx
import { useState } from 'react';
import { useAnalyticsData } from './useAnalyticsData.js';
import StationUtilizationTable from './StationUtilizationTable.jsx';
import KpiCards from './KpiCards.jsx';
import FlightMetricsChart from './FlightMetricsChart.jsx';
import './LogisticsDashboard.css';

const PRESETS = [
  { label: '7 ngày', days: 7 },
  { label: '30 ngày', days: 30 },
  { label: '90 ngày', days: 90 },
];

/** yyyy-MM-dd theo giờ địa phương (khớp tham số DateOnly của API). */
function toIsoDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default function LogisticsDashboard() {
  const [to, setTo] = useState(() => toIsoDate(new Date()));
  const [from, setFrom] = useState(() => toIsoDate(daysAgo(29)));
  const rangeInvalid = from > to;

  const { loading, error, data, reload } = useAnalyticsData({ from, to, enabled: !rangeInvalid });

  const applyPreset = (days) => {
    setFrom(toIsoDate(daysAgo(days - 1)));
    setTo(toIsoDate(new Date()));
  };

  return (
    <div className="ld-page" aria-busy={loading}>
      <header className="ld-header">
        <div>
          <h1>Dashboard vận hành logistics</h1>
          <p className="ld-muted">Thống kê chuyến bay, đơn hàng và mức sử dụng trạm tiếp đất</p>
        </div>

        <div className="ld-controls">
          <div className="ld-presets" role="group" aria-label="Chọn nhanh khoảng thời gian">
            {PRESETS.map((p) => (
              <button key={p.days} type="button" className="ld-btn" onClick={() => applyPreset(p.days)}>
                {p.label}
              </button>
            ))}
          </div>
          <label className="ld-field">
            Từ ngày
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="ld-field">
            Đến ngày
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button type="button" className="ld-btn ld-btn--primary" onClick={reload} disabled={loading || rangeInvalid}>
            {loading ? 'Đang tải…' : 'Làm mới'}
          </button>
        </div>
      </header>

      {rangeInvalid && (
        <p className="ld-alert ld-alert--warn">Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.</p>
      )}
      {error && (
        <div className="ld-alert ld-alert--error" role="alert">
          {error}
          <button type="button" className="ld-btn" onClick={reload}>Thử lại</button>
        </div>
      )}
      {loading && !data && <p className="ld-muted">Đang tải số liệu…</p>}

      {data && (
        <>
          <KpiCards summary={data.summary} orders={data.orders} />

          <section className="ld-card">
            <h2>Chuyến bay theo ngày</h2>
            <FlightMetricsChart daily={data.daily} />
          </section>

          <section className="ld-card">
            <h2>Mức sử dụng slot theo trạm</h2>
            <StationUtilizationTable stations={data.stations} />
          </section>
        </>
      )}
    </div>
  );
}
