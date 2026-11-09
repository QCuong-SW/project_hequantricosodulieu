import React, { useState, useEffect } from "react";
import { scanPackageHandoff, fetchStationHandoffs } from "./handoffApi";

const DEFAULT_STATION_ID = "11111111-1111-1111-1111-111111111111";
const DEFAULT_OPERATOR_ID = "22222222-2222-2222-2222-222222222222";
const DEFAULT_DRONE_ID = "33333333-3333-3333-3333-333333333333";

export default function StationOperatorView() {
  const [stationId, setStationId] = useState(DEFAULT_STATION_ID);
  const [operatorId, setOperatorId] = useState(DEFAULT_OPERATOR_ID);
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
          ? `Mã ${result.packageBarcode} đã được xác nhận ${result.handoffStatus} trước đó (chống trùng lặp).`
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
    <div style={{ maxWidth: "900px", margin: "24px auto", padding: "20px", fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: "8px" }}>Trạm Tiếp Đất — Quét Mã QR / Barcode Kiểm Hàng (Station Operator)</h2>
      <p style={{ color: "#64748b", marginBottom: "20px" }}>
        Quét mã bưu kiện để xác nhận kiện hàng đã tới trạm (STATION_RECEIVED) hoặc đã gắn lên Drone (LOADED_ON_DRONE).
      </p>

      {feedback && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: "16px",
            borderRadius: "6px",
            backgroundColor: feedback.type === "error" ? "#fef2f2" : "#f0fdf4",
            color: feedback.type === "error" ? "#b91c1c" : "#15803d",
            border: `1px solid ${feedback.type === "error" ? "#fecaca" : "#bbf7d0"}`,
          }}
        >
          {feedback.message}
        </div>
      )}

      <form
        onSubmit={handleScanSubmit}
        style={{
          display: "grid",
          gap: "12px",
          padding: "18px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "8px",
          marginBottom: "24px",
        }}
      >
        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
            Mã Barcode / QR Bưu Kiện (*)
          </label>
          <input
            type="text"
            placeholder="Ví dụ: PKG-2026-0001"
            value={packageBarcode}
            onChange={(e) => setPackageBarcode(e.target.value)}
            autoFocus
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Trạng thái bàn giao (*)
            </label>
            <select
              value={handoffAction}
              onChange={(e) => setHandoffAction(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            >
              <option value="STATION_RECEIVED">STATION_RECEIVED (Trạm đã nhận kiện)</option>
              <option value="LOADED_ON_DRONE">LOADED_ON_DRONE (Đã gắn kiện lên Drone)</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Mã Trạm (Station ID)
            </label>
            <input
              type="text"
              value={stationId}
              onChange={(e) => setStationId(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>
        </div>

        {handoffAction === "LOADED_ON_DRONE" && (
          <div>
            <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>
              Mã Drone tiếp nhận (Drone ID) (*)
            </label>
            <input
              type="text"
              value={droneId}
              onChange={(e) => setDroneId(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>
        )}

        <div>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "4px" }}>Ghi chú kiểm hàng</label>
          <input
            type="text"
            placeholder="Kiện hàng nguyên vẹn, đã niêm phong..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "12px 16px",
            backgroundColor: "#0284c7",
            color: "#ffffff",
            fontWeight: 600,
            border: "none",
            borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Đang xử lý..." : "Xác nhận Quét Mã Bàn Giao"}
        </button>
      </form>

      <h3 style={{ marginBottom: "12px" }}>Lịch sử quét mã tại trạm ({history.length})</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #e2e8f0" }}>
        <thead>
          <tr style={{ background: "#f8fafc", textAlign: "left" }}>
            <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Mã Kiện Hàng</th>
            <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Trạng Thái</th>
            <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Ghi Chú</th>
            <th style={{ padding: "10px", borderBottom: "1px solid #e2e8f0" }}>Thời Gian Quét</th>
          </tr>
        </thead>
        <tbody>
          {history.length === 0 ? (
            <tr>
              <td colSpan="4" style={{ padding: "16px", textAlign: "center", color: "#64748b" }}>
                Chưa có kiện hàng nào được quét tại trạm này.
              </td>
            </tr>
          ) : (
            history.map((item) => (
              <tr key={`${item.handoffId}-${item.handoffStatus}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px", fontWeight: 600 }}>{item.packageBarcode}</td>
                <td style={{ padding: "10px" }}>{item.handoffStatus}</td>
                <td style={{ padding: "10px" }}>{item.notes || "-"}</td>
                <td style={{ padding: "10px" }}>{new Date(item.scannedAt).toLocaleString("vi-VN")}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}