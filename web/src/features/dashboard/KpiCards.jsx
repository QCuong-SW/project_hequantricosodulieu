// web/src/features/dashboard/KpiCards.jsx
const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });

const ORDER_STATUS_LABEL = {
  DRAFT: 'Nháp',
  PENDING_APPROVAL: 'Chờ duyệt',
  REJECTED: 'Bị từ chối',
  APPROVED: 'Đã duyệt',
  SCHEDULED: 'Đã lên lịch',
  IN_TRANSIT: 'Đang vận chuyển',
  DELIVERING: 'Đang giao',
  ARRIVED: 'Đã đến nơi',
  DELIVERED: 'Đã giao',
  DELIVERY_FAILED: 'Giao thất bại',
  CANCELLED: 'Đã hủy',
};

function Card({ label, value, unit, hint, tone = 'neutral' }) {
  return (
    <div className={`ld-kpi ld-kpi--${tone}`}>
      <div className="ld-kpi__label">{label}</div>
      <div className="ld-kpi__value">
        {value}
        {unit && <span className="ld-kpi__unit"> {unit}</span>}
      </div>
      {hint && <div className="ld-kpi__hint">{hint}</div>}
    </div>
  );
}

function onTimeTone(summary) {
  if (summary.completedFlights === 0) return 'neutral';
  if (summary.onTimeRatePercent >= 90) return 'good';
  if (summary.onTimeRatePercent >= 70) return 'warn';
  return 'bad';
}

export default function KpiCards({ summary, orders }) {
  const totalOrders = orders.reduce((sum, o) => sum + o.count, 0);
  const delivered = orders.find((o) => o.status === 'DELIVERED')?.count ?? 0;
  const delayTone = summary.avgArrivalDelayMinutes > 5 ? 'warn' : 'neutral';

  return (
    <section aria-label="Chỉ số KPI">
      <div className="ld-kpi-grid">
        <Card label="Tổng chuyến bay" value={nf.format(summary.totalFlights)}
              hint={`${summary.completedFlights} hoàn thành · ${summary.abortedFlights} hủy giữa chừng`} />
        <Card label="Tỷ lệ đúng giờ" value={nf.format(summary.onTimeRatePercent)} unit="%"
              hint={`${summary.onTimeFlights}/${summary.completedFlights} chuyến hoàn thành`}
              tone={onTimeTone(summary)} />
        <Card label="Trễ trung bình khi đến" value={nf.format(summary.avgArrivalDelayMinutes)} unit="phút"
              hint="Âm nghĩa là đến sớm" tone={delayTone} />
        <Card label="Tổng quãng đường" value={nf.format(summary.totalDistanceKm)} unit="km"
              hint={`Tốc độ TB ${nf.format(summary.avgSpeedKmh)} km/h`} />
        <Card label="Tổng số đơn hàng" value={nf.format(totalOrders)}
              hint={`${nf.format(delivered)} đã giao`} />
      </div>

      {orders.length > 0 && (
        <div className="ld-chips" aria-label="Đơn hàng theo trạng thái">
          {orders.map((o) => (
            <span key={o.status} className="ld-chip">
              {ORDER_STATUS_LABEL[o.status] ?? o.status}: <strong>{o.count}</strong>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
