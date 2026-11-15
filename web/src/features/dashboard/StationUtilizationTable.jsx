// web/src/features/dashboard/StationUtilizationTable.jsx
const STATUS_LABEL = { ACTIVE: 'Hoạt động', MAINTENANCE: 'Bảo trì', OFFLINE: 'Ngừng hoạt động' };

function barTone(percent) {
  if (percent >= 85) return 'bad';
  if (percent >= 60) return 'warn';
  return 'good';
}

export default function StationUtilizationTable({ stations }) {
  if (!stations || stations.length === 0) {
    return <p className="ld-muted">Chưa có trạm nào.</p>;
  }

  return (
    <div className="ld-table-wrap">
      <table className="ld-table">
        <thead>
          <tr>
            <th>Trạm</th>
            <th>Trạng thái</th>
            <th className="ld-num">Slot khả dụng</th>
            <th className="ld-num">Đang bận</th>
            <th className="ld-num">Bãi đáp bận</th>
            <th>Mức sử dụng</th>
          </tr>
        </thead>
        <tbody>
          {stations.map((s) => (
            <tr key={s.stationId}>
              <td>
                <strong>{s.stationName}</strong>
                <div className="ld-muted ld-small">{s.stationCode}</div>
              </td>
              <td>{STATUS_LABEL[s.stationStatus] ?? s.stationStatus}</td>
              <td className="ld-num">{s.usableSlots}/{s.actualSlots}</td>
              <td className="ld-num">{s.busySlots}</td>
              <td className="ld-num">{s.landingPadBusy}/{s.landingPadSlots}</td>
              <td>
                <div className="ld-bar" title={`${s.utilizationPercent}%`}>
                  <div
                    className={`ld-bar__fill ld-bar__fill--${barTone(s.utilizationPercent)}`}
                    style={{ width: `${Math.min(100, s.utilizationPercent)}%` }}
                  />
                </div>
                <span className="ld-small">{s.utilizationPercent.toFixed(1)}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
