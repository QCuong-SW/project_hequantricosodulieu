import React, { useState, useEffect } from "react";

const START_POINT = { lat: 10.7769, lng: 106.7009, label: "Trạm Cát Lái (ST-01)" };
const END_POINT = { lat: 10.8015, lng: 106.7145, label: "Điểm Giao Hàng (Khách)" };
const TOTAL_STEPS = 30;
const API_BASE_URL = import.meta?.env?.VITE_API_BASE_URL || "http://localhost:5028";

export default function LiveDroneMapView() {
  const [orderId, setOrderId] = useState("ORD-2026-0001");
  const [step, setStep] = useState(0);
  const [isSimulating, setIsSimulating] = useState(true);
  const [orderStatus, setOrderStatus] = useState("IN_TRANSIT");

  const [serverTelemetry, setServerTelemetry] = useState(null);
  const [signalrConnected, setSignalrConnected] = useState(false);

  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpMessage, setOtpMessage] = useState("");

  useEffect(() => {
    let ws = null;
    try {
      const wsBaseUrl = API_BASE_URL.replace(/^http/, "ws");
      ws = new WebSocket(`${wsBaseUrl}/hubs/tracking`);
      ws.onopen = () => {
        ws.send(JSON.stringify({ protocol: "json", version: 1 }) + "\x1e");
        ws.send(JSON.stringify({ type: 1, target: "JoinOrderTrackingGroup", arguments: [orderId] }) + "\x1e");
        setSignalrConnected(true);
      };
      ws.onmessage = (event) => {
        const frames = String(event.data).split("\x1e").filter(Boolean);
        for (const frame of frames) {
          try {
            const msg = JSON.parse(frame);
            if (msg.target === "ReceiveDronePosition" && msg.arguments?.[0]) {
              setServerTelemetry(msg.arguments[0]);
            }
          } catch {}
        }
      };
      ws.onclose = () => setSignalrConnected(false);
    } catch {
      setSignalrConnected(false);
    }
    return () => ws && ws.close();
  }, [orderId]);

  useEffect(() => {
    if (!isSimulating || orderStatus === "DELIVERED") return;

    const timer = setInterval(() => {
      setStep((prev) => (prev < TOTAL_STEPS ? prev + 1 : prev));
    }, 2000);

    return () => clearInterval(timer);
  }, [isSimulating, orderStatus]);

  const progress =
    serverTelemetry?.progressPercent != null
      ? serverTelemetry.progressPercent / 100
      : step / TOTAL_STEPS;

  const currentLat =
    serverTelemetry?.latitude != null
      ? serverTelemetry.latitude
      : (START_POINT.lat + (END_POINT.lat - START_POINT.lat) * progress).toFixed(6);

  const currentLng =
    serverTelemetry?.longitude != null
      ? serverTelemetry.longitude
      : (START_POINT.lng + (END_POINT.lng - START_POINT.lng) * progress).toFixed(6);

  const altitude =
    orderStatus === "DELIVERED"
      ? 0
      : serverTelemetry?.altitudeMeters ?? (progress > 0.1 && progress < 0.9 ? 65 : progress >= 1 ? 5 : 20);

  const speed =
    orderStatus === "DELIVERED" || progress >= 1
      ? 0
      : serverTelemetry?.speedKmh ?? 42.5;

  const battery =
    serverTelemetry?.batteryPercent ?? Math.max(20, (98 - progress * 25).toFixed(1));

  const handleGenerateOtp = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery-confirmations/generate-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        const data = await res.json();
        setGeneratedOtp(data.demoOtp);
        setOtpMessage(`Mã OTP đã tạo (SHA-256): ${data.demoOtp}`);
        return;
      }
    } catch {}

    const fallbackOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(fallbackOtp);
    setOtpMessage(`Mã OTP 6 số (Demo): ${fallbackOtp}`);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpInput.trim()) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/delivery-confirmations/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, otpCode: otpInput }),
      });
      if (res.ok) {
        const data = await res.json();
        setOrderStatus(data.orderStatus || "DELIVERED");
        setOtpMessage(data.message);
        return;
      }
    } catch {}

    if (otpInput.trim() === generatedOtp && generatedOtp !== "") {
      setOrderStatus("DELIVERED");
      setOtpMessage("Xác thực OTP thành công! Đơn hàng đã chuyển sang trạng thái DELIVERED.");
    } else {
      setOtpMessage("Mã OTP không khớp! Vui lòng kiểm tra lại.");
    }
  };

  const markerX = 80 + progress * 540;
  const markerY = 260 - progress * 180;

  return (
    <div style={{ padding: "24px", maxWidth: "1000px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h2 style={{ marginBottom: "8px", color: "#0f172a" }}>
        Giám Sát Hành Trình Drone Trực Tuyến (SignalR 2s Telemetry & OTP)
      </h2>
      <p style={{ color: "#64748b", marginBottom: "20px", display: "flex", justifyContent: "space-between" }}>
        <span>
          Mã đơn đang theo dõi: <strong>{orderId}</strong> | Trạng thái:{" "}
          <span
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              fontWeight: "bold",
              background: orderStatus === "DELIVERED" ? "#dcfce7" : "#fef3c7",
              color: orderStatus === "DELIVERED" ? "#166534" : "#b45309",
            }}
          >
            {orderStatus}
          </span>
        </span>
        <span style={{ fontSize: "12px", color: signalrConnected ? "#15803d" : "#0284c7", fontWeight: "bold" }}>
          {signalrConnected ? "🟢 Live: Đang nhận GPS từ SignalR Server" : "🔵 Simulator: Chu kỳ GPS 2s/lần"}
        </span>
      </p>

      <div
        style={{
          background: "#0f172a",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "20px",
          color: "#f8fafc",
        }}
      >
        <svg viewBox="0 0 700 320" style={{ width: "100%", height: "300px", background: "#1e293b", borderRadius: "8px" }}>
          <line x1="80" y1="260" x2="620" y2="80" stroke="#38bdf8" strokeWidth="3" strokeDasharray="8 6" />

          <circle cx="80" cy="260" r="10" fill="#22c55e" />
          <text x="50" y="290" fill="#cbd5e1" fontSize="13" fontWeight="bold">
            {START_POINT.label}
          </text>

          <circle cx="620" cy="80" r="10" fill="#ef4444" />
          <text x="520" y="55" fill="#cbd5e1" fontSize="13" fontWeight="bold">
            {END_POINT.label}
          </text>

          <g transform={`translate(${markerX}, ${markerY})`}>
            <circle cx="0" cy="0" r="16" fill="rgba(56, 189, 248, 0.25)" />
            <circle cx="0" cy="0" r="8" fill="#38bdf8" stroke="#ffffff" strokeWidth="2" />
            <text x="-45" y="-20" fill="#38bdf8" fontSize="12" fontWeight="bold">
              DRN-VN-04 ({Math.round(progress * 100)}%)
            </text>
          </g>
        </svg>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", marginTop: "14px" }}>
          <div style={{ background: "#334155", padding: "10px", borderRadius: "8px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>Tọa độ GPS (Lat, Lng)</div>
            <div style={{ fontWeight: "bold", fontSize: "15px" }}>
              {currentLat}, {currentLng}
            </div>
          </div>
          <div style={{ background: "#334155", padding: "10px", borderRadius: "8px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>Độ cao / Tốc độ</div>
            <div style={{ fontWeight: "bold", fontSize: "15px" }}>
              {altitude}m | {speed} km/h
            </div>
          </div>
          <div style={{ background: "#334155", padding: "10px", borderRadius: "8px" }}>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>Dung lượng Pin</div>
            <div style={{ fontWeight: "bold", fontSize: "15px", color: "#4ade80" }}>{battery}%</div>
          </div>
          <div style={{ background: "#334155", padding: "10px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setIsSimulating(!isSimulating)}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "none", cursor: "pointer", background: "#0284c7", color: "#fff" }}
            >
              {isSimulating ? "Tạm dừng" : "Tiếp tục"}
            </button>
            <button
              onClick={() => {
                setStep(0);
                setOrderStatus("IN_TRANSIT");
                setServerTelemetry(null);
              }}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "none", cursor: "pointer", background: "#475569", color: "#fff" }}
            >
              Bay lại
            </button>
          </div>
        </div>
      </div>

      <div style={{ border: "1px solid #cbd5e1", borderRadius: "10px", padding: "18px", background: "#f8fafc" }}>
        <h3 style={{ marginBottom: "10px", color: "#0f172a" }}>Xác Nhận Giao Hàng Bằng OTP 6 Số (SHA-256)</h3>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleGenerateOtp}
            style={{ padding: "8px 14px", background: "#0369a1", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
          >
            1. Phát hành mã OTP
          </button>

          <form onSubmit={handleVerifyOtp} style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              maxLength={6}
              placeholder="Nhập mã OTP 6 số..."
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #94a3b8", width: "180px" }}
            />
            <button
              type="submit"
              style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer" }}
            >
              2. Xác nhận nhận hàng
            </button>
          </form>
        </div>
        {otpMessage && (
          <div style={{ marginTop: "12px", fontWeight: "600", color: orderStatus === "DELIVERED" ? "#15803d" : "#0369a1" }}>
            {otpMessage}
          </div>
        )}
      </div>
    </div>
  );
}