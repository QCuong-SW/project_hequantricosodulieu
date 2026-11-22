import React, { useState, useEffect, useMemo } from "react";
import {
  scanPackageHandoff,
  fetchStationHandoffs,
  fetchStationsWithSlots,
  fetchActiveDrones,
  fetchPendingOrdersForHandoff,
  updateStationSlotStatus,
} from "./handoffApi";
import {
  DEFAULT_STATION_ID,
  DEFAULT_OPERATOR_ID,
  DEFAULT_DRONE_ID,
} from "../../config/apiConfig";

const FALLBACK_STATIONS = [
  {
    id: "22222222-2222-2222-2222-222222222001",
    stationCode: "STN-Q1",
    name: "Trạm Trung Tâm Quận 1",
    addressLine: "Khu vực Bến Thành, Quận 1, TP.HCM",
    availableLandingPadsCount: 1,
    availableChargingDocksCount: 1,
  },
  {
    id: "22222222-2222-2222-2222-222222222002",
    stationCode: "STN-TD",
    name: "Trạm Khu Công Nghệ Cao Thủ Đức",
    addressLine: "Khu Công Nghệ Cao, TP. Thủ Đức, TP.HCM",
    availableLandingPadsCount: 1,
    availableChargingDocksCount: 1,
  },
  {
    id: "22222222-2222-2222-2222-222222222003",
    stationCode: "STN-Q7",
    name: "Trạm Khu Đô Thị Phú Mỹ Hưng Q7",
    addressLine: "Khu vực Phú Mỹ Hưng, Quận 7, TP.HCM",
    availableLandingPadsCount: 2,
    availableChargingDocksCount: 1,
  },
];

