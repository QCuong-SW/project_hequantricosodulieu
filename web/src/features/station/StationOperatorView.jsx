import React, { useState, useEffect } from "react";
import { scanPackageHandoff, fetchStationHandoffs } from "./handoffApi";
import {
  DEFAULT_STATION_ID,
  DEFAULT_OPERATOR_ID,
  DEFAULT_DRONE_ID,
} from "../../config/apiConfig";

const STATIONS = [
  { id: "22222222-2222-2222-2222-222222222001", code: "STN-Q1", name: "Trạm Trung Tâm Quận 1 (Bitexco)" },
  { id: "22222222-2222-2222-2222-222222222002", code: "STN-TD", name: "Trạm Khu Công Nghệ Cao Thủ Đức" },
  { id: "22222222-2222-2222-2222-222222222003", code: "STN-Q7", name: "Trạm Khu Đô Thị Phú Mỹ Hưng Q7" },
];

const DRONES = [
  { id: "33333333-3333-3333-3333-333333333001", code: "DRN-001", model: "DJI FlyCart 30 Lite (Max 5.0kg)" },
  { id: "33333333-3333-3333-3333-333333333002", code: "DRN-002", model: "Matrice 350 Delivery (Max 3.5kg)" },
  { id: "33333333-3333-3333-3333-333333333003", code: "DRN-003", model: "Wingcopter 198 Urban (Max 4.5kg)" },
];

const QUICK_BARCODES = ["PKG-2026-0001", "PKG-2026-0002", "PKG-2026-0003", "SDD-20261108-482910"];

export default function StationOperatorView() {
  const [stationId, setStationId] = useState(DEFAULT_STATION_ID);
  const [operatorId] = useState(DEFAULT_OPERATOR_ID);
  const [packageBarcode, setPackageBarcode] = useState("");
  const [handoffAction, setHandoffAction] = useState("STATION_RECEIVED");
  const [droneId, setDroneId] = useState(DEFAULT_DRONE_ID);
  const [notes, setNotes] = useState("");
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadHistory(stationId);
  }, [stationId]);

  async function loadHistory(targetStationId) {
    const records = await fetchStationHandoffs(targetStationId);
    setHistory(records);
  }

  async function handleScanSubmit(e) {
    e.preventDefault();
    if (!packageBarcode.trim()) {
      setFeedback({ type: "error", message: "Vui lòng nhập hoặc quét mã Barcode/QR của kiện hàng." });
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
          ? `Mã ${result.packageBarcode} đã được xác nhận ${result.handoffStatus} trước đó (chống trùng lặp Idempotency).`
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-600 mb-1.5">
            STATION OPERATOR / PACKAGE HANDOFF
          </p>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Trạm Tiếp Đất & Quét Mã QR Bàn Giao
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kiểm tra an toàn kiện hàng tại bãi đáp (STATION_RECEIVED) và xác nhận gắn ngàm lên Drone (LOADED_ON_DRONE).
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-slate-700">
            Trạm đang trực: {STATIONS.find((s) => s.id === stationId)?.code || "STN-Q1"}
          </span>
        </div>
      </div>

      {/* Station Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {STATIONS.map((stn) => {
          const active = stn.id === stationId;
          return (
            <button
              key={stn.id}
              type="button"
              onClick={() => setStationId(stn.id)}
              className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                active
                  ? "bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/15 shadow-sm"
                  : "bg-white border-slate-200 hover:border-slate-300 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono text-xs font-bold">
                  {stn.code}
                </span>
                <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  ACTIVE (4 Slots)
                </span>
              </div>
              <p className="font-bold text-slate-900 text-sm">{stn.name}</p>
              <p className="text-xs text-slate-500 mt-1 font-mono truncate">{stn.id}</p>
            </button>
          );
        })}
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between ${
            feedback.type === "error"
              ? "bg-red-50 border-red-200 text-red-700"
              : "bg-emerald-50 border-emerald-200 text-emerald-800"
          }`}
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs underline ml-4 cursor-pointer"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Scanner Form Card */}
      <form
        onSubmit={handleScanSubmit}
        className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">
            Quét Mã Barcode / QR Kiện Hàng
          </h2>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-slate-400 mr-1">Chọn nhanh mã mẫu:</span>
            {QUICK_BARCODES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setPackageBarcode(code)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-blue-600 text-slate-700 font-mono text-xs font-semibold transition cursor-pointer"
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Mã Barcode / QR Bưu Kiện (*)
            </label>
            <input
              type="text"
              placeholder="Ví dụ: PKG-2026-0001 hoặc mã vận đơn SDD-..."
              value={packageBarcode}
              onChange={(e) => setPackageBarcode(e.target.value)}
              autoFocus
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Thao tác bàn giao (*)
            </label>
            <select
              value={handoffAction}
              onChange={(e) => setHandoffAction(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            >
              <option value="STATION_RECEIVED">STATION_RECEIVED — Trạm tiếp nhận kiện hàng</option>
              <option value="LOADED_ON_DRONE">LOADED_ON_DRONE — Đã khóa kiện lên ngàm Drone</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Trạm thực hiện
            </label>
            <select
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            >
              {STATIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </div>

          {handoffAction === "LOADED_ON_DRONE" && (
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Chọn Drone tiếp nhận kiện hàng (*)
              </label>
              <select
                value={droneId}
                onChange={(e) => setDroneId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
              >
                {DRONES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.model}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Ghi chú kiểm tra an toàn tải trọng
            </label>
            <input
              type="text"
              placeholder="Ví dụ: Kiện hàng nguyên vẹn, đã niêm phong & cân đúng tải trọng..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? "Đang xác nhận..." : "Xác Nhận Quét Mã Bàn Giao"}
          </button>
        </div>
      </form>

      {/* History Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Lịch sử quét mã bàn giao tại trạm ({history.length})
          </h3>
          <button
            type="button"
            onClick={() => loadHistory(stationId)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-500 text-xs font-semibold text-slate-600 hover:text-blue-600 transition cursor-pointer"
          >
            Làm mới
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-5">Mã Kiện Hàng</th>
                <th className="py-3.5 px-5">Trạng Thái Handoff</th>
                <th className="py-3.5 px-5">Ghi Chú Kiểm Hàng</th>
                <th className="py-3.5 px-5">Thời Gian Quét</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.length === 0 ? (
                <tr>
                  <td colSpan="4" className="py-10 text-center text-slate-400">
                    Chưa có kiện hàng nào được quét tại trạm này.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={`${item.handoffId}-${item.handoffStatus}`} className="hover:bg-slate-50/80">
                    <td className="py-3.5 px-5 font-mono font-bold text-slate-900">
                      {item.packageBarcode}
                    </td>
                    <td className="py-3.5 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          item.handoffStatus === "LOADED_ON_DRONE"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }`}
                      >
                        {item.handoffStatus}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-600">{item.notes || "—"}</td>
                    <td className="py-3.5 px-5 text-slate-500 font-mono text-xs">
                      {new Date(item.scannedAt).toLocaleString("vi-VN")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