export default function StationOperatorView() {
  const [stations, setStations] = useState(FALLBACK_STATIONS);
  const [drones, setDrones] = useState([]);
  const [orders, setOrders] = useState([]);
  const [stationId, setStationId] = useState(DEFAULT_STATION_ID);
  const [operatorId] = useState(DEFAULT_OPERATOR_ID);
  const [packageBarcode, setPackageBarcode] = useState("");
  const [handoffAction, setHandoffAction] = useState("STATION_RECEIVED");
  const [droneId, setDroneId] = useState(DEFAULT_DRONE_ID);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Load initial dynamic station, drone & orders data
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchStationsWithSlots(),
      fetchActiveDrones(),
      fetchPendingOrdersForHandoff(),
    ]).then(([liveStations, liveDrones, liveOrders]) => {
      if (!active) return;
      if (Array.isArray(liveStations) && liveStations.length > 0) {
        setStations(liveStations);
        setStationId(liveStations[0].id);
      }
      if (Array.isArray(liveDrones) && liveDrones.length > 0) {
        setDrones(liveDrones);
        setDroneId(liveDrones[0].id);
      }
      if (Array.isArray(liveOrders)) {
        setOrders(liveOrders);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  // Load handoff history when stationId changes
  useEffect(() => {
    if (stationId) {
      loadHistory(stationId);
    }
  }, [stationId]);

  async function loadHistory(targetStationId) {
    const records = await fetchStationHandoffs(targetStationId);
    setHistory(Array.isArray(records) ? records : []);
  }

  // Quick barcodes derived from real live orders
  const quickBarcodes = useMemo(() => {
    const barcodes = [];
    orders.forEach((o) => {
      if (o.trackingNumber) barcodes.push(o.trackingNumber);
      if (Array.isArray(o.packages)) {
        o.packages.forEach((pkg) => {
          if (pkg.packageCode) barcodes.push(pkg.packageCode);
        });
      }
    });
    return barcodes.slice(0, 6);
  }, [orders]);

  const currentStation = stations.find((s) => s.id === stationId) || stations[0];

  async function handleScanSubmit(e) {
    e.preventDefault();
    if (!packageBarcode.trim()) {
      setFeedback({
        type: "error",
        message: "Vui lòng nhập hoặc quét mã Barcode/QR của kiện hàng.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const payload = {
        stationId,
        operatorId,
        packageBarcode: packageBarcode.trim(),
        handoffAction,
        droneId: handoffAction === "LOADED_ON_DRONE" ? droneId : null,
        notes: notes.trim() || null,
      };

      const result = await scanPackageHandoff(payload);
      setFeedback({
        type: "success",
        message: result.isIdempotentReplay
          ? `Mã ${result.packageBarcode} đã được ghi nhận ${result.handoffStatus} trước đó (chống trùng lặp Idempotency).`
          : `Xác nhận thành công kiện hàng ${result.packageBarcode} -> ${result.handoffStatus}`,
      });

      setPackageBarcode("");
      setNotes("");
      await loadHistory(stationId);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err.message || "Có lỗi xảy ra khi xác nhận bàn giao kiện hàng.",
      });
    } finally {
      setLoading(false);
    }
  }

  const currentStationSlots = useMemo(() => {
    if (currentStation?.availableSlots && currentStation.availableSlots.length > 0) {
      return currentStation.availableSlots;
    }
    return [
      { id: `${stationId}-slot-1`, slotNumber: 1, slotType: "LANDING_PAD", status: "OCCUPIED", updatedAt: new Date().toISOString() },
      { id: `${stationId}-slot-2`, slotNumber: 2, slotType: "LANDING_PAD", status: "AVAILABLE", updatedAt: new Date().toISOString() },
      { id: `${stationId}-slot-3`, slotNumber: 3, slotType: "CHARGING_DOCK", status: "AVAILABLE", updatedAt: new Date().toISOString() },
      { id: `${stationId}-slot-4`, slotNumber: 4, slotType: "STORAGE_LOCKER", status: "AVAILABLE", updatedAt: new Date().toISOString() },
    ];
  }, [currentStation, stationId]);

  async function handleToggleSlotStatus(slot, targetStatus) {
    try {
      await updateStationSlotStatus(currentStation.id, slot.id, targetStatus);
      const updatedStations = await fetchStationsWithSlots();
      if (Array.isArray(updatedStations) && updatedStations.length > 0) {
        setStations(updatedStations);
      }
      setFeedback({
        type: "success",
        message: `Đã cập nhật Slot #${slot.slotNumber} (${slot.slotType}) trạm ${currentStation.stationCode} sang trạng thái ${targetStatus}.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        message: `Lỗi cập nhật slot trạm: ${err.message}`,
      });
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-emerald-900/10">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Trạm Tiếp Đất &amp; Bàn Giao Kiện Hàng Drone
          </h1>
        </div>
      </div>

      {/* Station Overview Cards (Real Slots from Backend) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stations.map((stn) => {
          const active = stn.id === stationId;
          return (
            <button
              key={stn.id}
              type="button"
              onClick={() => setStationId(stn.id)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                active
                  ? "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm"
                  : "bg-white border-slate-200/90 hover:border-emerald-200 shadow-xs"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full font-mono ${
                    active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {stn.stationCode}
                </span>
                <span className="text-[11px] font-semibold text-emerald-800">
                  {active ? "Đang chọn trực" : "Bấm để chuyển trạm"}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 mb-1">{stn.name}</p>
              <p className="text-xs text-slate-500 truncate mb-3">{stn.addressLine}</p>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                  Bãi đáp trống: {stn.availableLandingPadsCount ?? 1}
                </span>
                <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                  Dock sạc trống: {stn.availableChargingDocksCount ?? 1}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Sơ đồ Quản lý Slot Trạm (Bãi đáp, Khay sạc, Kho lưu trữ) */}
      <section className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <h2 className="text-base font-extrabold text-slate-900">
                Sơ Đồ Phân Bổ Slot Trạm — {currentStation?.name || currentStation?.stationCode}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Kiểm soát trạng thái trực tiếp của từng bãi đáp Drone, dock sạc và khoang lưu trữ tạm thời tại trạm.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            {currentStationSlots.length} Khay / Bãi đáp
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {currentStationSlots.map((slot) => {
            const isAvail = slot.status === "AVAILABLE";
            const isOcc = slot.status === "OCCUPIED";

            const typeLabel =
              slot.slotType === "LANDING_PAD"
                ? "BÃI ĐÁP DRONE"
                : slot.slotType === "CHARGING_DOCK"
                  ? "DOCK SẠC NHANH"
                  : "KHO LƯU TRỮ TỦ";

            return (
              <div
                key={slot.id || slot.slotNumber}
                className={`p-4 rounded-xl border transition-all ${
                  isAvail
                    ? "bg-emerald-50/50 border-emerald-200"
                    : isOcc
                      ? "bg-teal-50/50 border-teal-200"
                      : "bg-amber-50/50 border-amber-200"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-black text-xs text-slate-900">
                    SLOT #{slot.slotNumber}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                      slot.slotType === "LANDING_PAD"
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                        : slot.slotType === "CHARGING_DOCK"
                          ? "bg-teal-100 text-teal-800 border border-teal-200"
                          : "bg-purple-100 text-purple-800 border border-purple-200"
                    }`}
                  >
                    {typeLabel}
                  </span>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isAvail
                        ? "bg-emerald-500 animate-pulse"
                        : isOcc
                          ? "bg-teal-600"
                          : "bg-amber-500"
                    }`}
                  ></span>
                  <span
                    className={`text-xs font-bold ${
                      isAvail
                        ? "text-emerald-700"
                        : isOcc
                          ? "text-teal-800"
                          : "text-amber-700"
                    }`}
                  >
                    {isAvail ? "SẴN SÀNG" : isOcc ? "ĐANG SỬ DỤNG" : "ĐANG BẢO TRÌ"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200/60">
                  {isAvail ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleSlotStatus(slot, "OCCUPIED")}
                        className="flex-1 text-[11px] font-bold py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-2xs"
                      >
                        Đặt Dùng
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleSlotStatus(slot, "MAINTENANCE")}
                        className="text-[11px] font-bold py-1 px-2 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition-all cursor-pointer"
                      >
                        Bảo Trì
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleToggleSlotStatus(slot, "AVAILABLE")}
                      className="w-full text-[11px] font-bold py-1 px-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-all cursor-pointer shadow-2xs"
                    >
                      Giải Phóng Slot
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs font-bold underline cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Main 2-Column: Scan Form vs History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Quét Mã Kiện Hàng</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Sử dụng máy quét Barcode hoặc nhập trực tiếp mã vận đơn/mã kiện.
            </p>
          </div>

          <form onSubmit={handleScanSubmit} className="space-y-4 text-xs">
            {/* Quick Barcodes from real orders */}
            {quickBarcodes.length > 0 && (
              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                  Mã Kiện / Vận Đơn Đang Hoạt Động (Bấm Chọn Nhanh)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {quickBarcodes.map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setPackageBarcode(code)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-700 font-mono text-[11px] transition cursor-pointer"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                Mã Barcode / Mã Vận Đơn *
              </label>
              <input
                type="text"
                placeholder="Ví dụ: SDD-20261118-754642 hoặc PKG-1118-01-3958"
                value={packageBarcode}
                onChange={(e) => setPackageBarcode(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                Hành Động Bàn Giao *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setHandoffAction("STATION_RECEIVED")}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    handoffAction === "STATION_RECEIVED"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs">Tiếp Nhận Trạm</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                    STATION_RECEIVED
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setHandoffAction("LOADED_ON_DRONE")}
                  className={`p-3 rounded-xl border text-center transition cursor-pointer ${
                    handoffAction === "LOADED_ON_DRONE"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold shadow-xs"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                  }`}
                >
                  <div className="text-xs">Gắn Lên Drone</div>
                  <div className="text-[10px] text-slate-400 font-normal mt-0.5 font-mono">
                    LOADED_ON_DRONE
                  </div>
                </button>
              </div>
            </div>

            {handoffAction === "LOADED_ON_DRONE" && (
              <div>
                <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                  Thiết Bị Drone Tiếp Nhận *
                </label>
                <select
                  value={droneId}
                  onChange={(e) => setDroneId(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
                >
                  {drones.map((d) => (
                    <option key={d.id} value={d.id}>
                      [{d.droneCode}] {d.model} — Pin: {d.batteryPercentage}%
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-slate-700 font-bold uppercase tracking-wider text-[11px] mb-1.5">
                Ghi Chú Kiểm Tra An Toàn (Tùy chọn)
              </label>
              <textarea
                rows="2"
                placeholder="Bao bì nguyên vẹn, ngàm drone khóa an toàn..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition cursor-pointer disabled:opacity-50 text-sm tracking-wide"
            >
              {loading ? "Đang xử lý quét mã..." : "Xác Nhận Quét Mã Bàn Giao"}
            </button>
          </form>
        </div>

        {/* Right Column: History Table (7 cols) */}
        <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Nhật Ký Quét Bàn Giao Tại Trạm
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Lịch sử các lần quét tại trạm {currentStation?.name || "hiện tại"}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => loadHistory(stationId)}
              className="px-3 py-1 rounded-lg text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer"
            >
              Làm Mới
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/40 text-[10px] font-bold text-emerald-950 uppercase tracking-wider">
                  <th className="py-2.5 px-3">Mã Kiện</th>
                  <th className="py-2.5 px-3">Hành Động</th>
                  <th className="py-2.5 px-3">Thời Gian</th>
                  <th className="py-2.5 px-3">Ghi Chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-slate-400">
                      Chưa có sự kiện quét mã nào tại trạm này.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.handoffId} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {h.packageBarcode}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-[10px] font-bold ${
                            h.handoffStatus === "STATION_RECEIVED"
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-teal-50 text-teal-800 border border-teal-200"
                          }`}
                        >
                          <span
                            className={`w-1 h-1 rounded-full ${
                              h.handoffStatus === "STATION_RECEIVED"
                                ? "bg-emerald-500"
                                : "bg-teal-500"
                            }`}
                          ></span>
                          {h.handoffStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                        {new Date(h.scannedAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">
                        {h.notes || "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
